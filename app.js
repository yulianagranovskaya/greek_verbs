const tg = window.Telegram?.WebApp;

if (tg) {
  try {
    tg.ready();
    tg.expand();
  } catch (e) {
    console.warn("Telegram WebApp init failed:", e);
  }
}

let verbs = [];
let currentTrainingSet = [];
let currentItem = null;
const statsKey = 'verb_conjugation_stats_v1';

const tenseFields = [
  'Ενεστότας',
  'Αόριστος',
  'Απλός Μέλλοντας',
  'Παρατατικός',
  'Απλή Υποτακτική',
  'Προστακτική (εσύ)',
  'Προστακτικύ (εσάς)'
];

let stats = loadStats();

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.getElementById('search').addEventListener('input', renderVerbList);
document.getElementById('levelFilter').addEventListener('change', renderVerbList);
document.getElementById('typeFilter').addEventListener('change', renderVerbList);
document.getElementById('tenseFilter').addEventListener('change', renderVerbList);
document.getElementById('startTraining').addEventListener('click', startTraining);
document.getElementById('showAnswer').addEventListener('click', showAnswer);
document.getElementById('know').addEventListener('click', () => rateAnswer(true));
document.getElementById('dontKnow').addEventListener('click', () => rateAnswer(false));
document.getElementById('resetStats').addEventListener('click', resetStats);
document.getElementById('speakBtn').addEventListener('click', () => {
  if (!currentItem) return;

  speakGreek(currentItem.verb[currentItem.from]);
});

fetch('./verbs.json')
  .then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  })
  .then(data => {
    verbs = Array.isArray(data) ? data : [];
    renderVerbList();
    renderStats();
  })
  .catch(err => {
    document.getElementById('verbList').innerHTML = `<div class="card">Could not load <b>verbs.json</b>: ${escapeHtml(err.message)}</div>`;
  });
  
let greekVoice = null;

function loadVoices() {
  const voices = speechSynthesis.getVoices();

  greekVoice =
    voices.find(v => v.lang === "el-GR") ||
    voices.find(v => v.lang && v.lang.startsWith("el")) ||
    null;
}

loadVoices();
speechSynthesis.onvoiceschanged = loadVoices;

function speakGreek(text) {
  const clean = String(text).split(",")[0].trim();

  const u = new SpeechSynthesisUtterance(clean);
  u.lang = "el-GR";

  if (greekVoice) u.voice = greekVoice;

  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === name));
  document.querySelectorAll('.panel').forEach(panel => panel.classList.toggle('active', panel.id === name));
  if (name === 'stats') renderStats();
}

function normalizeText(v) {
  return String(v || '').toLowerCase().trim();
}

function getFilteredVerbs() {
  const q = normalizeText(document.getElementById('search').value);
  const level = document.getElementById('levelFilter').value;
  const type = document.getElementById('typeFilter').value;
  const tense = document.getElementById('tenseFilter').value;

  return verbs.filter(v => {
    const matchesQ = !q || [
      v['English'],
      v['Russian'],
      v['Ενεστότας'],
      v['Αόριστος'],
      v['Απλός Μέλλοντας'],
      v['Παρατατικός'],
      v['Απλή Υποτακτική'],
      v['Προστακτική (εσύ)'],
      v['Προστακτικύ (εσάς)']
    ].some(x => normalizeText(x).includes(q));

    const matchesLevel = level === 'ALL' || String(v['Level']).trim() === level;
    const matchesType = type === 'ALL' || String(v['Type']).trim() === type;
    const matchesTense = tense === 'ALL' || String(v[tense] || '').trim() !== '';

    return matchesQ && matchesLevel && matchesType && matchesTense;
  });
}

function renderVerbList() {
  const list = document.getElementById('verbList');
  const filtered = getFilteredVerbs();
  list.innerHTML = '';

  if (!filtered.length) {
    list.innerHTML = '<div class="card">Nothing found</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  filtered.slice(0, 100).forEach((v, index) => {
    const card = document.createElement('div');
    card.className = 'card accordion-card';

	const rows = tenseFields
	.filter(field => String(v[field] || '').trim() !== '')
	.map(field => `
		<tr>
		<td class="form-name">${escapeHtml(field)}</td>
		<td class="form-value">${escapeHtml(v[field])}</td>
		</tr>
	`)
	.join('');

    const panelId = `verb-panel-${index}`;

    card.innerHTML = `
      <button class="accordion-header" type="button" aria-expanded="false" aria-controls="${panelId}">
        <div class="accordion-main">
          <div class="accordion-title">${escapeHtml(v['Ενεστότας'] || '')}</div>
          <div class="accordion-subtitle">Click to expand all forms</div>
        </div>
        <div class="accordion-icon">⌄</div>
      </button>
      <div class="accordion-content" id="${panelId}">
        <div class="sub" style="margin-top: 12px;">
          <span class="pill">${escapeHtml(v['English'] || '')}</span>
          <span class="pill">${escapeHtml(v['Russian'] || '')}</span>
          <span class="pill">${escapeHtml(v['Level'] || '')}</span>
          <span class="pill">${escapeHtml(v['Type'] || '')}</span>
        </div>
        <table>${rows}</table>
      </div>
    `;

    const header = card.querySelector('.accordion-header');
    header.addEventListener('click', () => {
      const isOpen = card.classList.toggle('open');
      header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    fragment.appendChild(card);
  });

  const info = document.createElement('div');
  info.className = 'card muted';
  info.textContent = filtered.length > 100
    ? `Found ${filtered.length}. Showing first 100.`
    : `Found ${filtered.length}.`;

  list.appendChild(info);
  list.appendChild(fragment);
}

function startTraining() {
  const level = document.getElementById('trainLevel').value;
  const type = document.getElementById('trainType').value;
  const from = document.getElementById('trainFrom').value;

  currentTrainingSet = verbs
    .filter(v => (level === 'ALL' || String(v['Level']).trim() === level))
    .filter(v => (type === 'ALL' || String(v['Type']).trim() === type))
    .filter(v => String(v[from] || '').trim() !== '');

  if (!currentTrainingSet.length) {
    alert('No verbs for selected filters');
    return;
  }

  document.getElementById('trainingCard').classList.remove('hidden');
  nextTrainingItem();
}

function nextTrainingItem() {
  const from = document.getElementById('trainFrom').value;
  const verb = currentTrainingSet[Math.floor(Math.random() * currentTrainingSet.length)];

  currentItem = { verb, from };

  document.getElementById('answerBlock').classList.add('hidden');
  document.getElementById('answerButtons').classList.add('hidden');

  document.getElementById('trainingLabel').textContent = `Form: ${from}`;
  document.getElementById('trainingPrompt').textContent = verb[from];
  document.getElementById('trainingMeta').textContent = `Level: ${verb['Level']} · Type: ${verb['Type']}`;
}

function showAnswer() {
  if (!currentItem) return;

  const { verb } = currentItem;
  const to = document.getElementById('trainTo').value;

  const answerBlock = document.getElementById('answerBlock');
  answerBlock.classList.remove('hidden');
  document.getElementById('answerButtons').classList.remove('hidden');

if (to === 'ALL') {
  const rows = tenseFields
    .filter(field => String(verb[field] || '').trim() !== '')
    .map(field => `
      <tr>
        <td class="form-name">${escapeHtml(field)}</td>
        <td class="form-value"><b>${escapeHtml(verb[field])}</b></td>
      </tr>
    `)
    .join('');

  answerBlock.innerHTML = `
    <div><b>English:</b> ${escapeHtml(verb['English'] || '')}</div>
    <div><b>Russian:</b> ${escapeHtml(verb['Russian'] || '')}</div>
    <table style="margin-top:8px;">${rows}</table>
  `;
} else {
    answerBlock.innerHTML = `
      <div><b>${escapeHtml(to)}:</b> ${escapeHtml(verb[to] || '')}</div>
    `;
  }
}

function rateAnswer(isKnown) {
  if (!currentItem) return;

  stats.total += 1;
  if (isKnown) {
    stats.known += 1;
  } else {
    stats.unknown += 1;
    const key = `${currentItem.verb['English']} | ${currentItem.from}`;
    stats.hard[key] = (stats.hard[key] || 0) + 1;
  }

  saveStats();
  renderStats();
  nextTrainingItem();
}

function loadStats() {
  try {
    const raw = localStorage.getItem(statsKey);
    if (!raw) return { total: 0, known: 0, unknown: 0, hard: {} };
    return JSON.parse(raw);
  } catch {
    return { total: 0, known: 0, unknown: 0, hard: {} };
  }
}

function saveStats() {
  localStorage.setItem(statsKey, JSON.stringify(stats));
}

function renderStats() {
  document.getElementById('statTotal').textContent = stats.total;
  document.getElementById('statKnown').textContent = stats.known;
  document.getElementById('statUnknown').textContent = stats.unknown;
  document.getElementById('statRate').textContent = stats.total ? `${Math.round(stats.known / stats.total * 100)}%` : '0%';

  const hard = Object.entries(stats.hard).sort((a, b) => b[1] - a[1]).slice(0, 20);
  document.getElementById('hardItems').innerHTML = hard.length
    ? hard.map(([k, v]) => `${escapeHtml(k)} — ${v}`).join('<br>')
    : 'No data yet';
}

function resetStats() {
  stats = { total: 0, known: 0, unknown: 0, hard: {} };
  saveStats();
  renderStats();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
