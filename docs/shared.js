const DATA_ROOT = new URL('data/', document.currentScript.src);

let PLAN_CONFIG = {};
let DEVELOPER_NAMES = {};
let WEEK_THEMES = [];
let TEAM_DATA = {};
let DELIVERABLES = [];

async function fetchJson(path) {
  const url = new URL(path, DATA_ROOT);
  url.searchParams.set('schema', '5');
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
  return response.json();
}

function validateDeliverables(items) {
  if (!Array.isArray(items)) throw new Error('deliverables.json must contain a list');
  items.forEach((item, index) => {
    const label = `Supplied input ${index + 1}`;
    if (!item?.id || !item.name || !item.whatTheyReceive || !item.usedFor || !item.readyWhen) throw new Error(`${label} is missing required delivery details`);
    if (!Array.isArray(item.teams) || !item.teams.length) throw new Error(`${label} must name its teams`);
    if (!item.link || typeof item.link.label !== 'string' || (item.link.href !== null && typeof item.link.href !== 'string')) throw new Error(`${label} has an invalid link placeholder`);
  });
  return items;
}

function validateDeveloper(developer) {
  const required = ['id', 'name', 'title', 'role', 'assignment', 'rules', 'dependencies', 'failureModes', 'excluded', 'weeks'];
  for (const key of required) {
    if (developer[key] === undefined) throw new Error(`Developer data is missing ${key}`);
  }
  if (!Array.isArray(developer.weeks) || developer.weeks.length !== 8) {
    throw new Error(`${developer.id} must have exactly eight weekly tasks`);
  }
  developer.weeks.forEach((task, index) => {
    if (task.week !== index + 1 || !task.title || !task.description || !task.verification || !task.productContext) {
      throw new Error(`${developer.id} Week ${index + 1} must contain week, title, description, verification, and product context`);
    }
  });
  return developer;
}

async function loadPageData() {
  const teamKey = document.body.dataset.team;
  if (teamKey) {
    const [plan, teams] = await Promise.all([fetchJson('plan.json'), fetchJson('teams.json')]);
    const team = teams[teamKey];
    if (!team) throw new Error(`Unknown team: ${teamKey}`);
    const developers = await Promise.all(
      team.developerIds.map(id => fetchJson(`developers/${id}.json`).then(validateDeveloper))
    );
    PLAN_CONFIG = plan;
    WEEK_THEMES = plan.weekThemes;
    DEVELOPER_NAMES = Object.fromEntries(developers.map(developer => [developer.id, developer.name]));
    TEAM_DATA = { [teamKey]: { ...team, developers } };
  }
  if (document.getElementById('deliverables-content')) {
    DELIVERABLES = validateDeliverables(await fetchJson('deliverables.json'));
  }
  window.MONABID_PLAN = { PLAN_CONFIG, DEVELOPER_NAMES, TEAM_DATA, DELIVERABLES };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function logo() {
  return `<svg viewBox="0 0 155 24" role="img" aria-label="Monabid"><path fill="currentColor" d="M23.8.3 12.7 11.4c-.5.4-.7.3-1.2 0L.45.3v23.6l11.1-11.1c.4-.3.7-.2 1.3.1l11 11V.3Z"/><text x="32" y="21" fill="currentColor" font-family="Arial,sans-serif" font-size="25">Monabid</text></svg>`;
}

function bilingualTerms(key) {
  const terms = {
    data: [['My preferences', 'ההעדפות שלי'], ['Delete my data', 'מחיקת הנתונים שלי'], ['Service consent', 'הסכמה לשירות']],
    buyer: [['Upcoming lots', 'פריטים במכירות קרובות'], ['Why this matches', 'למה זה מתאים'], ['Price history', 'היסטוריית מחירים']],
    seller: [['Indicative auction estimate', 'הערכת שווי אינדיקטיבית למכירה פומבית'], ['Insufficient evidence for a valuation', 'אין מספיק מידע להערכת שווי'], ['Create a seller inquiry', 'יצירת פנייה למכירה']]
  };
  const rows = terms[key];
  if (!rows) return '';
  return `<h3>Bilingual product terminology</h3><p class="lede">Implementation instructions remain in English so contracts stay unambiguous. Customer-facing labels and safety language must be reviewed in both languages.</p><div class="bilingual-copy"><div><small>English · LTR</small>${rows.map(row => `<div>${row[0]}</div>`).join('')}</div><div lang="he"><small>עברית · מימין לשמאל</small>${rows.map(row => `<div>${row[1]}</div>`).join('')}</div></div>`;
}

function syncHeaderOffset() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const apply = () => document.documentElement.style.setProperty('--header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
  apply();
  if ('ResizeObserver' in window) new ResizeObserver(apply).observe(header);
  else window.addEventListener('resize', apply);
}

function renderHeader() {
  const page = document.body.dataset.page;
  const links = [
    ['index', 'index.html', 'Project plan'],
    ['learning', 'learning.html', 'Domain learning'],
    ['data', 'data.html', 'Data & Platform'],
    ['buyer', 'buyer.html', 'Buyer'],
    ['seller', 'seller.html', 'Seller'],
    ['deliverables', 'deliverables.html', 'Deliverables']
  ];
  const header = document.getElementById('site-header');
  if (!header) return;
  const indexNav = `<nav class="section-nav" aria-label="On this page"><div><a href="#dashboard">Staff dashboard</a><a href="#outcomes">Customer journeys</a><a href="learning.html">Domain learning</a><a href="#teams">Assignments</a><a href="#timeline">Timeline</a><a href="#scope">Scope</a><a href="#contracts">Contracts</a><a href="#architecture">Architecture</a><a href="#acceptance">Acceptance</a></div></nav>`;
  const filterBar = `<div class="filter-bar"><div class="filter-inner"><strong>View assignment</strong><label for="week-filter">Week</label><select id="week-filter"><option value="all">All weeks</option>${Array.from({ length: 8 }, (_, index) => `<option value="${index + 1}">Week ${index + 1}</option>`).join('')}</select><label for="dev-filter">Developer</label><select id="dev-filter"><option value="all">All developers</option></select><span class="filter-hint">Choose both to open the complete weekly task.</span></div></div>`;
  header.innerHTML = `<header class="site-header"><div class="utility-bar"><div><span>MONABID ASSISTANT</span><span>8-WEEK DELIVERY PLAN</span><span>EN</span></div></div><nav class="nav-main" aria-label="Primary navigation"><a class="brand" href="index.html">${logo()}<small>Project plan</small></a><div class="nav-links">${links.map(([id, href, label]) => `<a href="${href}"${page === id ? ' class="active" aria-current="page"' : ''}>${label}</a>`).join('')}</div></nav>${page === 'index' ? indexNav : ''}${['data', 'buyer', 'seller'].includes(page) ? filterBar : ''}</header>`;
}

function renderFooter() {
  const footer = document.getElementById('site-footer');
  if (footer) footer.innerHTML = `<footer class="footer"><div class="container" style="padding:0">Monabid delivery plan · Team leader: Miryam · <a href="decisions.md">Decisions</a> · <a href="team-matrix.md">Team matrix</a></div></footer>`;
}

function renderDataError(error) {
  const root = document.getElementById('team-content') || document.getElementById('deliverables-content');
  if (root) root.innerHTML = `<section class="hero data-error"><div class="eyebrow">Plan data could not be loaded</div><h1>Check the published JSON files</h1><p>${escapeHtml(error.message)}</p><p>For local review, serve the docs directory over HTTP instead of opening the HTML file directly.</p></section>`;
  console.error(error);
}

function stageFor(_developer, index) {
  return (WEEK_THEMES[index] || `Week ${index + 1}`).toUpperCase();
}

function renderProductContext(developer, task) {
  const context = task.productContext;
  if (!context) return '';
  return `<section class="product-context" aria-label="${developer.id.toUpperCase()} Week ${task.week} place in the complete product"><div class="product-context-head"><strong>Your place in the complete product</strong><p>${escapeHtml(context.introduction)}</p></div><div class="handoff-flow">${context.flow.map(item => `<div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.description)}</p></div>`).join('')}</div><div class="integration-checkpoint"><strong>Week ${task.week} integration checkpoint</strong><ul>${context.integrationCheckpoint.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div class="done-check"><strong>Week ${task.week} is done when</strong><ul>${context.doneWhen.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div></section>`;
}

function renderFeature(team, developer) {
  const assignment = developer.assignment;
  return `<article class="feature-card" id="feature-${developer.id}" data-feature-dev="${developer.id}"><header class="feature-header"><span class="pill gold">${developer.id.toUpperCase()}</span><h3><span class="dev-name" data-dev="${developer.id}"></span> · ${escapeHtml(developer.title)}</h3><span class="feature-role">${escapeHtml(developer.role)}</span></header><div class="feature-body"><section class="assignment-brief" aria-label="Explicit assignment for ${developer.id.toUpperCase()}"><div><strong>User value</strong><p>${escapeHtml(assignment.userValue)}</p></div><div><strong>What you will build</strong><ul>${assignment.build.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div><strong>Expected output</strong><p>${escapeHtml(assignment.expectedOutput)}</p></div><div><strong>Acceptance scenario</strong><p>${escapeHtml(assignment.acceptanceScenario)}</p></div></section><div class="feature-facts"><div><strong>Dependencies</strong>${developer.dependencies.map(escapeHtml).join('; ')}</div><div><strong>Durable rules</strong>${developer.rules.map(escapeHtml).join('; ')}</div><div><strong>Explicitly excluded</strong>${developer.excluded.map(escapeHtml).join('; ')}</div><div><strong>Known failure modes</strong>${developer.failureModes.map(escapeHtml).join('; ')}</div></div><section class="weekly-task-list" aria-label="Eight weekly tasks for ${developer.id.toUpperCase()}"><div class="weekly-task-list-head"><h4>Weekly tasks</h4><p>Each week has one description and one verification.</p></div>${developer.weeks.map((task, index) => `<details class="weekly-task" id="${developer.id}-w${task.week}" data-prompt-dev="${developer.id}" data-prompt-week="${task.week}"><summary class="weekly-task-header"><span class="pill">W${task.week}</span><span class="stage">${stageFor(developer, index)}</span><h4>${escapeHtml(task.title)}</h4><button type="button" class="copy-btn">Copy prompt</button></summary><div class="weekly-task-content"><div class="task-description"><strong>Description</strong><p>${escapeHtml(task.description)}</p></div>${renderProductContext(developer, task)}<section class="task-verification"><strong>Verification</strong><pre>${escapeHtml(task.verification)}</pre></section></div></details>`).join('')}</section></div></article>`;
}

function renderTeamPage() {
  const key = document.body.dataset.team;
  const team = TEAM_DATA[key];
  const root = document.getElementById('team-content');
  if (!team || !root) return;
  root.innerHTML = `<section class="hero"><div class="eyebrow">Team plan · ${team.developers.length} developers · 8 weeks</div><h1>${escapeHtml(team.name)}</h1><p>${escapeHtml(team.mission)}</p><div class="hero-meta"><span>Team leader: Miryam</span><span>${team.developers.length * 8} verification prompts</span><span>Contracts freeze after Week 1</span></div></section><section><div class="section-head"><div><h2>Mission and boundaries</h2><p>One feature area per developer across the complete cycle.</p></div></div><div class="team-intro"><div class="panel"><h3>Team boundaries</h3><ul>${team.boundaries.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div class="panel"><h3>Dependencies</h3><ul>${team.dependencies.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div></div>${bilingualTerms(key)}<h3>Internal feature map</h3><div class="feature-map">${escapeHtml(team.map).replaceAll('\n', '<br>')}</div></section><section id="timeline"><div class="section-head"><div><h2>Team overview</h2><p>Use this matrix to compare ownership across the team. Each cell opens the developer’s complete weekly task.</p></div></div><div class="timeline-wrap"><table class="team-timeline"><thead><tr><th>Week</th>${team.developers.map(developer => `<th data-dev-col="${developer.id}"><span class="dev-name" data-dev="${developer.id}"></span><br>${escapeHtml(developer.title)}</th>`).join('')}</tr></thead><tbody>${Array.from({ length: 8 }, (_, index) => `<tr data-week-row="${index + 1}"><td><span class="week-number">W${index + 1}</span><span class="week-theme">${escapeHtml(WEEK_THEMES[index])}</span></td>${team.developers.map(developer => `<td class="task-cell" data-dev-col="${developer.id}"><a href="#${developer.id}-w${index + 1}"><span class="stage">${stageFor(developer, index)}</span>${escapeHtml(developer.weeks[index].title)}</a></td>`).join('')}</tr>`).join('')}</tbody></table></div></section><section id="features"><div class="section-head"><div><h2>Developer assignments</h2><p>Each developer has one assignment followed by eight weekly tasks. Every weekly task contains its description and verification in one place.</p></div></div>${team.developers.map(developer => renderFeature(team, developer)).join('')}</section>`;
  document.querySelectorAll('.dev-name').forEach(element => { element.textContent = DEVELOPER_NAMES[element.dataset.dev]; });
  initWeeklyTaskAccordions(root);
  initTeamFilters(team);
}

function initWeeklyTaskAccordions(root) {
  const tasks = [...root.querySelectorAll('.weekly-task')];
  tasks.forEach(task => task.addEventListener('toggle', () => {
    if (!task.open) return;
    task.closest('.weekly-task-list').querySelectorAll('.weekly-task[open]').forEach(other => {
      if (other !== task) other.open = false;
    });
  }));
  const openFromHash = () => {
    if (!window.location.hash) return;
    const task = root.querySelector(window.location.hash);
    if (task?.classList.contains('weekly-task')) task.open = true;
  };
  window.addEventListener('hashchange', openFromHash);
  openFromHash();
}

function initTeamFilters(team) {
  const week = document.getElementById('week-filter');
  const developer = document.getElementById('dev-filter');
  team.developers.forEach(item => developer.insertAdjacentHTML('beforeend', `<option value="${item.id}">${escapeHtml(item.name)} · ${escapeHtml(item.title)}</option>`));
  const key = `monabid-filters-${document.body.dataset.page}`;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    if (saved.week) week.value = saved.week;
    if (saved.dev) developer.value = saved.dev;
  } catch (_error) {}
  function apply(focus = true) {
    const selectedWeek = week.value;
    const selectedDeveloper = developer.value;
    document.querySelectorAll('[data-week-row]').forEach(element => element.classList.toggle('hidden-row', selectedWeek !== 'all' && element.dataset.weekRow !== selectedWeek));
    document.querySelectorAll('[data-dev-col]').forEach(element => element.classList.toggle('hidden-row', selectedDeveloper !== 'all' && element.dataset.devCol !== selectedDeveloper));
    document.querySelectorAll('[data-feature-dev]').forEach(element => element.classList.toggle('hidden', selectedDeveloper !== 'all' && element.dataset.featureDev !== selectedDeveloper));
    try { localStorage.setItem(key, JSON.stringify({ week: selectedWeek, dev: selectedDeveloper })); } catch (_error) {}
    if (focus && selectedWeek !== 'all' && selectedDeveloper !== 'all') {
      const target = document.querySelector(`[data-prompt-dev="${selectedDeveloper}"][data-prompt-week="${selectedWeek}"]`);
      if (target) {
        target.closest('.weekly-task-list').querySelectorAll('.weekly-task[open]').forEach(element => { if (element !== target) element.open = false; });
        target.open = true;
        target.classList.add('focused');
        setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        setTimeout(() => target.classList.remove('focused'), 2500);
      }
    }
  }
  week.addEventListener('change', () => apply());
  developer.addEventListener('change', () => apply());
  apply(false);
}

function renderDeliverables() {
  const root = document.getElementById('deliverables-content');
  if (!root) return;
  const readyLinks = DELIVERABLES.filter(item => item.link.href).length;
  root.innerHTML = `<section class="hero"><div class="eyebrow">Inputs supplied by the project owner</div><h1>What you will receive for the project</h1><p>These five consolidated inputs cover the implementation foundation, approved Monabid interface, auction data, selected AI service access, and public deployment. Domain learning and developer assignments are part of this plan, so they are not repeated here as supplied resources.</p><div class="hero-meta"><span>${DELIVERABLES.length} supplied inputs</span><span>${readyLinks} links available</span><span>${DELIVERABLES.length - readyLinks} links to add when ready</span></div></section><section><div class="section-head"><div><h2>Project-owner delivery list</h2><p>Each item states exactly what the team receives, what it is used for, and how the project owner proves it is ready. A working link replaces “Link will be added” when the resource is available.</p></div></div><div class="deliverable-list"><section class="deliverable-group">${DELIVERABLES.map(item => `<article class="deliverable-item" id="deliverable-${escapeHtml(item.id)}"><div class="deliverable-copy"><div class="deliverable-title"><h3>${escapeHtml(item.name)}</h3><span class="pill">${item.teams.map(escapeHtml).join(' · ')}</span></div><strong>You will receive</strong><p>${escapeHtml(item.whatTheyReceive)}</p><div class="deliverable-facts"><div><strong>Used for</strong><p>${escapeHtml(item.usedFor)}</p></div><div><strong>Ready when</strong><p>${escapeHtml(item.readyWhen)}</p></div></div></div><div class="deliverable-action">${item.link.href ? `<a class="button" href="${escapeHtml(item.link.href)}">${escapeHtml(item.link.label)}</a>` : `<span class="pill pending-link">Link will be added when ready</span>`}</div></article>`).join('')}</section></div></section>`;
}

function initLearningChecklist() {
  const checks = [...document.querySelectorAll('[data-learning]')];
  if (!checks.length) return;
  const storage = 'monabid-domain-learning-v1';
  let state = {};
  try { state = JSON.parse(localStorage.getItem(storage) || '{}'); } catch (_error) {}
  const value = document.getElementById('learning-progress-value');
  const bar = document.getElementById('learning-progress-bar');
  function update() {
    const complete = checks.filter(check => check.checked).length;
    value.textContent = `${complete} of ${checks.length} learning checks complete`;
    bar.style.width = `${checks.length ? complete / checks.length * 100 : 0}%`;
    try { localStorage.setItem(storage, JSON.stringify(Object.fromEntries(checks.map(check => [check.dataset.learning, check.checked])))); } catch (_error) {}
  }
  checks.forEach(check => { check.checked = Boolean(state[check.dataset.learning]); check.addEventListener('change', update); });
  document.getElementById('reset-learning').addEventListener('click', () => {
    if (window.confirm('Reset every learning check stored in this browser?')) {
      checks.forEach(check => { check.checked = false; });
      try { localStorage.removeItem(storage); } catch (_error) {}
      update();
    }
  });
  update();
}

function initCopy() {
  document.addEventListener('click', event => {
    const button = event.target.closest('.copy-btn');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const text = button.closest('.weekly-task').querySelector('.task-verification pre').textContent;
    const done = () => {
      button.textContent = 'Copied';
      button.classList.add('copied');
      setTimeout(() => { button.textContent = 'Copy prompt'; button.classList.remove('copied'); }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  });
}

function fallbackCopy(text, done) {
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try { document.execCommand('copy'); done(); } finally { area.remove(); }
}

document.addEventListener('DOMContentLoaded', async () => {
  renderHeader();
  syncHeaderOffset();
  renderFooter();
  try {
    await loadPageData();
    renderTeamPage();
    renderDeliverables();
    initLearningChecklist();
    initCopy();
  } catch (error) {
    renderDataError(error);
  }
});
