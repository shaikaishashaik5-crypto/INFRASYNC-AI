(() => {
'use strict';
/* ============================== helpers ============================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = n => String(n || '?').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
const STATUS = { assigned: 'Assigned', in_progress: 'In progress', completed: 'Completed', delayed: 'Delayed' };
const EMOJI = { 'Residential Building': '🏢', 'Road Construction': '🛣️', 'Commercial Fit-out': '🏬', 'Bridge Construction': '🌉', 'Solar Power Plant': '☀️', 'Water Pipeline': '🚰' };
const CAUSE_ICON = { 'Material shortage': '📦', 'Bad weather': '🌧️', 'Labour shortage': '👷', 'Equipment failure': '🛠️', 'Design / scope change': '📐', 'Permit / inspection': '📝', 'Safety incident': '⛑️', 'Site access / utilities': '🚧', 'Other': '❔' };
const PALETTE = ['#ff6f7b', '#f5bc63', '#80adff', '#d2a5ff', '#5fd3e8', '#67e0b1', '#ff9f7a', '#b6e36b', '#8ea3b1'];
const ICON = {
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
  team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.9c1.8.8 2.8 2.4 3 5.1"/></svg>',
  pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
  logout: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/></svg>',
};

const S = {
  token: null, me: null, data: null, templates: null, page: 'overview', ws: null, wsOk: false, skew: 0,
  open: {}, delayTab: 'all', workerTab: 'active', renderPending: false, pageTitleSet: false,
};
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { } },
  del: k => { try { localStorage.removeItem(k); } catch { } },
};

async function api(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (S.token) headers.Authorization = 'Bearer ' + S.token;
  if (opts.json !== undefined) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(opts.json); }
  const r = await fetch(url, { method: opts.method || 'GET', headers, body: opts.body });
  let data = {};
  try { data = await r.json(); } catch { }
  if (r.status === 401 && S.token && !url.includes('/login')) { logout(true); throw new Error('Session expired'); }
  if (!r.ok) {
    const d = data.detail;
    throw new Error(typeof d === 'string' ? d : Array.isArray(d) ? d.map(x => x.msg).join(', ') : 'Request failed');
  }
  return data;
}

const nowMs = () => Date.now() - S.skew;
function ago(iso) {
  if (!iso) return '';
  const s = Math.max(0, (nowMs() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return Math.round(s / 60) + 'm ago';
  if (s < 86400) return Math.round(s / 3600) + 'h ago';
  return Math.round(s / 86400) + 'd ago';
}
const fmtDate = d => { if (!d) return '—'; const x = new Date(d.slice(0, 10) + 'T12:00:00'); return isNaN(x) ? d : x.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
const fmtDT = iso => { const x = new Date(iso); return isNaN(x) ? iso : x.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); };
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const worker = id => (S.data?.workers || []).find(w => w.id === id) || { id, name: id || 'Unassigned', trade: '', color: '#8ea3b1' };
const project = id => (S.data?.projects || []).find(p => p.id === id) || { id, name: 'Unknown project', location: '' };
const task = id => (S.data?.tasks || []).find(t => t.id === id);
const avatar = w => `<span class="avatar" style="background:${esc(w.color || '#67e0b1')}">${esc(initials(w.name))}</span>`;
const chip = (cls, text) => `<span class="chip ${cls}">${esc(text)}</span>`;
const statusChip = t => t.is_overdue && t.status !== 'delayed' ? chip('overdue', 'Overdue') : chip(t.status, STATUS[t.status] || t.status);
const projStats = pid => {
  const ts = S.data.tasks.filter(t => t.project_id === pid);
  const done = ts.filter(t => t.status === 'completed').length;
  const pct = ts.length ? Math.round(ts.reduce((a, t) => a + (t.status === 'completed' ? 100 : t.progress || 0), 0) / ts.length) : 0;
  return { total: ts.length, done, pct, delayed: ts.filter(t => t.status === 'delayed').length, overdue: ts.filter(t => t.is_overdue).length, active: ts.filter(t => t.status === 'in_progress').length };
};

/* ============================== toast / modal ============================== */
function toast(msg, type = '', title = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<div>${title ? `<b>${esc(title)}</b>` : ''}${esc(msg)}</div>`;
  $('#toastRoot').appendChild(el);
  setTimeout(() => { el.style.transition = '.3s'; el.style.opacity = 0; setTimeout(() => el.remove(), 300); }, type === 'warn' ? 7000 : 4500);
}
function beep() {
  try {
    const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.value = 740; g.gain.setValueAtTime(.001, a.currentTime); g.gain.exponentialRampToValueAtTime(.15, a.currentTime + .02);
    g.gain.exponentialRampToValueAtTime(.001, a.currentTime + .5); o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + .5);
  } catch { }
}
let modalSticky = false;
function openModal(html, { wide = false, sticky = false } = {}) {
  modalSticky = sticky;
  $('#modalRoot').innerHTML = `<div class="modal-bg" id="mbg"><div class="modal ${wide ? 'wide' : ''}" role="dialog">${html}</div></div>`;
  document.body.style.overflow = 'hidden';
}
function setModal(html) { const m = $('#modalRoot .modal'); if (!m) return; const y = m.scrollTop; m.innerHTML = html; m.scrollTop = y; }
function closeModal() { $('#modalRoot').innerHTML = ''; document.body.style.overflow = ''; photos.length = 0; }
document.addEventListener('mousedown', e => { if (e.target.id === 'mbg' && !modalSticky) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('#lightbox').hidden) closeLightbox(); else if (!modalSticky) closeModal(); } });

/* lightbox */
let lb = { list: [], i: 0 };
function openLightbox(list, i) { lb = { list, i }; drawLightbox(); }
function drawLightbox() {
  const box = $('#lightbox'); box.hidden = false;
  box.innerHTML = `<button class="close" data-act="lbClose">✕</button>${lb.list.length > 1 ? '<button class="nav prev" data-act="lbPrev">‹</button><button class="nav next" data-act="lbNext">›</button>' : ''}<img src="${esc(lb.list[lb.i])}" alt="Evidence photo"><small>${lb.i + 1} / ${lb.list.length}</small>`;
}
function closeLightbox() { const b = $('#lightbox'); b.hidden = true; b.innerHTML = ''; }

/* ============================== charts ============================== */
function donut(segs, centerBig, centerSmall) {
  const r = 54, c = 2 * Math.PI * r, total = segs.reduce((a, s) => a + s.v, 0);
  let off = 0, arcs = '';
  if (total) segs.filter(s => s.v).forEach(s => { const len = s.v / total * c; arcs += `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${s.c}" stroke-width="16" stroke-dasharray="${Math.max(0, len - 2)} ${c - Math.max(0, len - 2)}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"/>`; off += len; });
  return `<div class="donut-wrap"><svg viewBox="0 0 140 140" width="170" height="170"><circle cx="70" cy="70" r="${r}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="16"/>${arcs}</svg><div class="center"><b>${centerBig}</b><small>${centerSmall}</small></div></div>`;
}
function ring(pct, color = '#67e0b1') {
  const r = 26, c = 2 * Math.PI * r;
  return `<div class="ring"><svg viewBox="0 0 64 64" width="62" height="62"><circle cx="32" cy="32" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="7"/><circle cx="32" cy="32" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${c * pct / 100} ${c}" transform="rotate(-90 32 32)"/></svg><span>${pct}%</span></div>`;
}
const bar = (label, val, max, color, right) => `<div class="hbar"><div class="row"><span>${label}</span><b>${right ?? val}</b></div><div class="track" style="--c:${color}"><i style="width:${max ? Math.max(4, val / max * 100) : 0}%"></i></div></div>`;
const emptyState = (t, s = '') => `<div class="empty">${ICON.inbox}<div>${esc(t)}</div><div style="font-size:12px">${esc(s)}</div></div>`;

/* ============================== auth / boot ============================== */
function showLanding() {
  S.token = null; S.me = null; S.data = null; S.shellFor = null;
  const feats = [['⚡', 'Real-time sync', 'Every update a worker sends shows up on the manager dashboard instantly, with no refresh and no phone calls.'], ['📷', 'Photo proof', 'Crews send site photos with progress updates and completions, so managers see the work for themselves.'], ['🧠', 'AI delay detection', 'Workers explain a delay in plain words. The AI finds the root cause, severity and a suggested action.'], ['🧱', 'Ready work breakdown', 'Pick a project type and get every work package by trade, ready to assign with dates.'], ['👷', 'Role-based access', 'Workers see only their own tasks. Managers see every site, crew and risk.'], ['📱', 'Works on any phone', 'No app to install. Open it in a browser on site, on a tablet or at the office.']];
  const steps = [['1', 'Create a project', 'Choose Residential, Road, Bridge, Solar and more. The full work list is generated for you.'], ['2', 'Assign your crews', 'Give each field and worker their work packages and due dates in one screen.'], ['3', 'Track it live', 'Workers report from the field. You watch progress, delays and photos as they happen.']];
  $('#app').innerHTML = `
  <div class="land">
    <header class="land-nav"><div class="logo"><div class="logo-mark">I</div><div><b>INFRASYNC</b><small>AI SITE COMMAND</small></div></div>
      <nav><a href="#features" data-act="scrollTo" data-id="features">Features</a><a href="#how" data-act="scrollTo" data-id="how">How it works</a><a href="#roles" data-act="scrollTo" data-id="roles">Who it's for</a></nav>
      <button class="btn primary" data-act="goLogin">Sign in →</button></header>
    <section class="land-hero">
      <div class="land-copy"><span class="pill">🏗️ Construction site management</span>
        <h1>One live view of every <em>site, crew and delay.</em></h1>
        <p>INFRASYNC AI connects your field crews and your office. Workers report progress and photo proof in seconds, and managers see delays, causes and risks the moment they happen.</p>
        <div class="land-cta"><button class="btn primary big" data-act="goLogin">Sign in →</button><button class="btn big" data-act="scrollTo" data-id="how">See how it works</button></div>
        <div class="land-stats"><div><b>22</b><small>work packages in one view</small></div><div><b>8</b><small>trades tracked</small></div><div><b>0</b><small>paperwork to chase</small></div></div></div>
      <div class="land-mock card"><div class="mock-top"><i></i><i></i><i></i><span>Command center</span></div>
        <div class="mock-kpis"><div><small>PROJECTS</small><b style="color:var(--blue)">2</b></div><div><small>IN PROGRESS</small><b style="color:var(--cyan)">3</b></div><div><small>DELAYED</small><b style="color:var(--red)">2</b></div></div>
        <div class="mock-row"><span>Civil</span><div class="track" style="--c:#67e0b1"><i style="width:68%"></i></div><b>68%</b></div>
        <div class="mock-row"><span>Electrical</span><div class="track" style="--c:#80adff"><i style="width:42%"></i></div><b>42%</b></div>
        <div class="mock-row"><span>Plumbing</span><div class="track" style="--c:#5fd3e8"><i style="width:25%"></i></div><b>25%</b></div>
        <div class="mock-alert"><span class="ic red">⚠</span><div><b>Column &amp; slab formwork</b><small>🧠 Bad weather · 2d late · photo proof attached</small></div></div></div>
    </section>
    <section class="land-sec" id="features"><h2>Everything a site team needs</h2><p class="sub">Built for managers who need clarity and crews who need speed.</p>
      <div class="land-grid">${feats.map(f => `<div class="card feat-card"><span>${f[0]}</span><h3>${f[1]}</h3><p>${f[2]}</p></div>`).join('')}</div></section>
    <section class="land-sec" id="how"><h2>How it works</h2><p class="sub">From project set-up to live tracking in three steps.</p>
      <div class="land-steps">${steps.map(x => `<div class="card step-card"><i>${x[0]}</i><h3>${x[1]}</h3><p>${x[2]}</p></div>`).join('')}</div></section>
    <section class="land-sec" id="roles"><h2>Made for both sides of the site</h2><p class="sub">Each person gets a screen designed for their job.</p>
      <div class="land-roles"><div class="card"><h3>🧑‍💼 Site Manager</h3><ul><li>Live dashboard of progress, delays and overdue work</li><li>AI delay causes with photo evidence</li><li>Create projects and assign crews</li><li>Team workload and live activity feed</li></ul></div>
        <div class="card"><h3>👷 Field Worker</h3><ul><li>Simple list of your own tasks only</li><li>Start work, update progress, finish in a tap</li><li>Send photos from the camera or gallery</li><li>Report a delay with the reason in seconds</li></ul></div></div></section>
    <section class="land-final card"><h2>Ready to see your site live?</h2><p>Sign in as a manager or a crew member to get started.</p><button class="btn primary big" data-act="goLogin">Sign in →</button></section>
    <footer class="land-foot">© INFRASYNC AI · Real-time construction site coordination</footer>
  </div>`;
  window.scrollTo(0, 0);
}
let loginSel = 'manager', loginOpts = null;
async function showLogin() {
  S.token = null; S.me = null; S.data = null;
  if (!loginOpts) { try { loginOpts = await api('/api/login-options'); } catch { loginOpts = { manager: { id: 'manager', name: 'Site Manager', trade: 'Management', color: '#67e0b1' }, workers: [] }; } }
  const all = [loginOpts.manager, ...loginOpts.workers];
  $('#app').innerHTML = `
  <div class="login"><div class="login-card">
    <div class="login-hero">
      <div class="logo"><div class="logo-mark">I</div><div><b>INFRASYNC</b><small>AI SITE COMMAND</small></div></div>
      <h1>One live view of every <em>site, crew and delay.</em></h1>
      <p>Workers report from the field in seconds. Managers see progress, delays and photo proof the moment it happens.</p>
      <div class="feat">
        <div><span>⚡</span>Real-time sync between field and manager dashboard</div>
        <div><span>🧠</span>AI-detected delay causes with evidence photos</div>
        <div><span>🧱</span>Prebuilt work breakdown for every project type</div>
      </div>
    </div>
    <form class="login-form" id="loginForm" autocomplete="off">
      <button type="button" class="back-link" data-act="goLanding">← Back to home</button>
      <h2>Sign in</h2><p>Choose your role and enter your PIN.</p>
      <div class="role-grid">${all.map(u => `<button type="button" class="role ${u.id === 'manager' ? 'manager' : ''} ${u.id === loginSel ? 'sel' : ''}" data-act="pickRole" data-id="${esc(u.id)}">${avatar(u)}<div><b>${esc(u.name)}</b><small>${esc(u.id === 'manager' ? 'Manager dashboard' : u.trade + ' crew')}</small></div></button>`).join('')}</div>
      <div class="pin-row"><div class="field" style="flex:1;margin:0"><label>PIN</label><input class="inp" id="pin" type="password" inputmode="numeric" placeholder="Enter PIN" autocomplete="off"></div><button class="btn primary" style="align-self:flex-end;height:44px" type="submit">Sign in →</button></div>
      <div class="err" id="loginErr"></div>
    </form>
  </div></div>`;
  $('#loginForm').onsubmit = async e => {
    e.preventDefault();
    const btn = $('#loginForm button[type=submit]'); btn.disabled = true;
    try {
      const r = await api('/api/login', { method: 'POST', json: { user_id: loginSel, pin: $('#pin').value } });
      S.token = r.token; store.set('infrasync_token', r.token);
      await startApp();
    } catch (err) { $('#loginErr').textContent = err.message; btn.disabled = false; }
  };
  setTimeout(() => $('#pin')?.focus(), 50);
}
function logout(silent) {
  store.del('infrasync_token');
  if (S.ws) { S.ws.onclose = null; try { S.ws.close(); } catch { } S.ws = null; }
  closeModal(); S.shellFor = null; S.page = 'overview';
  showLanding();
  if (silent) setTimeout(() => toast('Please sign in again', 'warn'), 100);
}
async function startApp() {
  const d = await api('/api/state');
  applyState(d);
  S.me = d.me; S.shellFor = null;
  connectWS();
  render();
}
function applyState(d) { S.data = d; S.skew = Date.now() - new Date(d.server_time).getTime(); }
let refreshTimer = null;
function refreshSoon() { clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, 120); }
async function refresh() {
  if (!S.token) return;
  try { applyState(await api('/api/state')); render(); } catch (e) { /* offline */ }
}

/* ============================== realtime ============================== */
let wsRetry = 0, pingTimer = null;
function connectWS() {
  if (S.ws) { S.ws.onclose = null; try { S.ws.close(); } catch { } }
  const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?token=' + encodeURIComponent(S.token);
  const ws = new WebSocket(url); S.ws = ws;
  ws.onopen = () => { S.wsOk = true; wsRetry = 0; setLive(); refresh(); clearInterval(pingTimer); pingTimer = setInterval(() => { try { ws.send('ping'); } catch { } }, 25000); };
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.type !== 'update') return;
    refreshSoon();
    if (m.actor && m.actor !== S.me?.id) {
      if (S.me.role === 'manager') {
        if (m.kind === 'delay') { toast(m.message, 'warn', '⚠ New delay report'); beep(); }
        else if (m.kind === 'completed') toast(m.message, '', '✓ Work completed');
        else toast(m.message, '', 'Field update');
      } else toast(m.message, m.kind === 'reopen' ? 'warn' : '', 'Manager update');
    }
  };
  ws.onclose = () => { S.wsOk = false; setLive(); clearInterval(pingTimer); if (S.token) setTimeout(connectWS, Math.min(8000, 800 * ++wsRetry)); };
  ws.onerror = () => { try { ws.close(); } catch { } };
}
function setLive() { $$('.live-pill').forEach(p => { p.innerHTML = `<span class="dot ${S.wsOk ? '' : 'off'}"></span><span class="t">${S.wsOk ? 'Live · real-time' : 'Reconnecting…'}</span>`; }); }
setInterval(() => { if (S.token && !S.wsOk) refresh(); }, 6000);
setInterval(() => { if (S.token) refresh(); }, 45000); // safety net

/* ============================== render dispatcher ============================== */
function render() {
  if (!S.data || !S.me) return;
  const ae = document.activeElement;
  if (ae && ae.closest && ae.closest('#page') && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) { S.renderPending = true; return; }
  S.renderPending = false;
  S.me.role === 'manager' ? renderManager() : renderWorker();
}
document.addEventListener('focusout', () => { if (S.renderPending) setTimeout(render, 150); });

/* ============================== MANAGER ============================== */
const MNAV = [['overview', 'Command center', 'grid'], ['projects', 'Projects & work', 'folder'], ['delays', 'Delays & evidence', 'alert'], ['team', 'Team workload', 'team'], ['activity', 'Live activity', 'pulse']];
const MTITLE = {
  overview: ['COMMAND CENTER', () => `${greet()}, Manager`, 'Live view of delivery, field progress and emerging risk.'],
  projects: ['PROJECTS', () => 'Projects & work packages', 'Create projects from prebuilt work breakdowns and assign every field.'],
  delays: ['EVIDENCE', () => 'Delays & evidence', 'AI-detected delay causes with the worker\'s photo proof.'],
  team: ['TEAM', () => 'Team workload', 'See who is carrying what, by field.'],
  activity: ['ACTIVITY', () => 'Live activity stream', 'Every field update as it happens.'],
};
const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

function renderManager() {
  if (S.shellFor !== 'manager') {
    S.shellFor = 'manager';
    $('#app').innerHTML = `<div class="shell"><aside class="sidebar">
      <div class="logo"><div class="logo-mark">I</div><div><b>INFRASYNC</b><small>AI SITE COMMAND</small></div></div>
      ${MNAV.map(([id, label, ic]) => `<button class="nav-item" data-act="nav" data-id="${id}">${ICON[ic]}<span>${label}</span>${id === 'delays' ? '<span class="badge zero" id="delayBadge">0</span>' : ''}</button>`).join('')}
      <div class="side-bottom"><div class="profile">${avatar(S.me)}<div style="flex:1"><b>${esc(S.me.name)}</b><small>MANAGER ACCESS</small></div><button class="icon-btn" data-act="logout" title="Sign out">${ICON.logout}</button></div></div>
    </aside><main class="main"><div id="page"></div></main></div>`;
  }
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.id === S.page));
  const unrev = S.data.reports.filter(r => r.kind === 'delay' && !r.reviewed).length;
  const bd = $('#delayBadge'); if (bd) { bd.textContent = unrev; bd.classList.toggle('zero', !unrev); }
  const [crumb, title, sub] = MTITLE[S.page];
  const body = { overview: pOverview, projects: pProjects, delays: pDelays, team: pTeam, activity: pActivity }[S.page]();
  const page = $('#page'), y = window.scrollY;
  page.innerHTML = `<header class="topbar"><div><div class="crumb">WORKSPACE / <b>${crumb}</b></div><h1>${esc(title())}</h1><p>${esc(sub)}</p></div>
    <div class="top-actions"><div class="live-pill"></div><button class="btn primary" data-act="newProject">＋ New project</button></div></header>${body}`;
  setLive(); window.scrollTo(0, y);
}

function pOverview() {
  const d = S.data, T = d.tasks, R = d.reports;
  const cnt = s => T.filter(t => t.status === s).length;
  const done = cnt('completed'), delayed = cnt('delayed'), prog = cnt('in_progress'), assigned = cnt('assigned');
  const overdue = T.filter(t => t.is_overdue).length;
  const onTime = T.filter(t => t.status === 'completed' && t.completed_at && t.completed_at.slice(0, 10) <= t.due_date).length;
  const rate = done ? Math.round(onTime / done * 100) : 100;
  const kpis = [['Projects', d.projects.length, 'active sites', '#80adff'], ['In progress', prog, 'crews working now', '#5fd3e8'], ['Completed', done, `of ${T.length} work packages`, '#67e0b1'], ['Delayed', delayed, 'need attention', '#ff6f7b'], ['Overdue', overdue, 'past due date', '#f5bc63'], ['On-time rate', rate + '%', 'completed on schedule', '#d2a5ff']];
  const dels = R.filter(r => r.kind === 'delay');
  const byCause = {}; dels.forEach(r => byCause[r.ai_cause] = (byCause[r.ai_cause] || 0) + 1);
  const causeRows = Object.entries(byCause).sort((a, b) => b[1] - a[1]); const cmax = causeRows[0]?.[1] || 1;
  const att = [
    ...dels.filter(r => !r.reviewed).map(r => ({ kind: 'delay', r })),
    ...T.filter(t => t.is_overdue && t.status !== 'delayed').map(t => ({ kind: 'overdue', t })),
  ].slice(0, 6);
  const feed = d.activity.slice(0, 12);
  const byTrade = {}; T.forEach(t => { const b = byTrade[t.trade] ||= { n: 0, d: 0 }; b.n++; if (t.status === 'completed') b.d++; });
  return `
  <div class="grid g-kpi">${kpis.map((k, i) => `<div class="card kpi" style="--c:${k[3]};animation-delay:${i * 50}ms"><small>${k[0]}</small><b>${k[1]}</b><span>${k[2]}</span></div>`).join('')}</div>
  <div class="grid g-3">
    <div class="card"><h3>Live field status<small>${T.length} tasks</small></h3>
      ${T.length ? donut([{ v: done, c: '#67e0b1' }, { v: prog, c: '#5fd3e8' }, { v: assigned, c: '#80adff' }, { v: delayed, c: '#ff6f7b' }], T.length ? Math.round(done / T.length * 100) + '%' : '0%', 'complete') : emptyState('No tasks yet')}
      <div class="legend"><div><i style="background:#67e0b1"></i>Completed<b>${done}</b></div><div><i style="background:#5fd3e8"></i>In progress<b>${prog}</b></div><div><i style="background:#80adff"></i>Not started<b>${assigned}</b></div><div><i style="background:#ff6f7b"></i>Delayed<b>${delayed}</b></div></div></div>
    <div class="card"><h3>🧠 AI delay root causes<small>${dels.length} reports</small></h3>
      ${causeRows.length ? causeRows.map(([c, n], i) => bar(`${CAUSE_ICON[c] || ''} ${esc(c)}`, n, cmax, PALETTE[i % PALETTE.length], n + (n > 1 ? ' delays' : ' delay'))).join('') : emptyState('No delays reported', 'Great — everything on track.')}
      <h3 style="margin-top:18px">Progress by field</h3>
      ${Object.entries(byTrade).map(([tr, b]) => bar(esc(tr), b.d, b.n, '#67e0b1', `${b.d}/${b.n}`)).join('') || ''}</div>
    <div class="card"><h3>Needs attention<small>${att.length ? 'click to open' : ''}</small></h3>
      <div class="list">${att.length ? att.map(a => a.kind === 'delay'
        ? `<button class="item" data-act="gotoTask" data-id="${a.r.task_id}"><span class="ic red">⚠</span><span class="grow"><b>${esc(task(a.r.task_id)?.title || 'Task')}</b><small>${esc(a.r.ai_cause)} · ${a.r.delay_days}d late · ${esc(worker(a.r.worker_id).name)}</small></span>${chip(a.r.severity, a.r.severity)}</button>`
        : `<button class="item" data-act="gotoTask" data-id="${a.t.id}"><span class="ic amber">⏰</span><span class="grow"><b>${esc(a.t.title)}</b><small>Overdue since ${fmtDate(a.t.due_date)} · ${esc(worker(a.t.assignee).name)}</small></span>${chip('overdue', 'overdue')}</button>`).join('')
        : emptyState('All clear', 'No unreviewed delays or overdue work.')}</div></div>
  </div>
  <div class="grid g-2">
    <div class="card"><h3>Projects<small><a href="#" data-act="nav" data-id="projects" style="color:var(--mint);text-decoration:none">View all →</a></small></h3>
      <div class="proj-cards">${d.projects.length ? d.projects.map(projCard).join('') : emptyState('No projects', 'Create your first project.')}</div></div>
    <div class="card"><h3>Live activity<small><span class="dot" style="display:inline-block"></span></small></h3><div class="feed">${feed.length ? feed.map(evHtml).join('') : emptyState('No activity yet')}</div></div>
  </div>`;
}
function projCard(p) {
  const s = projStats(p.id);
  return `<div class="card pcard" style="padding:14px" data-act="gotoProject" data-id="${p.id}">${ring(s.pct, s.delayed ? '#f5bc63' : '#67e0b1')}<div style="min-width:0"><b>${esc(p.name)}</b><small>${esc(p.location || p.template)}</small>
    <div class="mini">${chip('neutral', s.done + '/' + s.total + ' done')}${s.delayed ? chip('delayed', s.delayed + ' delayed') : ''}${s.overdue ? chip('overdue', s.overdue + ' overdue') : ''}</div></div></div>`;
}
const EVI = { delay: ['⚠', 'rgba(255,111,123,.15)'], completed: ['✓', 'rgba(103,224,177,.15)'], progress: ['↗', 'rgba(95,211,232,.15)'], start: ['▶', 'rgba(128,173,255,.15)'], assign: ['👤', 'rgba(210,165,255,.15)'], project: ['＋', 'rgba(103,224,177,.15)'], reopen: ['↺', 'rgba(245,188,99,.15)'], review: ['✔', 'rgba(128,173,255,.15)'], photo: ['📷', 'rgba(95,211,232,.15)'] };
function evHtml(a) { const [ic, bg] = EVI[a.kind] || ['•', 'rgba(255,255,255,.08)']; return `<div class="ev"><div class="bubble" style="background:${bg}">${ic}</div><div><p>${esc(a.message)}</p><small>${ago(a.created_at)}${a.actor && a.actor !== 'manager' ? ' · ' + esc(worker(a.actor).name) : ''}</small></div></div>`; }

function pActivity() {
  const a = S.data.activity;
  return `<div class="card"><h3>Everything happening on site<small>${a.length} latest events</small></h3><div class="feed" style="max-height:none">${a.length ? a.map(evHtml).join('') : emptyState('No activity yet')}</div></div>`;
}

function pTeam() {
  const W = S.data.workers, T = S.data.tasks;
  const rows = W.map(w => {
    const ts = T.filter(t => t.assignee === w.id), c = s => ts.filter(t => t.status === s).length;
    return { w, n: ts.length, prog: c('in_progress'), done: c('completed'), del: c('delayed'), ov: ts.filter(t => t.is_overdue).length };
  });
  const max = Math.max(1, ...rows.map(r => r.n));
  return `<div class="card"><div class="table-wrap"><table><thead><tr><th>Worker</th><th>Field</th><th>Assigned</th><th>In progress</th><th>Completed</th><th>Delayed</th><th>Overdue</th><th style="width:22%">Load</th></tr></thead><tbody>
  ${rows.map(r => `<tr><td><div class="person">${avatar(r.w)}<b>${esc(r.w.name)}</b></div></td><td>${chip('neutral', r.w.trade)}</td><td>${r.n}</td><td>${r.prog}</td><td>${r.done}</td><td>${r.del ? chip('delayed', r.del) : '0'}</td><td>${r.ov ? chip('overdue', r.ov) : '0'}</td>
  <td><div class="track" style="--c:${r.w.color}"><i style="width:${r.n / max * 100}%"></i></div></td></tr>`).join('')}</tbody></table></div></div>`;
}

/* ---- projects page ---- */
function pProjects() {
  const P = S.data.projects;
  if (!P.length) return `<div class="card">${emptyState('No projects yet', 'Click “New project” to generate the full work breakdown.')}</div>`;
  return P.map((p, i) => {
    const s = projStats(p.id), open = S.open[p.id] ?? (i === 0);
    const ts = S.data.tasks.filter(t => t.project_id === p.id);
    return `<div class="card" style="margin-bottom:16px" id="proj-${p.id}">
      <div class="panel-head" style="margin:0"><div style="display:flex;gap:14px;align-items:center;cursor:pointer" data-act="toggleProject" data-id="${p.id}">${ring(s.pct, s.delayed ? '#f5bc63' : '#67e0b1')}
        <div><h3 style="margin:0">${esc(p.name)} <span class="chip neutral">${esc(p.id)}</span></h3><div class="hint">${esc(p.location || '—')} · ${esc(p.template)} · started ${fmtDate(p.start_date)}</div>
        <div class="mini">${chip('neutral', s.done + '/' + s.total + ' done')}${s.active ? chip('in_progress', s.active + ' in progress') : ''}${s.delayed ? chip('delayed', s.delayed + ' delayed') : ''}${s.overdue ? chip('overdue', s.overdue + ' overdue') : ''}</div></div></div>
        <div style="display:flex;gap:8px"><button class="btn sm" data-act="addTask" data-id="${p.id}">＋ Add work</button><button class="btn sm danger" data-act="delProject" data-id="${p.id}">Delete</button><button class="btn sm" data-act="toggleProject" data-id="${p.id}">${open ? 'Collapse ▲' : 'Expand ▼'}</button></div></div>
      ${open ? `<div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Work package</th><th>Field</th><th>Assigned to</th><th>Due</th><th>Status</th><th>Progress</th><th></th></tr></thead><tbody>
      ${ts.map(t => {
        const lastDel = S.data.reports.find(r => r.task_id === t.id && r.kind === 'delay');
        return `<tr id="task-${t.id}"><td><a href="#" data-act="openTask" data-id="${t.id}" style="color:var(--text);text-decoration:none"><b>${esc(t.title)}</b></a><div class="hint">${esc((t.description || '').slice(0, 64))}</div></td><td>${chip('neutral', t.trade)}</td>
        <td><select class="sel-inp" data-change="assign" data-id="${t.id}">${S.data.workers.map(w => `<option value="${w.id}" ${w.id === t.assignee ? 'selected' : ''}>${esc(w.name)} · ${esc(w.trade)}</option>`).join('')}</select></td>
        <td><input class="inp" type="date" value="${esc(t.due_date)}" data-change="due" data-id="${t.id}"></td><td>${statusChip(t)}</td>
        <td><div class="prog-mini"><div class="track" style="--c:${t.status === 'delayed' ? '#ff6f7b' : '#67e0b1'}"><i style="width:${t.status === 'completed' ? 100 : t.progress || 0}%"></i></div><small>${t.status === 'completed' ? 100 : t.progress || 0}%</small></div></td>
        <td style="white-space:nowrap">${lastDel ? `<button class="btn sm warn" data-act="openReport" data-id="${lastDel.id}">View cause</button>` : ''} ${t.status === 'completed' || t.status === 'delayed' ? `<button class="btn sm" data-act="reopen" data-id="${t.id}">Reopen</button>` : ''}</td></tr>`;
      }).join('')}</tbody></table></div>` : ''}</div>`;
  }).join('');
}

/* ---- delays page ---- */
function pDelays() {
  const R = S.data.reports, dels = R.filter(r => r.kind === 'delay'), comps = R.filter(r => r.kind === 'completed' && r.photos.length), shots = R.filter(r => r.kind === 'photo');
  const tabs = [['all', 'All delays', dels.length], ['new', 'Unreviewed', dels.filter(r => !r.reviewed).length], ['high', 'High severity', dels.filter(r => r.severity === 'high').length], ['done', 'Completion proof', comps.length], ['photos', 'Field photos', shots.length]];
  let list = S.delayTab === 'new' ? dels.filter(r => !r.reviewed) : S.delayTab === 'high' ? dels.filter(r => r.severity === 'high') : S.delayTab === 'done' ? comps : S.delayTab === 'photos' ? shots : dels;
  return `<div class="panel-head"><div class="tabs">${tabs.map(t => `<button class="tab ${S.delayTab === t[0] ? 'on' : ''}" data-act="delayTab" data-id="${t[0]}">${t[1]} · ${t[2]}</button>`).join('')}</div></div>
  ${list.length ? list.map((r, i) => reportCard(r, i)).join('') : `<div class="card">${emptyState('Nothing here', S.delayTab === 'photos' ? 'Photos workers send from the field appear here.' : S.delayTab === 'done' ? 'Completion photos from workers appear here.' : 'No delay reports match this filter.')}</div>`}`;
}
function thumbs(ph) {
  if (!ph.length) return '<div class="thumbs"><div class="none">No photos</div></div>';
  const s = ph.slice(0, 2); return `<div class="thumbs ${s.length === 1 ? 'one' : ''}">${s.map(p => `<img loading="lazy" src="${esc(p)}" alt="">`).join('')}</div>`;
}
function reportCard(r, i) {
  const t = task(r.task_id), w = worker(r.worker_id), p = project(r.project_id);
  if (r.kind === 'photo') return `<div class="card dcard" style="grid-template-columns:150px 1fr" data-act="openReport" data-id="${r.id}">${thumbs(r.photos)}<div><h4>${esc(t?.title || 'Task')}</h4><div class="meta">${chip('in_progress', '📷 Field photos')}<span>${esc(p.name)}</span><span>· ${esc(w.name)}</span><span>· ${ago(r.created_at)}</span></div>${r.notes ? `<p>${esc(r.notes)}</p>` : ''}</div></div>`;
  if (r.kind === 'completed') return `<div class="card dcard" style="grid-template-columns:150px 1fr" data-act="openReport" data-id="${r.id}">${thumbs(r.photos)}<div><h4>${esc(t?.title || 'Task')}</h4><div class="meta">${chip('completed', 'Completed')}<span>${esc(p.name)}</span><span>· ${esc(w.name)}</span><span>· ${ago(r.created_at)}</span></div>${r.notes ? `<p>${esc(r.notes)}</p>` : ''}</div></div>`;
  return `<div class="card dcard ${r.reviewed ? '' : 'new'}" style="animation-delay:${i * 40}ms" data-act="openReport" data-id="${r.id}">${thumbs(r.photos)}
    <div><h4>${esc(t?.title || 'Task')} ${r.reviewed ? chip('ok', '✓ reviewed') : chip('delayed', 'new')}</h4>
    <div class="meta"><span>${esc(p.name)}</span><span>· ${esc(w.name)} (${esc(w.trade)})</span><span>· ${ago(r.created_at)}</span><span>· 📷 ${r.photos.length}</span></div>
    <p>“${esc(r.reason)}”</p>
    <div class="meta"><span class="ai-badge">🧠 ${CAUSE_ICON[r.ai_cause] || ''} ${esc(r.ai_cause)}</span>${chip(r.severity, r.severity + ' severity')}<span class="conf">${Math.round(r.ai_confidence * 100)}% confidence</span></div></div>
    <div class="days-late"><b>${r.delay_days}</b><small>day${r.delay_days === 1 ? '' : 's'} late</small></div></div>`;
}
function openReport(id) {
  const r = S.data.reports.find(x => x.id === id); if (!r) return;
  const t = task(r.task_id), w = worker(r.worker_id), p = project(r.project_id);
  const gal = r.photos.length ? `<div class="gallery">${r.photos.map((ph, i) => `<img src="${esc(ph)}" alt="Evidence ${i + 1}" data-act="lb" data-id="${esc(id)}" data-i="${i}">`).join('')}</div>` : '<div class="hint">No photos attached.</div>';
  if (r.kind === 'completed' || r.kind === 'photo') {
    openModal(`<div class="modal-head"><div><h2>${esc(t?.title || 'Task')}</h2><p>${r.kind === 'photo' ? 'Field photos' : 'Completion report'} · ${esc(p.name)}</p></div><button class="icon-btn" data-act="closeModal">✕</button></div>
    <div class="modal-body"><dl class="kv"><dt>${r.kind === 'photo' ? 'Sent by' : 'Completed by'}</dt><dd>${esc(w.name)} (${esc(w.trade)})</dd><dt>Time</dt><dd>${fmtDT(r.created_at)}</dd><dt>Notes</dt><dd>${esc(r.notes || '—')}</dd></dl><h4 style="margin:14px 0 4px">${r.kind === 'photo' ? 'Photos' : 'Photo proof'}</h4>${gal}</div>`, { wide: true });
    return;
  }
  openModal(`<div class="modal-head"><div><h2>${esc(t?.title || 'Task')}</h2><p>${esc(p.name)} · reported by ${esc(w.name)} · ${fmtDT(r.created_at)}</p></div><button class="icon-btn" data-act="closeModal">✕</button></div>
  <div class="modal-body">
    <div class="ai-panel"><h4>🧠 AI delay analysis</h4>
      <div class="big">${CAUSE_ICON[r.ai_cause] || ''} Late due to: ${esc(r.ai_cause)}</div>
      <div class="meta"><span><b style="color:var(--text)">${esc(t?.title || 'Task')}</b> is running <b style="color:#ff9aa3">${r.delay_days} day${r.delay_days === 1 ? '' : 's'}</b> behind schedule</span></div>
      <div class="meta" style="margin-top:8px">${chip(r.severity, r.severity + ' severity')}<span>${Math.round(r.ai_confidence * 100)}% confidence</span>${(r.ai_keywords || []).length ? `<span>· matched: ${r.ai_keywords.map(k => `<i class="chip neutral">${esc(k)}</i>`).join(' ')}</span>` : ''}</div>
      <div style="margin-top:10px;font-size:13px"><b>Suggested action:</b> ${esc(r.ai_action)}</div></div>
    <dl class="kv"><dt>Worker's reason</dt><dd>“${esc(r.reason)}”</dd><dt>Cause selected</dt><dd>${esc(r.cause)}</dd><dt>Worker</dt><dd>${esc(w.name)} · ${esc(w.trade)}</dd><dt>Task due</dt><dd>${fmtDate(t?.due_date)} ${t ? statusChip(t) : ''}</dd>${r.notes ? `<dt>Extra notes</dt><dd>${esc(r.notes)}</dd>` : ''}${r.manager_note ? `<dt>Manager note</dt><dd>${esc(r.manager_note)}</dd>` : ''}</dl>
    <h4 style="margin:14px 0 4px">📷 Photo evidence (${r.photos.length})</h4>${gal}
    ${r.reviewed ? '' : `<div class="field" style="margin-top:18px"><label>Manager note (optional)</label><textarea class="inp" id="mgrNote" placeholder="e.g. Calling supplier now, extra truck arriving tomorrow"></textarea></div>`}</div>
  <div class="modal-foot"><span class="sp">${r.reviewed ? '✓ Reviewed' : 'Not reviewed yet'}</span><button class="btn" data-act="closeModal">Close</button>${t && t.status !== 'in_progress' ? `<button class="btn warn" data-act="reopen" data-id="${t.id}" data-close="1">Reopen task</button>` : ''}${r.reviewed ? '' : `<button class="btn primary" data-act="review" data-id="${esc(id)}">Mark reviewed</button>`}</div>`, { wide: true });
}
function openTask(id) {
  const t = task(id); if (!t) return;
  const ups = S.data.updates.filter(u => u.task_id === id), reps = S.data.reports.filter(r => r.task_id === id), w = worker(t.assignee);
  openModal(`<div class="modal-head"><div><h2>${esc(t.title)}</h2><p>${esc(project(t.project_id).name)} · ${esc(t.trade)}</p></div><button class="icon-btn" data-act="closeModal">✕</button></div>
  <div class="modal-body">${(() => { const dr = reps.find(r => r.kind === 'delay'); return dr ? `<div class="ai-panel"><h4>🧠 Why this work is delayed</h4><div class="big">${CAUSE_ICON[dr.ai_cause] || ''} ${esc(dr.ai_cause)} · ${dr.delay_days} day${dr.delay_days === 1 ? '' : 's'} late</div><div class="meta" style="margin-top:6px">${chip(dr.severity, dr.severity + ' severity')}<span>“${esc(dr.reason)}”</span></div><div style="margin-top:8px;font-size:13px"><b>Suggested action:</b> ${esc(dr.ai_action)}</div><button class="btn sm warn" style="margin-top:10px" data-act="openReport" data-id="${dr.id}">Open full delay report${dr.reviewed ? '' : ' & review'}</button></div>` : ''; })()}<dl class="kv"><dt>Assigned to</dt><dd><div class="person">${avatar(w)} ${esc(w.name)}</div></dd><dt>Status</dt><dd>${statusChip(t)}</dd><dt>Progress</dt><dd>${t.status === 'completed' ? 100 : t.progress}%</dd><dt>Schedule</dt><dd>${fmtDate(t.start_date)} → ${fmtDate(t.due_date)}</dd><dt>Details</dt><dd>${esc(t.description || '—')}</dd></dl>
  <h4 style="margin:14px 0 8px">Worker updates</h4>${ups.length ? `<div class="feed">${ups.map(u => `<div class="ev"><div class="bubble" style="background:rgba(95,211,232,.15)">↗</div><div><p>${u.progress}% — ${esc(u.note || 'progress update')}</p><small>${ago(u.created_at)}</small></div></div>`).join('')}</div>` : '<div class="hint">No progress updates yet.</div>'}
  <h4 style="margin:14px 0 8px">Reports</h4>${reps.length ? `<div class="list">${reps.map(r => `<button class="item" data-act="openReport" data-id="${r.id}"><span class="ic ${r.kind === 'delay' ? 'red' : ''}">${r.kind === 'delay' ? '⚠' : r.kind === 'photo' ? '📷' : '✓'}</span><span class="grow"><b>${r.kind === 'delay' ? esc(r.ai_cause) + ' · ' + r.delay_days + 'd late' : r.kind === 'photo' ? 'Field photos' : 'Completed'}</b><small>${ago(r.created_at)} · ${r.photos.length} photo(s)</small></span></button>`).join('')}</div>` : '<div class="hint">No reports yet.</div>'}
  ${reps.some(r => r.photos.length) ? `<h4 style="margin:14px 0 4px">📷 Photos for this work</h4><div class="gallery">${reps.map(r => r.photos.map((ph, i) => `<img src="${esc(ph)}" alt="Site photo" data-act="lb" data-id="${esc(r.id)}" data-i="${i}">`).join('')).join('')}</div>` : ''}</div>`);
}

/* ---- manager actions ---- */
async function act(fn, okMsg) { try { await fn(); if (okMsg) toast(okMsg); await refresh(); } catch (e) { toast(e.message, 'err', 'Error'); } }

/* ---- new project wizard ---- */
let W = null;
async function openWizard() {
  if (!S.templates) { try { S.templates = await api('/api/templates'); } catch (e) { return toast(e.message, 'err'); } }
  W = { step: 1, name: '', location: '', template: null, start: S.data.today, tasks: [], err: '', busy: false };
  openModal('', { wide: true, sticky: true }); drawWizard();
}
function pickTemplate(name) {
  W.template = name;
  W.tasks = S.templates.templates[name].map(t => ({ ...t, on: true, assignee: S.templates.trade_owner[t.trade] || 'worker1', due: '', edited: false }));
  recomputeDue();
}
function recomputeDue() { let cur = W.start; W.tasks.forEach(t => { if (!t.on) return; cur = addDays(cur, t.duration_days); if (!t.edited) t.due = cur; }); }
const wsel = () => W.tasks.filter(t => t.on);
function drawWizard() {
  const step = W.step;
  const head = `<div class="modal-head"><div><h2>New project</h2><p>${step === 1 ? 'Tell us about the project and pick its type.' : `We found <b>${W.tasks.length}</b> related work packages for ${esc(W.template)}. Tick what applies and assign every field.`}</p>
    <div class="steps"><div class="step ${step === 1 ? 'on' : 'done'}"><i>${step > 1 ? '✓' : '1'}</i>Project</div><div class="step-sep"></div><div class="step ${step === 2 ? 'on' : ''}"><i>2</i>Work & assignments</div></div></div><button class="icon-btn" data-act="wizClose">✕</button></div>`;
  let body, foot;
  if (step === 1) {
    body = `<div class="modal-body"><div class="grid" style="grid-template-columns:1fr 1fr;gap:12px"><div class="field"><label>Project name *</label><input class="inp" id="wName" value="${esc(W.name)}" placeholder="e.g. Lakeview Towers"></div><div class="field"><label>Location</label><input class="inp" id="wLoc" value="${esc(W.location)}" placeholder="City, State"></div>
      <div class="field"><label>Start date</label><input class="inp" type="date" id="wStart" value="${esc(W.start)}"></div></div>
      <div class="field"><label>Project type * <span style="text-transform:none;letter-spacing:0;font-weight:400">— prebuilt work breakdown loads automatically</span></label></div>
      <div class="tmpl-grid">${Object.entries(S.templates.templates).map(([n, items]) => `<button class="tmpl ${W.template === n ? 'sel' : ''}" data-act="wizTemplate" data-id="${esc(n)}"><span class="emoji">${EMOJI[n] || '🏗️'}</span><b>${esc(n)}</b><small>${items.length} work packages · ${new Set(items.map(i => i.trade)).size} fields</small></button>`).join('')}</div>
      <div class="err" id="wErr">${esc(W.err)}</div></div>`;
    foot = `<div class="modal-foot"><button class="btn" data-act="wizClose">Cancel</button><button class="btn primary" data-act="wizNext">Show related work →</button></div>`;
  } else {
    const sel = wsel(), fields = new Set(sel.map(t => t.trade)), workers = new Set(sel.map(t => t.assignee));
    const end = sel.length ? sel.reduce((m, t) => t.due > m ? t.due : m, W.start) : W.start;
    const groups = S.templates.trades.filter(tr => W.tasks.some(t => t.trade === tr));
    const wopts = (tr, cur) => { const own = S.data.workers.filter(w => w.trade === tr), other = S.data.workers.filter(w => w.trade !== tr); return [...own, ...other].map(w => `<option value="${w.id}" ${w.id === cur ? 'selected' : ''}>${esc(w.name)} · ${esc(w.trade)}</option>`).join(''); };
    body = `<div class="modal-body"><div class="summary-bar"><div class="card"><b>${sel.length}</b><small>of ${W.tasks.length} work packages</small></div><div class="card"><b>${fields.size}</b><small>fields involved</small></div><div class="card"><b>${workers.size}</b><small>workers assigned</small></div><div class="card"><b>${fmtDate(end)}</b><small>estimated finish</small></div></div>
      <div class="panel-head"><div class="tabs"><button class="tab" data-act="wizAll" data-id="1">Select all</button><button class="tab" data-act="wizAll" data-id="0">Clear</button><button class="tab on" data-act="wizAuto">⚡ Auto-assign by field</button></div><button class="btn sm" data-act="wizCustom">＋ Add custom work</button></div>
      ${groups.map(tr => { const g = W.tasks.map((t, i) => ({ t, i })).filter(x => x.t.trade === tr); const n = g.filter(x => x.t.on).length;
        return `<div class="trade-group"><div class="trade-head"><span>${esc(tr)}</span>${chip('neutral', n + '/' + g.length)}<div class="sp">Assign all to <select class="sel-inp" style="width:170px;padding:6px 8px" data-change="wizGroup" data-id="${esc(tr)}"><option value="">— choose —</option>${wopts(tr, '')}</select></div></div>
        ${g.map(({ t, i }) => `<div class="wrow ${t.on ? '' : 'off'}"><input type="checkbox" ${t.on ? 'checked' : ''} data-change="wizTog" data-id="${i}"><div><b>${esc(t.title)}</b><small>${esc(t.description)}</small></div>
        <select class="sel-inp" data-change="wizAsg" data-id="${i}" ${t.on ? '' : 'disabled'}>${wopts(tr, t.assignee)}</select><input class="inp" type="date" value="${esc(t.due)}" data-change="wizDue" data-id="${i}" ${t.on ? '' : 'disabled'}><span class="dur">${t.duration_days}d</span></div>`).join('')}</div>`; }).join('')}
      <div class="err" id="wErr">${esc(W.err)}</div></div>`;
    foot = `<div class="modal-foot"><span class="sp">${sel.length} work packages will be assigned</span><button class="btn" data-act="wizBack">← Back</button><button class="btn primary" data-act="wizCreate" ${W.busy ? 'disabled' : ''}>${W.busy ? 'Creating…' : '🚀 Create project & notify workers'}</button></div>`;
  }
  setModal(head + body + foot);
}
function wizReadStep1() { W.name = ($('#wName')?.value || '').trim(); W.location = ($('#wLoc')?.value || '').trim(); const s = $('#wStart')?.value; if (s) W.start = s; }
function wizCustom() {
  const trades = S.templates.trades;
  const m = document.createElement('div'); m.className = 'modal-bg'; m.style.zIndex = 60;
  m.innerHTML = `<div class="modal" style="width:min(460px,100%)"><div class="modal-head"><div><h2>Add custom work</h2></div></div><div class="modal-body"><div class="field"><label>Work title *</label><input class="inp" id="cTitle"></div><div class="grid" style="grid-template-columns:1fr 1fr;gap:12px"><div class="field"><label>Field</label><select class="sel-inp" id="cTrade">${trades.map(t => `<option>${esc(t)}</option>`).join('')}</select></div><div class="field"><label>Duration (days)</label><input class="inp" id="cDur" type="number" min="1" value="2"></div></div></div><div class="modal-foot"><button class="btn" id="cCancel">Cancel</button><button class="btn primary" id="cAdd">Add</button></div></div>`;
  document.body.appendChild(m);
  $('#cCancel', m).onclick = () => m.remove();
  $('#cAdd', m).onclick = () => { const title = $('#cTitle', m).value.trim(); if (!title) return; const trade = $('#cTrade', m).value; W.tasks.push({ index: -1, title, trade, description: 'Custom work package', duration_days: Math.max(1, +$('#cDur', m).value || 1), on: true, assignee: S.templates.trade_owner[trade] || 'worker1', due: '', edited: false }); recomputeDue(); m.remove(); drawWizard(); };
  setTimeout(() => $('#cTitle', m).focus(), 30);
}
async function wizCreate() {
  const sel = wsel();
  if (!sel.length) { W.err = 'Select at least one work package.'; return drawWizard(); }
  W.busy = true; W.err = ''; drawWizard();
  try {
    const r = await api('/api/projects', { method: 'POST', json: { name: W.name, location: W.location, template: W.template, start_date: W.start, tasks: sel.map(t => ({ title: t.title, trade: t.trade, description: t.description, duration_days: t.duration_days, assignee: t.assignee, due_date: t.due })) } });
    closeModal(); S.page = 'projects'; S.open[r.id] = true; toast(`Project created with ${r.task_count} work packages — workers notified`, '', '✓ Done'); await refresh();
  } catch (e) { W.busy = false; W.err = e.message; drawWizard(); }
}
function addTaskModal(pid) {
  const tr = S.templates?.trades || ['Civil', 'Structural', 'Electrical', 'Plumbing', 'Mechanical', 'Finishing', 'Safety', 'Quality', 'Planning'];
  openModal(`<div class="modal-head"><div><h2>Add work package</h2><p>${esc(project(pid).name)}</p></div><button class="icon-btn" data-act="closeModal">✕</button></div><div class="modal-body">
    <div class="field"><label>Title *</label><input class="inp" id="aTitle"></div><div class="field"><label>Description</label><input class="inp" id="aDesc"></div>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px"><div class="field"><label>Field</label><select class="sel-inp" id="aTrade">${tr.map(t => `<option>${esc(t)}</option>`).join('')}</select></div>
    <div class="field"><label>Assign to</label><select class="sel-inp" id="aWorker">${S.data.workers.map(w => `<option value="${w.id}">${esc(w.name)} · ${esc(w.trade)}</option>`).join('')}</select></div>
    <div class="field"><label>Due date</label><input class="inp" type="date" id="aDue" value="${addDays(S.data.today, 3)}"></div><div class="field"><label>Duration (days)</label><input class="inp" type="number" min="1" id="aDur" value="2"></div></div><div class="err" id="aErr"></div></div>
    <div class="modal-foot"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="addTaskGo" data-id="${pid}">Add & assign</button></div>`, { sticky: true });
  const sync = () => { const t = $('#aTrade').value; const w = S.data.workers.find(w => w.trade === t); if (w) $('#aWorker').value = w.id; };
  $('#aTrade').onchange = sync; sync();
}

/* ============================== WORKER ============================== */
const photos = []; // pending uploads {blob,url}
function renderWorker() {
  S.shellFor = 'worker';
  const d = S.data, me = S.me, T = d.tasks;
  const active = T.filter(t => t.status !== 'completed'), done = T.filter(t => t.status === 'completed');
  const list = S.workerTab === 'done' ? done : active;
  const prio = { delayed: 0, in_progress: 1, assigned: 2 };
  list.sort((a, b) => (b.is_overdue - a.is_overdue) || ((prio[a.status] ?? 3) - (prio[b.status] ?? 3)) || String(a.due_date).localeCompare(b.due_date));
  const y = window.scrollY;
  $('#app').innerHTML = `<div class="worker-main" id="page">
    <div class="wtop"><div class="whello"><h1>${greet()}, ${esc(me.name.split(' ')[0])} 👋</h1><p>${esc(me.trade)} crew · your assigned work</p></div><div style="display:flex;gap:8px;align-items:center"><div class="live-pill"></div><button class="icon-btn" data-act="logout" title="Sign out">${ICON.logout}</button></div></div>
    <div class="wstats"><div class="card"><b style="color:var(--blue)">${T.filter(t => t.status === 'assigned').length}</b><small>To start</small></div><div class="card"><b style="color:var(--cyan)">${T.filter(t => t.status === 'in_progress' || t.status === 'delayed').length}</b><small>Working</small></div><div class="card"><b style="color:var(--mint)">${done.length}</b><small>Done</small></div></div>
    <div class="panel-head"><div class="tabs"><button class="tab ${S.workerTab === 'active' ? 'on' : ''}" data-act="wTab" data-id="active">Active · ${active.length}</button><button class="tab ${S.workerTab === 'done' ? 'on' : ''}" data-act="wTab" data-id="done">Completed · ${done.length}</button></div></div>
    ${list.length ? list.map(taskCard).join('') : `<div class="card">${emptyState(S.workerTab === 'done' ? 'Nothing completed yet' : 'No work assigned', S.workerTab === 'done' ? '' : 'New tasks from your manager appear here instantly.')}</div>`}</div>`;
  setLive(); window.scrollTo(0, y);
}
function taskCard(t, i) {
  const p = project(t.project_id), rep = S.data.reports.find(r => r.task_id === t.id && r.kind === 'delay');
  const cls = t.is_overdue && t.status !== 'completed' ? 'overdue' : t.status;
  const pr = t.status === 'completed' ? 100 : t.progress || 0;
  return `<div class="card tcard ${cls}" style="animation-delay:${i * 40}ms"><div class="top"><div><h4>${esc(t.title)}</h4><div class="hint">${esc(p.name)} · ${esc(p.location)}</div></div>${statusChip(t)}</div>
    <div class="desc">${esc(t.description)}</div>
    <div class="meta"><span>📅 Due ${fmtDate(t.due_date)}</span>${t.is_overdue ? chip('overdue', 'Past due') : ''}<span>· ${pr}% done</span></div>
    <div class="track" style="margin-top:10px;--c:${t.status === 'delayed' ? '#ff6f7b' : '#67e0b1'}"><i style="width:${pr}%"></i></div>
    ${t.status === 'delayed' && rep ? `<div class="note-box"><b>You reported a delay:</b> ${esc(rep.ai_cause)} — “${esc(rep.reason)}”</div>` : ''}
    ${t.status === 'completed' ? `<div class="hint" style="margin-top:10px">✓ Completed ${ago(t.completed_at)}</div>` : `<div class="actions">
      ${t.status === 'assigned' ? `<button class="btn" data-act="wStart" data-id="${t.id}">▶ Start work</button>` : `<button class="btn" data-act="wProgress" data-id="${t.id}">↗ Update progress</button>`}
      <button class="btn" data-act="wPhoto" data-id="${t.id}">📷 Send photo</button>
      <button class="btn primary" data-act="wFinish" data-id="${t.id}">✓ Finish task</button></div>`}</div>`;
}
function progressModal(id) {
  const t = task(id); photos.length = 0;
  openModal(`<div class="modal-head"><div><h2>Update progress</h2><p>${esc(t.title)}</p></div><button class="icon-btn" data-act="closeModal">✕</button></div><div class="modal-body">
    <div class="range-val" id="pv">${t.progress || 0}%</div><input class="range" id="pr" type="range" min="0" max="99" step="5" value="${t.progress || 0}">
    <div class="field" style="margin-top:18px"><label>What was done? (optional)</label><textarea class="inp" id="pn" placeholder="e.g. Finished blocks A and B"></textarea></div>${photoPicker(false)}<div class="err" id="rErr"></div></div>
    <div class="modal-foot"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="wProgressGo" data-id="${id}">Send update to manager</button></div>`);
  $('#pr').oninput = e => $('#pv').textContent = e.target.value + '%';
}
function finishModal(id) {
  const t = task(id);
  openModal(`<div class="modal-head"><div><h2>Finish task</h2><p>${esc(t.title)}</p></div><button class="icon-btn" data-act="closeModal">✕</button></div><div class="modal-body"><p class="hint" style="margin-bottom:14px;text-align:center">How did this task go?</p><div class="choice">
    <button class="ok" data-act="wDone" data-id="${id}"><span class="em">✅</span><b>Completed</b><small>Work finished</small></button>
    <button class="late" data-act="wDelay" data-id="${id}"><span class="em">⚠️</span><b>Delayed</b><small>Report reason + photo proof</small></button></div></div>`);
}
const photoPicker = (req) => `<div class="field"><label>Photos ${req ? '* (required as proof)' : '(optional)'}</label><div class="photo-actions"><button type="button" class="btn sm" data-act="camera">📷 Take photo</button><button type="button" class="btn sm" data-act="gallery">🖼️ Upload from gallery</button></div>
  <input type="file" id="fCam" accept="image/*" capture="environment" hidden><input type="file" id="fUp" accept="image/*" multiple hidden><div class="previews" id="previews"></div><div class="drop-hint" id="dropHint">No photos added yet</div></div>`;
function drawPreviews() {
  const el = $('#previews'); if (!el) return;
  el.innerHTML = photos.map((p, i) => `<div class="pv"><img src="${p.url}" alt=""><button type="button" data-act="rmPhoto" data-id="${i}">✕</button></div>`).join('');
  const h = $('#dropHint'); if (h) h.style.display = photos.length ? 'none' : '';
}
async function compress(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file), max = 1600, k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .82));
    return blob && blob.size < file.size ? blob : file;
  } catch { return file; }
}
async function addPhotos(files) {
  for (const f of files) { const b = await compress(f); photos.push({ blob: b, url: URL.createObjectURL(b), name: 'photo-' + Date.now() + '-' + photos.length + (b.type === 'image/jpeg' ? '.jpg' : '.' + (f.name.split('.').pop() || 'jpg')) }); }
  drawPreviews();
}
document.addEventListener('change', e => {
  if (e.target.id === 'fCam' || e.target.id === 'fUp') { addPhotos([...e.target.files]); e.target.value = ''; }
});
function doneModal(id) {
  const t = task(id); photos.length = 0;
  openModal(`<div class="modal-head"><div><h2>Mark as completed ✅</h2><p>${esc(t.title)}</p></div><button class="icon-btn" data-act="closeModal">✕</button></div><div class="modal-body">
    <div class="field"><label>Notes (optional)</label><textarea class="inp" id="rNotes" placeholder="Anything the manager should know"></textarea></div>${photoPicker(false)}<div class="err" id="rErr"></div></div>
    <div class="modal-foot"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="submitDone" data-id="${id}">Submit as completed</button></div>`, { sticky: true });
}
function photoModal(id) {
  const t = task(id); photos.length = 0;
  openModal(`<div class="modal-head"><div><h2>Send photos 📷</h2><p>${esc(t.title)}</p></div><button class="icon-btn" data-act="closeModal">✕</button></div><div class="modal-body">
    <p class="hint" style="margin-bottom:12px">Show the manager how the work looks right now.</p>${photoPicker(true).replace(' * (required as proof)', ' *')}
    <div class="field"><label>Note (optional)</label><textarea class="inp" id="rNotes" placeholder="e.g. Slab shuttering finished on the 2nd floor"></textarea></div><div class="err" id="rErr"></div></div>
    <div class="modal-foot"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="submitPhoto" data-id="${id}">Send to manager</button></div>`, { sticky: true });
}
let delayCause = '';
function delayModal(id) {
  const t = task(id); photos.length = 0; delayCause = '';
  const causes = Object.keys(CAUSE_ICON);
  const late = Math.max(1, Math.round((new Date(S.data.today) - new Date(t.due_date)) / 864e5) || 1);
  openModal(`<div class="modal-head"><div><h2>Report delay ⚠️</h2><p>${esc(t.title)}</p></div><button class="icon-btn" data-act="closeModal">✕</button></div><div class="modal-body">
    <div class="field"><label>1 · What caused the delay? *</label><div class="cause-grid">${causes.map(c => `<button type="button" class="cause" data-act="pickCause" data-id="${esc(c)}">${CAUSE_ICON[c]} ${esc(c)}</button>`).join('')}</div></div>
    <div class="field"><label>2 · Explain what happened *</label><textarea class="inp" id="dReason" placeholder="e.g. Cement delivery arrived 2 days late, crew waiting on site"></textarea></div>
    <div class="field"><label>3 · How many days late? *</label><input class="inp" type="number" min="0" max="365" id="dDays" value="${late}" style="max-width:140px"></div>
    <div class="field"><label>Extra notes (optional)</label><input class="inp" id="dNotes"></div>
    ${photoPicker(true)}<div class="err" id="rErr"></div></div>
    <div class="modal-foot"><button class="btn" data-act="closeModal">Cancel</button><button class="btn danger" data-act="submitDelay" data-id="${id}">Submit delay report</button></div>`, { sticky: true });
}
async function submit(id, kind) {
  const err = $('#rErr'); err.textContent = '';
  const fd = new FormData(); fd.append('kind', kind);
  if (kind === 'delay') {
    const reason = $('#dReason').value.trim();
    if (!delayCause) return err.textContent = 'Please choose the cause of the delay.';
    if (reason.length < 5) return err.textContent = 'Please explain what happened.';
    if (!photos.length) return err.textContent = 'Please add at least one photo as proof.';
    fd.append('cause', delayCause); fd.append('reason', reason); fd.append('delay_days', $('#dDays').value || '0'); fd.append('notes', $('#dNotes').value);
  } else { if (kind === 'photo' && !photos.length) return err.textContent = 'Please add at least one photo.'; fd.append('notes', $('#rNotes').value); }
  photos.forEach(p => fd.append('photos', p.blob, p.name));
  const btn = $('.modal-foot .btn:last-child'); btn.disabled = true; btn.textContent = 'Uploading…';
  try {
    await api(`/api/tasks/${id}/report`, { method: 'POST', body: fd });
    closeModal(); toast(kind === 'delay' ? 'Delay report sent to your manager' : kind === 'photo' ? 'Photos sent to your manager' : 'Marked as completed — great work!', '', '✓ Submitted'); await refresh();
  } catch (e) { err.textContent = e.message; btn.disabled = false; btn.textContent = kind === 'delay' ? 'Submit delay report' : kind === 'photo' ? 'Send to manager' : 'Submit as completed'; }
}

/* ============================== events ============================== */
const ACT = {
  goLogin() { showLogin(); },
  goLanding() { showLanding(); },
  scrollTo(d) { document.getElementById(d.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  gotoTask(d) {
    const t = task(d.id); if (!t) return;
    S.page = 'projects'; S.open[t.project_id] = true; render();
    setTimeout(() => { const row = document.getElementById('task-' + t.id); if (row) { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 3500); } }, 80);
    openTask(t.id);
  },
  wPhoto(d) { photoModal(d.id); },
  pickRole(d, el) { loginSel = d.id; $$('.role').forEach(r => r.classList.toggle('sel', r === el)); $('#pin')?.focus(); },
  logout() { logout(); },
  nav(d) { S.page = d.id; render(); window.scrollTo(0, 0); },
  newProject() { openWizard(); },
  closeModal() { closeModal(); },
  gotoProject(d) { S.page = 'projects'; S.open[d.id] = true; render(); setTimeout(() => document.getElementById('proj-' + d.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); },
  toggleProject(d) { const i = S.data.projects.findIndex(p => p.id === d.id); S.open[d.id] = !(S.open[d.id] ?? i === 0); render(); },
  delProject(d) { if (confirm('Delete this project and all its tasks, reports and photos records?')) act(() => api('/api/projects/' + d.id, { method: 'DELETE' }), 'Project deleted'); },
  addTask(d) { addTaskModal(d.id); },
  async addTaskGo(d) {
    const title = $('#aTitle').value.trim(); if (!title) return $('#aErr').textContent = 'Title is required';
    try { await api(`/api/projects/${d.id}/tasks`, { method: 'POST', json: { title, description: $('#aDesc').value, trade: $('#aTrade').value, assignee: $('#aWorker').value, due_date: $('#aDue').value, duration_days: +$('#aDur').value || 1 } }); closeModal(); toast('Work assigned'); refresh(); } catch (e) { $('#aErr').textContent = e.message; }
  },
  openTask(d, el, ev) { ev.preventDefault(); openTask(d.id); },
  openReport(d) { openReport(d.id); },
  delayTab(d) { S.delayTab = d.id; render(); },
  reopen(d) { act(() => api(`/api/tasks/${d.id}/reopen`, { method: 'POST' }), 'Task reopened').then(() => { if (d.close) closeModal(); }); },
  async review(d) { const note = $('#mgrNote')?.value || ''; try { await api(`/api/reports/${d.id}/review`, { method: 'POST', json: { note } }); closeModal(); toast('Report marked reviewed'); refresh(); } catch (e) { toast(e.message, 'err'); } },
  lb(d) { const r = S.data.reports.find(x => x.id === d.id); openLightbox(r.photos, +d.i); },
  lbClose() { closeLightbox(); },
  lbPrev() { lb.i = (lb.i - 1 + lb.list.length) % lb.list.length; drawLightbox(); },
  lbNext() { lb.i = (lb.i + 1) % lb.list.length; drawLightbox(); },
  /* wizard */
  wizClose() { if (confirm('Discard this new project?')) closeModal(); },
  wizTemplate(d) { wizReadStep1(); pickTemplate(d.id); W.err = ''; drawWizard(); },
  wizNext() { wizReadStep1(); if (!W.name) { W.err = 'Please enter a project name.'; return drawWizard(); } if (!W.template) { W.err = 'Please choose a project type.'; return drawWizard(); } recomputeDue(); W.err = ''; W.step = 2; drawWizard(); },
  wizBack() { W.step = 1; drawWizard(); },
  wizAll(d) { W.tasks.forEach(t => t.on = d.id === '1'); recomputeDue(); drawWizard(); },
  wizAuto() { W.tasks.forEach(t => t.assignee = S.templates.trade_owner[t.trade] || 'worker1'); drawWizard(); toast('Assigned each work package to the matching field specialist'); },
  wizCustom() { wizCustom(); },
  wizCreate() { wizCreate(); },
  /* worker */
  wTab(d) { S.workerTab = d.id; render(); },
  wStart(d) { act(() => api(`/api/tasks/${d.id}/start`, { method: 'POST' }), 'Work started — manager notified'); },
  wProgress(d) { progressModal(d.id); },
  async wProgressGo(d) {
    const btn = $('.modal-foot .btn:last-child'); btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const note = $('#pn').value;
      await api(`/api/tasks/${d.id}/progress`, { method: 'POST', json: { progress: +$('#pr').value, note } });
      if (photos.length) { const fd = new FormData(); fd.append('kind', 'photo'); fd.append('notes', note); photos.forEach(p => fd.append('photos', p.blob, p.name)); await api(`/api/tasks/${d.id}/report`, { method: 'POST', body: fd }); }
      const hadPhotos = photos.length; closeModal(); toast(hadPhotos ? 'Progress and photos sent to manager' : 'Progress sent to manager'); refresh();
    } catch (e) { $('#rErr').textContent = e.message; btn.disabled = false; btn.textContent = 'Send update to manager'; }
  },
  wFinish(d) { finishModal(d.id); },
  wDone(d) { doneModal(d.id); },
  wDelay(d) { delayModal(d.id); },
  pickCause(d, el) { delayCause = d.id; $$('.cause').forEach(c => c.classList.toggle('sel', c === el)); },
  camera() { $('#fCam').click(); },
  gallery() { $('#fUp').click(); },
  rmPhoto(d) { URL.revokeObjectURL(photos[+d.id]?.url); photos.splice(+d.id, 1); drawPreviews(); },
  submitDone(d) { submit(d.id, 'completed'); },
  submitPhoto(d) { submit(d.id, 'photo'); },
  submitDelay(d) { submit(d.id, 'delay'); },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = ACT[el.dataset.act]; if (!fn) return;
  if (el.tagName === 'A') e.preventDefault();
  fn(el.dataset, el, e);
});
const CHG = {
  assign(el) { act(() => api(`/api/tasks/${el.dataset.id}/assign`, { method: 'PATCH', json: { assignee: el.value } }), 'Reassigned — worker notified'); },
  due(el) { if (el.value) act(() => api(`/api/tasks/${el.dataset.id}/assign`, { method: 'PATCH', json: { due_date: el.value } }), 'Due date updated'); },
  wizTog(el) { W.tasks[+el.dataset.id].on = el.checked; recomputeDue(); drawWizard(); },
  wizAsg(el) { W.tasks[+el.dataset.id].assignee = el.value; drawWizard(); },
  wizDue(el) { const t = W.tasks[+el.dataset.id]; t.due = el.value; t.edited = true; drawWizard(); },
  wizGroup(el) { if (!el.value) return; W.tasks.forEach(t => { if (t.trade === el.dataset.id && t.on) t.assignee = el.value; }); drawWizard(); },
};
document.addEventListener('change', e => { const el = e.target.closest('[data-change]'); if (el && CHG[el.dataset.change]) CHG[el.dataset.change](el); });

/* ============================== boot ============================== */
(async function boot() {
  const tk = store.get('infrasync_token');
  if (tk) {
    S.token = tk;
    try { await startApp(); return; } catch { S.token = null; store.del('infrasync_token'); }
  }
  showLanding();
})();
})();
