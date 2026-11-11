'use strict';
/* Garden Planner — single-page app. Data stays on this device (IndexedDB). */

// ---------- helpers ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const todayStr = () => iso(new Date());
const pd = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return iso(d); };
const addInterval = (s, every, per) => {
  const d = pd(s);
  if (per === 'day') d.setDate(d.getDate() + every);
  else if (per === 'week') d.setDate(d.getDate() + 7 * every);
  else d.setMonth(d.getMonth() + every);
  return iso(d);
};
const daysBetween = (a, b) => Math.round((pd(b) - pd(a)) / 864e5);
const niceDate = s => s ? pd(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—';
const shortDate = s => s ? pd(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';
const num = v => (v === '' || v == null || isNaN(+v)) ? null : +v;
const go = h => { location.hash = h; };

// ---------- state ----------
let S = null;
const photoURLs = {};
let A = {};          // per-page action handlers
let draft = null;    // form draft (planting / container)
let lastRoute = '';

function blank() {
  return { format: 1, containers: [], plantings: [], tasks: [], customCrops: [], customVarieties: {}, created: todayStr(), lastBackup: null };
}
function save() { return DB.set('state', S).catch(e => alert('Could not save: ' + e)); }

const allCrops = () => CATALOG.concat(S.customCrops || []).map(dispCrop);
const crop = id => allCrops().find(c => c.id === id) || { id, en: 'Unknown crop', ja: '', color: '#6a9' };
const cropName = id => { const c = crop(id); return c.ja ? `${c.en} (${c.ja})` : c.en; };
const varieties = id => [...(crop(id).varieties || []), ...((S.customVarieties || {})[id] || [])];
const ic = (id, size = 22) => Icons.crop(id, size, crop(id).color);
const container = id => S.containers.find(c => c.id === id);
const planting = id => S.plantings.find(p => p.id === id);
const activeIn = cid => S.plantings.filter(p => p.containerId === cid && p.status !== 'harvested').sort((a, b) => a.from - b.from);
const typeLabel = c => c.type === 'bed' ? 'Bed' : c.type === 'round' ? 'Round pot' : 'Rectangular pot';
const sizeLabel = c => c.type === 'round' ? `⌀${c.diameter} × ${c.depth || '?'} cm deep` :
  c.type === 'bed' ? `${c.width} × ${c.length} cm` : `${c.width} × ${c.length} × ${c.depth || '?'} cm`;

function decorate(list) { return list.map(p => Object.assign({}, p, { _color: crop(p.cropId).color, _label: crop(p.cropId).en })); }
function gaps(c, excludeId) {
  const L = Draw.dims(c).L, out = [];
  let y = 0;
  for (const p of activeIn(c.id).filter(p => p.id !== excludeId)) { if (p.from - y >= 1) out.push([y, p.from]); y = Math.max(y, p.to); }
  if (L - y >= 1) out.push([y, L]);
  return out;
}
function prevCrop(c, from, to) {
  const h = (c.history || []).filter(x => x.from < to - 0.5 && x.to > from + 0.5);
  return h.length ? h[h.length - 1] : null;
}
function plotSVG(c, o = {}) {
  const { W, L } = Draw.dims(c);
  const px = o.width ? Math.min(o.width / W, (o.maxH || 1e9) / L) : (o.px || 2);
  const gs = o.gaps ? gaps(c).map(g => { const pc = prevCrop(c, g[0], g[1]); return [g[0], g[1], pc ? `empty · was ${crop(pc.cropId).en}` : '+ empty']; }) : [];
  const list = o.plantings || decorate(activeIn(c.id));
  return Draw.svg(c, list, Object.assign({}, o, { px, today: todayStr(), gaps: gs }));
}

// ---------- tasks ----------
const effDue = t => (!t.done && t.due < todayStr()) ? todayStr() : t.due;
const sortTasks = l => l.sort((a, b) => (effDue(a) < effDue(b) ? -1 : effDue(a) > effDue(b) ? 1 : 0));
function seriesTitle(s) {
  if (s.customTitle) return s.customTitle;
  const amt = s.amount ? ' ' + fmtAmt(s.amount, s.unit) : '';
  if (s.title) return s.title + (s.product ? ` – ${s.product}` : '') + amt;
  return 'Fertilise' + (s.product ? `: ${s.product}` : '') + amt;
}
function dueText(t) {
  const d = effDue(t), n = daysBetween(todayStr(), d);
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `${niceDate(d)} · in ${n} days`;
}
function taskLi(t, showCrop = true) {
  const { p, c } = taskOwner(t);
  const meta = [];
  if (t.kind === 'water') meta.push(`${CAN_ICON(22)}<span>${esc(t.note || '')}</span>`);
  else if (showCrop && p) meta.push(`${ic(p.cropId)}<b>${esc(crop(p.cropId).en)}</b>${c ? ' · ' + esc(c.name) : ''}`);
  else if (showCrop && c) meta.push(`${BED_ICON(20)}<b>${esc(c.name)}</b>`);
  if (!showCrop && !t.done) meta.push(dueText(t));
  if (t.done) meta.push('Done ' + shortDate(t.doneOn));
  return `<li class="task${t.done ? ' done' : ''}"><label class="chk"><input type="checkbox" data-task="${t.id}"${t.done ? ' checked' : ''}><span></span></label>
    <div class="tbody" data-act="editTask" data-id="${t.id}"><div class="tt">${esc(t.title)}${t.seriesId && !t.done ? ' <span class="rep">↻</span>' : ''}</div>
    ${meta.length ? `<div class="tm">${meta.join(' · ')}</div>` : ''}</div></li>`;
}
function upsertAuto(p, kind, want, due, title) {
  const open = S.tasks.find(t => t.plantingId === p.id && t.kind === kind && !t.done);
  const anyDone = S.tasks.some(t => t.plantingId === p.id && t.kind === kind && t.done);
  if (!want) { if (open) S.tasks = S.tasks.filter(x => x !== open); return; }
  if (open) { open.due = due; open.title = title; }
  else if (!anyDone) S.tasks.push({ id: uid(), plantingId: p.id, kind, title, due, done: false });
}
function syncTasks(p) {
  if (p.status === 'harvested') { S.tasks = S.tasks.filter(t => !(t.plantingId === p.id && !t.done)); return; }
  upsertAuto(p, 'thin', !p.no_thin && p.method === 'seed' && p.thinSp > 0 && !!p.thinDate && !p.thinned, p.thinDate,
    `Thin${p.thinStage ? ' (' + p.thinStage + ')' : ''} to ${p.thinSp} cm`);
  upsertAuto(p, 'harvest', !p.no_harvest && !!p.harvestDate, p.harvestDate, 'Earliest harvest – check crop');
  syncCareTasks(p);
  const ids = new Set((p.series || []).map(s => s.id));
  S.tasks = S.tasks.filter(t => !(t.plantingId === p.id && t.seriesId && !t.done && !ids.has(t.seriesId)));
  for (const s of p.series || []) {
    const open = S.tasks.find(t => t.seriesId === s.id && !t.done);
    const doneAny = S.tasks.some(t => t.seriesId === s.id && t.done);
    if (s.stopped) { if (open) S.tasks = S.tasks.filter(x => x !== open); continue; }
    if (open) { open.title = seriesTitle(s); if (!doneAny && s.start) open.due = s.start; }
    else if (!doneAny && s.start) S.tasks.push({ id: uid(), plantingId: p.id, kind: 'series', seriesId: s.id, title: seriesTitle(s), due: s.start, done: false });
  }
}
function redate(t, p, d) {
  if (t.kind === 'thin' && p) p.thinDoneOn = d;
  if (t.kind === 'germ' && p && p.germ) p.germ.date = d;
  if (t.spawned && p) {
    const nt = S.tasks.find(x => x.id === t.spawned && !x.done), s = (p.series || []).find(x => x.id === t.seriesId);
    if (nt && s && +s.every > 0) nt.due = addInterval(d, +s.every, s.per);
  }
}
function toggleTask(id, done) {
  const t = S.tasks.find(x => x.id === id); if (!t) return;
  const td = todayStr(), due = t.due;
  // ticking something that was due before today: ask when it was really done (handy for back-filling records)
  if (done && due && due < td && t.kind !== 'water') return whenDone(t, due, td);
  finishToggle(t, done, td);
}
function whenDone(t, due, td) {
  let picked = false;
  const close = modal(`<h3>When did you do this?</h3><p class="muted small">${esc(t.title)}</p>
    <div class="btns col"><button class="btn primary" data-w="${due}">On the planned day · ${shortDate(due)}</button><button class="btn" data-w="${td}">Today · ${shortDate(td)}</button></div>
    <form id="wdf" class="form"><label>Another day<input name="d" type="date" value="${due}" max="${td}"></label><div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn">Use this date</button></div></form>`, (m, cl) => {
    const done = d => { picked = true; cl(); finishToggle(t, true, d && d <= td ? d : td); };
    m.querySelectorAll('[data-w]').forEach(b => b.onclick = () => done(b.dataset.w));
    m.querySelector('#wdf').onsubmit = e => { e.preventDefault(); done(m.querySelector('#wdf').d.value); };
    m.querySelector('[data-x=no]').onclick = () => { cl(); render(); };
    m.onclick = e => { if (e.target === m) { cl(); if (!picked) render(); } };
  });
  return close;
}
function finishToggle(t, done, td) {
  const p = t.plantingId ? planting(t.plantingId) : null;
  if (done) {
    t.done = true; t.doneOn = td;
    if (t.kind === 'water') { t.prevLast = S.water && S.water.lastDone; S.water = Object.assign({}, S.water, { lastDone: td }); }
    if (t.kind === 'germ' && p) setTimeout(() => germDialog(p, td), 320);
    if (t.kind === 'thin' && p) { p.thinned = true; p.thinDoneOn = td; }
    if (t.seriesId && p) {
      const s = (p.series || []).find(x => x.id === t.seriesId);
      if (s && !s.stopped && +s.every > 0) {
        const nd = addInterval(td, +s.every, s.per);   // next one counts from the day it was actually done
        if (!s.end || nd <= s.end) {
          const nt = { id: uid(), plantingId: p.id, kind: 'series', seriesId: s.id, title: seriesTitle(s), due: nd, done: false };
          S.tasks.push(nt); t.spawned = nt.id;
        }
      }
    }
  } else {
    t.done = false; t.doneOn = null;
    if (t.kind === 'water') { S.tasks = S.tasks.filter(x => !(x.kind === 'water' && !x.done && x !== t)); S.water = Object.assign({}, S.water, { lastDone: t.prevLast || null }); }
    if (t.kind === 'germ' && p) p.germ = null;
    if (t.kind === 'thin' && p) { p.thinned = false; p.thinDoneOn = null; }
    if (t.spawned) { S.tasks = S.tasks.filter(x => !(x.id === t.spawned && !x.done)); t.spawned = null; }
  }
  save();
  setTimeout(render, 280);
}

// ---------- photos ----------
async function photoURL(id) {
  if (!id) return null;
  if (photoURLs[id]) return photoURLs[id];
  const b = await DB.getPhoto(id);
  return b ? (photoURLs[id] = URL.createObjectURL(b)) : null;
}
function hydrate(root = document) {
  $$('img[data-photo]', root).forEach(async img => { const u = await photoURL(img.dataset.photo); if (u) img.src = u; else img.closest('.ph')?.classList.add('missing'); });
}
async function compress(file) {
  let img;
  try { img = await createImageBitmap(file); } catch { img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }); }
  const max = 1800, sc = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return new Promise(r => cv.toBlob(r, 'image/jpeg', 0.85));
}
const blobToDataURL = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });

// ---------- modal ----------
function modal(html, mount) {
  const m = $('#modal');
  m.innerHTML = `<div class="sheet">${html}</div>`;
  m.hidden = false;
  const close = () => { m.hidden = true; m.innerHTML = ''; };
  m.onclick = e => { if (e.target === m) close(); };
  mount && mount(m, close);
  return close;
}
function confirmBox(msg, okLabel = 'OK', danger = false) {
  return new Promise(res => {
    modal(`<p class="msg">${msg}</p><div class="btns"><button class="btn" data-x="no">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-x="ok">${esc(okLabel)}</button></div>`,
      (m, close) => { m.querySelector('[data-x=no]').onclick = () => { close(); res(false); }; m.querySelector('[data-x=ok]').onclick = () => { close(); res(true); }; });
  });
}

// ---------- router ----------
function route() {
  const h = location.hash.slice(1) || '/';
  const [path, qs] = h.split('?');
  return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(qs || '') };
}
const SEKKI = [[1, 5, '小寒', 'Minor cold'], [1, 20, '大寒', 'Major cold'], [2, 4, '立春', 'Start of spring'], [2, 19, '雨水', 'Rain water'],
  [3, 5, '啓蟄', 'Insects awaken'], [3, 20, '春分', 'Spring equinox'], [4, 4, '清明', 'Clear & bright'], [4, 20, '穀雨', 'Grain rain'],
  [5, 5, '立夏', 'Start of summer'], [5, 21, '小満', 'Grain buds'], [6, 5, '芒種', 'Grain in ear'], [6, 21, '夏至', 'Summer solstice'],
  [7, 7, '小暑', 'Minor heat'], [7, 22, '大暑', 'Major heat'], [8, 7, '立秋', 'Start of autumn'], [8, 23, '処暑', 'End of heat'],
  [9, 7, '白露', 'White dew'], [9, 22, '秋分', 'Autumn equinox'], [10, 8, '寒露', 'Cold dew'], [10, 23, '霜降', 'Frost descends'],
  [11, 7, '立冬', 'Start of winter'], [11, 22, '小雪', 'Minor snow'], [12, 7, '大雪', 'Major snow'], [12, 21, '冬至', 'Winter solstice']];
function sekki(d = new Date()) {
  const md = (d.getMonth() + 1) * 100 + d.getDate();
  let cur = SEKKI[SEKKI.length - 1];
  for (const s of SEKKI) if (s[0] * 100 + s[1] <= md) cur = s;
  return `${cur[2]} · ${cur[3]}`;
}
function setChrome(title, { back = false, tab = null, kicker = '', sub = '', stats = '', big = false } = {}) {
  $('#title').textContent = title;
  $('#kicker').textContent = kicker;
  $('#sub').textContent = sub;
  $('#hstats').innerHTML = stats;
  $('#top').classList.toggle('big', big);
  $('#back').hidden = !back;
  $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
}
function render() {
  const { parts, q } = route();
  const key = location.hash;
  if (key !== lastRoute) { draft = null; lastRoute = key; window.scrollTo(0, 0); const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
  A = {};
  try { syncWater(); } catch (e) { console.warn(e); }
  let html = '', after = null;
  try {
    const [a, b, c] = parts;
    if (!a) ({ html, after } = pageHome());
    else if (a === 'cal') ({ html, after } = pageCalendar());
    else if (a === 'search') ({ html, after } = pageSearch(q));
    else if (a === 'map') ({ html, after } = pageMap(q));
    else if (a === 'review') ({ html, after } = pageReview(q));
    else if (a === 'compare') ({ html, after } = pageCompare(q));
    else if (a === 'container' && c === 'sections') ({ html, after } = pageSections(container(b)));
    else if (a === 'settings') ({ html, after } = pageSettings());
    else if (a === 'container' && b === 'new') ({ html, after } = pageContainerForm(null));
    else if (a === 'container' && c === 'edit') ({ html, after } = pageContainerForm(container(b)));
    else if (a === 'container') ({ html, after } = pageContainer(container(b)));
    else if (a === 'plant' && b === 'new') ({ html, after } = pagePlantForm(null, container(c), q));
    else if (a === 'plant' && c === 'edit') ({ html, after } = pagePlantForm(planting(b)));
    else if (a === 'sow') ({ html, after } = pageSow());
    else if (a === 'plant' && c === 'diary') ({ html, after } = pageDiary(planting(b), parts[3]));
    else if (a === 'plant' && c === 'photos') ({ html, after } = pagePhotos(planting(b)));
    else if (a === 'plant' && c === 'arrange') ({ html, after } = pageArrange(planting(b)));
    else if (a === 'plant') ({ html, after } = pagePlant(planting(b)));
    else html = notFound();
  } catch (e) { console.error(e); html = `<div class="empty-state">Something went wrong: ${esc(e.message)}<br><a href="#/">Home</a></div>`; }
  $('#view').innerHTML = html;
  hydrate();
  after && after();
}
const notFound = () => { setChrome('Not found', { back: true }); return `<div class="empty-state">That item no longer exists.<br><a class="btn" href="#/">Go home</a></div>`; };

// ---------- pages: home ----------
function homeMap() {
  ensureAreas();
  const aid = S.mapArea && S.areas.find(x => x.id === S.mapArea) ? S.mapArea : S.areas[0].id;
  A.harea = async el => { S.mapArea = el.dataset.id; await save(); render(); };
  setTimeout(() => { const b = $('#homemap'); if (b) b.addEventListener('click', e => { const g = e.target.closest('[data-cid]'); if (g) go('#/container/' + g.dataset.cid); }); });
  return `${S.areas.length > 1 ? `<div class="seg wrap">${S.areas.map(x => `<button type="button" data-act="harea" data-id="${x.id}" class="${x.id === aid ? 'on' : ''}">${esc(x.name)}</button>`).join('')}</div>` : ''}
    <div class="mapbox" id="homemap">${mapSVG(aid, { width: Math.min(window.innerWidth, 680) - 32 })}</div>
    <div class="btnrow"><a class="btn small" href="#/map?a=${aid}&edit=1">✥ Arrange map &amp; areas</a></div>`;
}
function pageHome() {
  const td = todayStr();
  const open = S.tasks.filter(t => !t.done && taskVisible(t));
  const today = sortTasks(open.filter(t => effDue(t) === td));
  const soon = open.filter(t => { const n = daysBetween(td, effDue(t)); return n > 0 && n <= 7; }).length;
  const card = c => {
    const ps = activeIn(c.id);
    const chips = ps.map(p => `<span class="chip">${ic(p.cropId)}${esc(crop(p.cropId).en)}</span>`).join('') || '<span class="chip muted">empty</span>';
    const { W, L } = Draw.dims(c);
    return `<a class="card" href="#/container/${c.id}"><div class="thumb">${plotSVG(c, { px: Math.min(150 / L, 150 / W), minPx: 1.2 })}</div>
      <div class="cname">${esc(c.name)}</div><div class="csize">${sizeLabel(c)}</div><div class="chips">${chips}</div></a>`;
  };
  const growing = S.plantings.filter(p => p.status !== 'harvested').length;
  setChrome('My Garden', { tab: 'home', big: true, kicker: pd(td).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }), sub: sekki(),
    stats: `<div><b>${today.length}</b><span>job${today.length === 1 ? '' : 's'} today</span></div><div><b>${growing}</b><span>growing</span></div>` });
  const beds = S.containers.filter(c => c.type === 'bed'), pots = S.containers.filter(c => c.type !== 'bed');
  let backupNote = '';
  if (S.plantings.length) {
    const n = S.lastBackup ? daysBetween(S.lastBackup, td) : null;
    if (n === null || n >= 14) backupNote = `<a class="banner" href="#/settings">💾 ${n === null ? 'No backup yet' : `Last backup ${n} days ago`} — tap to back up</a>`;
  }
  A.sowCrop = el => sowPick(el.dataset.id);
  const html = `${backupNote}
    ${Weather.section()}
    <section class="today"><h2>Today’s jobs</h2>
      ${today.length ? `<ul class="tasks">${today.map(t => taskLi(t)).join('')}</ul>` : '<p class="muted">Nothing to do today 🌤️</p>'}
      ${soon ? `<a class="more" href="#/cal">${soon} more in the next 7 days →</a>` : ''}</section>
    ${!S.containers.length ? `<div class="empty-state"><p>No beds or pots yet.</p><a class="btn primary" href="#/container/new">＋ Add a bed or pot</a></div>` : ''}
    ${S.containers.length ? `<div class="viewtog seg"><button type="button" data-act="hv" data-v="cards" class="${S.homeView !== 'map' ? 'on' : ''}">▦ Cards</button><button type="button" data-act="hv" data-v="map" class="${S.homeView === 'map' ? 'on' : ''}">🗺 Map</button></div>` : ''}
    ${S.homeView === 'map' && S.containers.length ? homeMap() : `
    ${beds.length ? `<h3 class="grp">Beds</h3><div class="grid">${beds.map(card).join('')}</div>` : ''}
    ${pots.length ? `<h3 class="grp">Pots &amp; bags</h3><div class="grid">${pots.map(card).join('')}</div>` : ''}`}
    ${sowNowSection()}
    <button class="fab" data-act="quick" aria-label="Quick add">＋</button>`;
  A.quick = () => quickAdd();
  A.hv = async el => { S.homeView = el.dataset.v; await save(); render(); };
  return { html, after: () => Weather.refresh().then(ch => { if (ch && !route().parts.length) render(); }) };
}

// ---------- pages: calendar ----------
function pageCalendar() {
  setChrome('Calendar', { tab: 'cal', kicker: niceDate(todayStr()), sub: sekki() });
  const td = todayStr();
  const open = sortTasks(S.tasks.filter(t => !t.done && taskVisible(t)));
  const groups = {};
  for (const t of open) (groups[effDue(t)] = groups[effDue(t)] || []).push(t);
  const keys = Object.keys(groups).sort();
  const head = d => { const n = daysBetween(td, d); return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : niceDate(d) + (n < 7 ? '' : ` · in ${n} days`); };
  let lastMonth = '';
  const html = keys.length ? keys.map(d => {
    const mth = pd(d).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const mh = mth !== lastMonth ? `<h2 class="month">${mth}</h2>` : ''; lastMonth = mth;
    return `${mh}<section class="day${d === td ? ' is-today' : ''}"><h3>${head(d)}</h3><ul class="tasks">${groups[d].map(t => taskLi(t)).join('')}</ul></section>`;
  }).join('') : `<div class="empty-state">No upcoming tasks.<br><small>Tasks come from your plantings — thinning, fertiliser, harvest, and anything you add.</small></div>`;
  return { html };
}

// ---------- pages: container ----------
function pageContainer(c) {
  if (!c) return { html: notFound() };
  setChrome(c.name, { back: true, kicker: typeLabel(c), sub: sizeLabel(c) });
  const ps = activeIn(c.id), gs = gaps(c);
  const vw = Math.min(window.innerWidth, 640) - 32;
  const hist = (c.history || []).slice().reverse();
  A.split = () => splitDialog(c);
  A.gap = el => { const [f, t] = el.dataset.gap.split(','); go(`#/plant/new/${c.id}?from=${f}&to=${t}`); };
  A.del = async () => {
    if (!await confirmBox(`Delete <b>${esc(c.name)}</b> and everything planted in it (including history)?`, 'Delete', true)) return;
    for (const p of S.plantings.filter(p => p.containerId === c.id)) await removePlanting(p, true);
    S.tasks = S.tasks.filter(t => t.containerId !== c.id);
    S.containers = S.containers.filter(x => x !== c); await save(); go('#/');
  };
  const html = `<div class="plotwrap">${plotSVG(c, { width: vw, maxH: window.innerHeight * 0.62, labels: true, gaps: true, showMargin: true, grid: true })}</div>
    <p class="hint center">${typeLabel(c)} · ${sizeLabel(c)}${c.margin ? ` · ${c.margin} cm edge margin` : ''}${c.type !== 'round' ? ' · top → bottom = long side' : ''}</p>
    <section><h3>Growing now</h3>
      ${ps.length ? `<ul class="plist">${ps.map(p => `<li><a href="#/plant/${p.id}">${ic(p.cropId)}
        <span class="grow"><b>${esc(cropName(p.cropId))}</b>${p.variety ? ` · ${esc(p.variety)}` : ''}<small>${c.type !== 'round' || p.from > 0 || p.to < Draw.dims(c).L ? `${p.from}–${p.to} cm · ` : ''}${p.method === 'seed' ? 'sown' : 'planted'} ${shortDate(p.sowDate)}</small></span>›</a></li>`).join('')}</ul>` : '<p class="muted">Nothing planted.</p>'}
      ${ps.length ? `<button class="btn wide primary" data-act="split">＋ Add another crop to this ${c.type === 'bed' ? 'bed' : 'pot'}</button>` : ''}
      ${gs.map(g => { const pc = prevCrop(c, g[0], g[1]); return `<button class="btn wide" data-act="gap" data-gap="${g[0]},${g[1]}">＋ Plant ${ps.length ? `in ${g[0]}–${g[1]} cm` : 'here'}${pc ? ` <small>(previously ${esc(crop(pc.cropId).en)})</small>` : ''}</button>`; }).join('')}
    </section>
    ${hist.length ? `<section><h3>History</h3><ul class="plist">${hist.map(h => `<li><a href="#/plant/${h.plantingId}">${ic(h.cropId)}<span class="grow">${esc(cropName(h.cropId))}${h.variety ? ' · ' + esc(h.variety) : ''}<small>${shortDate(h.sowDate)} → ${shortDate(h.harvestedOn)}${(() => { const hp = planting(h.plantingId); const n = hp ? harvestTotal(hp) : 0; return n ? ` · ${n} picked` : ''; })()}${c.type === 'bed' ? ` · ${h.from}–${h.to} cm` : ''}</small></span>›</a></li>`).join('')}</ul></section>` : ''}
    ${ps.length ? `<a class="btn small" href="#/container/${c.id}/sections">↕ Adjust sections by dragging</a>` : ''}
    ${bedSection(c)}
    ${c.notes ? `<section><h3>About this ${c.type === 'bed' ? 'bed' : 'pot'}</h3><p class="pre">${esc(c.notes)}</p></section>` : ''}
    <div class="btnrow"><a class="btn" href="#/container/${c.id}/edit">Edit ${typeLabel(c).toLowerCase()}</a><button class="btn danger" data-act="del">Delete</button></div>`;
  return { html, after: () => $$('.plotwrap [data-gap]').forEach(r => r.addEventListener('click', () => A.gap(r))) };
}

function pageContainerForm(c) {
  const isNew = !c;
  setChrome(isNew ? 'Add bed or pot' : 'Edit ' + c.name, { back: true, kicker: isNew ? 'New' : typeLabel(c) });
  if (!draft) draft = isNew ? { type: 'bed', name: '', width: 100, length: 200, diameter: 40, depth: 35, margin: 10, count: 1, notes: '' } : Object.assign({}, c);
  const d = draft;
  const html = `<form id="cf" class="form">
    ${isNew ? `<button type="button" class="btn wide preset" data-act="preset">🛍️ Fabric grow bag preset (40 L · ⌀40 × 35 cm)</button>` : ''}
    <label>Type<div class="seg">${[['bed', 'Bed'], ['round', 'Round pot / bag'], ['rect', 'Square / rect pot']].map(([v, l]) => `<button type="button" data-act="type" data-v="${v}" class="${d.type === v ? 'on' : ''}">${l}</button>`).join('')}</div></label>
    <label>Name<input name="name" value="${esc(d.name)}" placeholder="${d.type === 'bed' ? 'e.g. Plot A – north' : 'e.g. Bag'}" required></label>
    ${d.type === 'round' ? `<div class="two"><label>Diameter (cm)<input name="diameter" type="number" inputmode="decimal" value="${esc(d.diameter)}"></label><label>Depth (cm)<input name="depth" type="number" inputmode="decimal" value="${esc(d.depth)}"></label></div>` :
      `<div class="two"><label>Short side (cm)<input name="width" type="number" inputmode="decimal" value="${esc(d.width)}"></label><label>Long side (cm)<input name="length" type="number" inputmode="decimal" value="${esc(d.length)}"></label></div>
       ${d.type === 'rect' ? `<label>Depth (cm)<input name="depth" type="number" inputmode="decimal" value="${esc(d.depth)}"></label>` : ''}`}
    <label>Margin from edges (cm)<input name="margin" type="number" inputmode="decimal" value="${esc(d.margin)}"><small>First and last rows start this far in from the edge.</small></label>
    ${isNew ? `<label>How many?<input name="count" type="number" min="1" max="50" value="${esc(d.count)}"><small>More than 1 numbers them, e.g. “Bag 1”, “Bag 2”…</small></label>` : ''}
    ${(ensureAreas(), S.areas.length > 1) ? `<label>Area<select name="area">${S.areas.map(x => `<option value="${x.id}"${(d.area || S.areas[0].id) === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` : ''}
    <label>Notes<textarea name="notes" rows="2">${esc(d.notes || '')}</textarea></label>
    <div class="preview" id="cprev"></div>
    <button class="btn primary wide" type="submit">${isNew ? 'Add' : 'Save'}</button></form>`;
  const read = () => { const f = $('#cf'); for (const el of f.elements) if (el.name) d[el.name] = el.value; };
  const prev = () => { read(); const t = { id: 'prev', type: d.type, width: num(d.width) || 1, length: num(d.length) || 1, diameter: num(d.diameter) || 1, margin: num(d.margin) || 0 };
    if (t.type !== 'round' && t.width > t.length) [t.width, t.length] = [t.length, t.width];
    $('#cprev').innerHTML = Draw.svg(t, [], { px: Math.min(220 / Draw.dims(t).L, 260 / Draw.dims(t).W), showMargin: true, grid: true }); };
  A.type = el => { read(); d.type = el.dataset.v; if (d.type !== 'bed' && +d.margin === 10) d.margin = 2; if (d.type === 'bed' && +d.margin === 2) d.margin = 10; render(); };
  A.preset = () => { Object.assign(d, { type: 'round', name: d.name || 'Bag', diameter: 40, depth: 35, margin: 2, count: 12 }); render(); };
  const after = () => {
    prev();
    $('#cf').addEventListener('input', prev);
    $('#cf').addEventListener('submit', async e => {
      e.preventDefault(); read();
      const base = { type: d.type, margin: num(d.margin) ?? 0, notes: d.notes || '', area: d.area || (S.areas && S.areas[0] ? S.areas[0].id : null) };
      if (!isNew && c.area !== base.area) c.pos = null;
      if (d.type === 'round') { if (!(num(d.diameter) > 0)) return alert('Enter a diameter.'); Object.assign(base, { diameter: num(d.diameter), depth: num(d.depth) }); }
      else {
        let w = num(d.width), l = num(d.length);
        if (!(w > 0 && l > 0)) return alert('Enter both sides.');
        if (w > l) [w, l] = [l, w];
        Object.assign(base, { width: w, length: l, depth: d.type === 'rect' ? num(d.depth) : null });
      }
      const name = (d.name || '').trim() || (d.type === 'bed' ? 'Bed' : 'Pot');
      if (isNew) {
        const n = Math.max(1, Math.min(50, parseInt(d.count) || 1));
        for (let i = 0; i < n; i++) S.containers.push(Object.assign({ id: uid(), name: n > 1 ? `${name} ${i + 1}` : name, history: [], created: todayStr() }, base));
        await save(); draft = null; go(n > 1 ? '#/' : '#/container/' + S.containers[S.containers.length - 1].id);
      } else {
        const L = base.type === 'round' ? base.diameter : base.length;
        Object.assign(c, base, { name });
        for (const p of activeIn(c.id)) { if (p.to > L) p.to = L; if (p.from >= L) { p.from = 0; p.to = L; } }
        await save(); draft = null; history.back();
      }
    });
  };
  return { html, after };
}

// ---------- pages: planting form ----------
const LAYOUTS = [['rows', 'Rows'], ['continuous', 'Continuous line (drill)'], ['staggered', 'Staggered rows (offset, e.g. 3–4–3)'],
  ['scatter', 'Scattered / broadcast'], ['center', 'Single plant in the centre'], ['diamond', 'Diamond (4 plants)'], ['free', 'Custom – place each plant by hand']];

function applyCrop(d, cr, c) {
  d.cropId = cr.id; d.method = cr.method || 'seed';
  let lay = cr.layout || 'rows';
  if (c && c.type !== 'bed') lay = cr.pot || ((cr.spread || 0) >= 35 ? 'center' : lay);
  d.layout = lay;
  d.depth = cr.depth ?? ''; d.rowSp = cr.rowSp ?? ''; d.plantSp = cr.sowSp ?? '';
  d.thinStage = cr.thinStage || ''; d.thinSp = cr.thinSp ?? ''; d.spread = cr.spread ?? '';
  d.daysThin = cr.daysThin; d.daysHarvest = cr.daysHarvest; d.harvestManual = false; d.thinManual = false;
  d.dir = cr.dir || 'across'; d.rows = ''; d.variety = ''; d.sj = {};
  recalc(d);
}
function recalc(d) {
  if (!d.sowDate) return;
  if (!d.harvestManual && d.daysHarvest) d.harvestDate = addDays(d.sowDate, +d.daysHarvest);
  if (!d.thinManual && d.daysThin && d.method === 'seed' && d.thinSp) d.thinDate = addDays(d.sowDate, +d.daysThin);
}
function setPath(o, path, v) {
  const ks = path.split('.'); let cur = o;
  for (let i = 0; i < ks.length - 1; i++) cur = cur[ks[i]];
  cur[ks[ks.length - 1]] = v;
}

function pagePlantForm(p, c, q) {
  const isNew = !p;
  if (!isNew) c = container(p.containerId);
  if (!c) return { html: notFound() };
  const L = Draw.dims(c).L;
  if (!draft) {
    if (isNew) {
      const g = gaps(c)[0] || [0, L];
      draft = { containerId: c.id, from: num(q.get('from')) ?? g[0], to: num(q.get('to')) ?? g[1], sowDate: todayStr(), fert: [], series: [], notes: '', photos: {}, newPhotos: {}, removePhotos: {} };
      Object.assign(draft, { cropId: '', method: 'seed', layout: c.type === 'bed' ? 'rows' : 'center', depth: '', rowSp: '', plantSp: '', rows: '', thinStage: '', thinSp: '', spread: '', variety: '' });
      if (q.get('crop')) applyCrop(draft, crop(q.get('crop')), c);
    } else {
      draft = JSON.parse(JSON.stringify(p)); draft.newPhotos = {}; draft.removePhotos = {};
      draft.fert = draft.fert || []; draft.series = draft.series || []; draft.photos = draft.photos || {};
      draft.harvestManual = true; draft.thinManual = true;
    }
  }
  const d = draft;
  setChrome(isNew ? 'New planting' : 'Edit planting', { back: true, kicker: c.name });
  const cr = d.cropId ? crop(d.cropId) : null;
  const seed = d.method === 'seed';
  const rowish = ['rows', 'continuous', 'staggered'].includes(d.layout);
  const cropOpts = `<option value="">Choose a crop…</option>` + allCrops().map(x => `<option value="${x.id}"${x.id === d.cropId ? ' selected' : ''}>${esc(x.en)}${x.ja ? ' ' + esc(x.ja) : ''}</option>`).join('') + `<option value="__new">＋ Add a new crop…</option>`;
  const ph = slot => {
    const nb = d.newPhotos[slot], id = d.photos[slot];
    const img = nb ? `<img src="${URL.createObjectURL(nb)}">` : id && !d.removePhotos[slot] ? `<img data-photo="${id}">` : `<span>＋ ${slot === 'front' ? 'Front' : 'Back'}</span>`;
    return `<label class="phslot ph">${img}<input type="file" accept="image/*" data-slot="${slot}" hidden></label>${(nb || (id && !d.removePhotos[slot])) ? `<button type="button" class="link" data-act="rmPhoto" data-slot="${slot}">remove</button>` : ''}`;
  };
  const html = `<form id="pf" class="form">
    <div class="preview big" id="pprev"></div>
    <fieldset><legend>Crop</legend>
      <label>Crop<select name="cropId" id="cropSel">${cropOpts}</select></label>
      <label>Variety<input name="variety" list="vars" value="${esc(d.variety || '')}" placeholder="e.g. ${esc(cr ? (cr.varieties || [])[0] || '' : '')}" autocomplete="off">
        <datalist id="vars">${d.cropId ? varieties(d.cropId).map(v => `<option value="${esc(v)}">`).join('') : ''}</datalist>
        ${d.cropId ? `<button type="button" class="link" data-act="searchVar">🔎 Search this variety online</button>` : ''}</label>
      <label>Planting type<div class="seg">${[['seed', 'From seed'], ['seedling', 'Seedlings / tubers']].map(([v, l]) => `<button type="button" data-act="method" data-v="${v}" class="${d.method === v ? 'on' : ''}">${l}</button>`).join('')}</div></label>
      <label>Packet photos<div class="phrow">${ph('front')}${ph('back')}</div></label>
    </fieldset>
    <fieldset><legend>Where &amp; how</legend>
      <div id="rotWarn"></div>
      ${c.type === 'round' && !gaps(c, p && p.id).some(g => g[0] > 0 || g[1] < L) && d.from <= 0 && d.to >= L ? '' :
        `<div class="two"><label>From (cm from top)<input name="from" type="number" inputmode="decimal" value="${esc(d.from)}"></label><label>To (cm)<input name="to" type="number" inputmode="decimal" value="${esc(d.to)}"></label></div><small class="hint">Long side is ${L} cm. To share the bed with another crop, use only part of it — e.g. 0 to 90 — and plant the rest later.</small>`}
      <label>Layout<select name="layout">${LAYOUTS.map(([v, l]) => `<option value="${v}"${v === d.layout ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      ${d.layout === 'free' ? `<small class="hint">After saving, use “Arrange plants” on the crop page to drag plants into place.</small>` : ''}
      <label>${seed ? 'Sown' : 'Planted'} on<input name="sowDate" type="date" value="${esc(d.sowDate)}"></label>
      ${seed ? `<label>Sowing depth (cm)<input name="depth" type="number" step="0.1" inputmode="decimal" value="${esc(d.depth)}"></label>` : ''}
      <div class="two">
        <label>${seed ? 'Sowing distance' : 'Spacing between plants'} (cm)<input name="plantSp" type="number" step="0.5" inputmode="decimal" value="${esc(d.plantSp)}"></label>
        ${rowish ? `<label>Between rows (cm)<input name="rowSp" type="number" step="0.5" inputmode="decimal" value="${esc(d.rowSp)}"></label>` : ''}
      </div>
      ${rowish ? `<label>Row direction<select name="dir"><option value="across"${d.dir !== 'along' ? ' selected' : ''}>Across – rows stacked down the long side</option><option value="along"${d.dir === 'along' ? ' selected' : ''}>Lengthways – rows run down the long side</option></select></label>` : ''}
      ${rowish ? `<label>Number of rows<input name="rows" type="number" min="1" inputmode="numeric" value="${esc(d.rows)}" placeholder="auto">
        <small><span id="fitTxt"></span>If you enter a number, the rows are spread evenly between the margins.</small></label>` : ''}
      <small class="hint">Rows and plants start at the edge margin and are spread evenly, so actual spacing is never less than what you enter.</small>
    </fieldset>
    ${seed ? `<fieldset><legend>Thinning</legend>
      <label>When to thin<input name="thinStage" value="${esc(d.thinStage)}" placeholder="e.g. at 3 true leaves"></label>
      <div class="two"><label>Thin to (cm)<input name="thinSp" type="number" step="0.5" inputmode="decimal" value="${esc(d.thinSp)}"></label>
      <label>Approx. date<input name="thinDate" type="date" value="${esc(d.thinDate || '')}" data-manual="thinManual"></label></div>
      <small class="hint">Ticking the thinning task redraws the plot at the thinned spacing.</small></fieldset>` : ''}
    ${isNew && cr && (cr.jobs || []).length ? `<fieldset><legend>Suggested jobs</legend>
      ${cr.jobs.map((j, i) => `<label class="inl chkline"><input type="checkbox" name="sj.${i}"${d.sj && d.sj[i] === false ? '' : ' checked'}> <span>${esc(j[0])} <small>${j[1] ? `day ${j[1]}` : 'at planting'}${j[2] ? ` · then every ${j[2]} ${j[3]}${j[2] > 1 ? 's' : ''}` : ''}</small></span></label>`).join('')}
      <small class="hint">Untick any you don’t do. They become jobs on this crop’s page and the calendar.</small></fieldset>` : ''}
    <fieldset><legend>Harvest</legend>
      <div class="two"><label>Earliest harvest<input name="harvestDate" type="date" value="${esc(d.harvestDate || '')}" data-manual="harvestManual"></label>
      <label>Mature size (cm across)<input name="spread" type="number" inputmode="decimal" value="${esc(d.spread)}"></label></div>
      ${cr && cr.daysHarvest ? `<small class="hint">Catalogue estimate: about ${cr.daysHarvest} days from ${seed ? 'sowing' : 'planting'}. Change it to match the packet.</small>` : ''}
    </fieldset>
    <fieldset><legend>Starting fertiliser</legend>
      ${d.fert.map((f, i) => `<div class="fert"><input name="fert.${i}.product" value="${esc(f.product)}" placeholder="Product (e.g. 化成肥料 8-8-8)"><input name="fert.${i}.amount" type="number" inputmode="decimal" value="${esc(f.amount)}" placeholder="Amount">
        <select name="fert.${i}.unit">${unitOpts(f.unit)}</select><button type="button" class="x" data-act="rmFert" data-i="${i}">✕</button></div>`).join('')}
      <button type="button" class="btn small" data-act="addFert">＋ Add fertiliser</button>
      <small class="hint">Units: g, handfuls (1 handful ≈ ${HANDFUL_G} g of granular fertiliser), mL or L.</small>
    </fieldset>
    <fieldset><legend>Extra fertiliser &amp; repeating jobs</legend>
      ${d.series.map((s, i) => `<div class="series">
        <div class="fert">${s.title && !s.product ? `<input name="series.${i}.title" value="${esc(s.title)}">` : `<input name="series.${i}.product" value="${esc(s.product)}" placeholder="Product / job (e.g. 液肥)">`}<input name="series.${i}.amount" type="number" inputmode="decimal" value="${esc(s.amount)}" placeholder="Amount">
        <select name="series.${i}.unit">${unitOpts(s.unit)}</select><button type="button" class="x" data-act="rmSeries" data-i="${i}">✕</button></div>
        <div class="rep-row"><select name="series.${i}.every">${[0, 1, 2, 3, 4, 5, 6, 7, 10, 14].map(n => `<option value="${n}"${+s.every === n ? ' selected' : ''}>${n === 0 ? 'Once' : 'Every ' + n}</option>`).join('')}</select>
        ${+s.every > 0 ? `<select name="series.${i}.per">${['day', 'week', 'month'].map(u => `<option value="${u}"${s.per === u ? ' selected' : ''}>${u}${+s.every > 1 ? 's' : ''}</option>`).join('')}</select>` : ''}
        <label class="inl">${+s.every > 0 ? 'from' : 'on'} <input type="date" name="series.${i}.start" value="${esc(s.start || '')}"></label>
        ${+s.every > 0 ? `<label class="inl">until <input type="date" name="series.${i}.end" value="${esc(s.end || '')}"></label>` : ''}</div></div>`).join('')}
      <button type="button" class="btn small" data-act="addSeries">＋ Add fertiliser / job</button>
      <small class="hint">Repeating jobs: the next one is due counted from the day you actually tick it off.</small>
    </fieldset>
    <label>Notes<textarea name="notes" rows="3">${esc(d.notes || '')}</textarea></label>
    <button class="btn primary wide" type="submit">${isNew ? 'Save planting' : 'Save changes'}</button>
  </form>`;

  const read = () => {
    d.sj = d.sj || {};
    for (const el of $('#pf').elements) if (el.name) setPath(d, el.name, el.type === 'checkbox' ? el.checked : el.value);
    d.from = num(d.from) ?? 0; d.to = num(d.to) ?? L;
  };
  const preview = () => {
    const tmp = Object.assign({}, d, { id: p ? p.id : 'new', _color: cr ? cr.color : '#888', _label: cr ? cr.en : 'New', rows: num(d.rows), rowSp: num(d.rowSp), plantSp: num(d.plantSp), thinSp: num(d.thinSp), spread: num(d.spread) });
    tmp.thinned = p ? p.thinned : false;
    if (tmp.layout === 'free' && !(tmp.positions || []).length) tmp.positions = Draw.layout(c, Object.assign({}, tmp, { layout: 'rows' })).pts;
    const others = decorate(activeIn(c.id).filter(x => !p || x.id !== p.id));
    const vw = Math.min(window.innerWidth, 640) - 48;
    const ft = $('#fitTxt'); if (ft) { const n = Draw.fitRows(c, tmp); ft.textContent = n ? `${n} row${n > 1 ? 's' : ''} fit at ${tmp.rowSp} cm. ` : ''; $('#pf').rows.placeholder = n ? 'auto: ' + n : 'auto'; }
    const rw = $('#rotWarn');
    if (rw) { const rn = rotationNote(c, d.from, d.to, d.cropId, p ? p.sowDate : null, p && p.id); rw.className = rn ? (rn.same ? 'warn' : 'note') : ''; rw.innerHTML = rn ? rn.html : ''; }
    $('#pprev').innerHTML = Draw.svg(c, [...others, tmp], { px: Math.min(vw / Draw.dims(c).W, 300 / L), today: tmp.sowDate || todayStr(), highlight: tmp.id, labels: true, showMargin: true, grid: true });
    // also show a "grown" preview at harvest
  };
  A.searchVar = () => { read(); const q = `${cr ? cr.ja : ''} ${d.variety || ''} 種 まき方`.trim(); window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank', 'noopener'); };
  A.method = el => { read(); d.method = el.dataset.v; recalc(d); render(); };
  A.addFert = () => { read(); d.fert.push({ product: '', amount: '', unit: 'g' }); render(); };
  A.rmFert = el => { read(); d.fert.splice(+el.dataset.i, 1); render(); };
  A.addSeries = () => { read(); d.series.push({ id: uid(), product: '', amount: '', unit: 'mL', every: 2, per: 'week', start: addDays(d.sowDate || todayStr(), 14), end: '' }); render(); };
  A.rmSeries = el => { read(); d.series.splice(+el.dataset.i, 1); render(); };
  A.rmPhoto = el => { read(); const s = el.dataset.slot; if (d.newPhotos[s]) delete d.newPhotos[s]; else d.removePhotos[s] = true; render(); };

  const after = () => {
    const f = $('#pf');
    preview();
    f.addEventListener('input', e => {
      const n = e.target.name || '';
      if (e.target.dataset.manual) d[e.target.dataset.manual] = true;
      read();
      if (n === 'sowDate' || n === 'thinSp') { recalc(d); if (f.harvestDate) f.harvestDate.value = d.harvestDate || ''; if (f.thinDate) f.thinDate.value = d.thinDate || ''; }
      preview();
    });
    f.addEventListener('change', async e => {
      const n = e.target.name || '';
      if (n === 'cropId') {
        read();
        if (e.target.value === '__new') { e.target.value = d.cropId; return newCropDialog(id => { applyCrop(d, crop(id), c); d.method = 'seed'; render(); }); }
        const keepSow = d.sowDate; applyCrop(d, crop(e.target.value), c); d.sowDate = keepSow; recalc(d); return render();
      }
      if (n === 'layout' || n === 'dir' || /\.every$/.test(n)) { read(); return render(); }
      if (e.target.dataset.slot) {
        const file = e.target.files[0]; if (!file) return;
        read(); d.newPhotos[e.target.dataset.slot] = await compress(file); delete d.removePhotos[e.target.dataset.slot]; render();
      }
    });
    f.addEventListener('submit', async e => {
      e.preventDefault(); read();
      if (!d.cropId) return alert('Choose a crop first.');
      if (!(d.to > d.from)) return alert('“To” must be more than “From”.');
      if (d.from < 0 || d.to > L + 0.01) return alert(`Section must be within 0–${L} cm.`);
      const clash = activeIn(c.id).find(x => (!p || x.id !== p.id) && x.from < d.to - 0.01 && x.to > d.from + 0.01);
      if (clash) return alert(`That overlaps ${crop(clash.cropId).en} (${clash.from}–${clash.to} cm). Adjust From/To.`);
      await savePlanting(p, d, c);
    });
  };
  return { html, after };
}

async function savePlanting(p, d, c) {
  const isNew = !p;
  if (isNew) { p = { id: uid(), containerId: c.id, status: 'active', created: todayStr(), thinned: false, photos: {} }; S.plantings.push(p); }
  const fields = ['cropId', 'variety', 'method', 'layout', 'dir', 'sowDate', 'thinStage', 'thinDate', 'harvestDate', 'notes'];
  for (const k of fields) p[k] = d[k] || '';
  for (const k of ['from', 'to', 'depth', 'rowSp', 'plantSp', 'rows', 'thinSp', 'spread']) p[k] = num(d[k]);
  if (p.method !== 'seed') { p.depth = null; p.thinSp = null; p.thinDate = ''; p.thinStage = ''; }
  p.fert = (d.fert || []).filter(f => f.product || f.amount).map(f => ({ product: f.product, amount: num(f.amount), unit: f.unit || 'g' }));
  const oldSeries = p.series || [];
  p.series = (d.series || []).filter(s => s.product || s.amount || s.title).map(s => {
    const o = oldSeries.find(x => x.id === s.id) || {};
    return Object.assign(o, { id: s.id || uid(), title: s.title || '', product: s.product, amount: num(s.amount), unit: s.unit || 'mL', every: +s.every || 0, per: s.per || 'week', start: s.start || p.sowDate, end: s.end || '', customTitle: o.customTitle && s.product === o.product ? o.customTitle : '' });
  });
  if (isNew) {
    const cj = crop(p.cropId).jobs || [];
    cj.forEach((j, i) => { if (d.sj && d.sj[i] === false) return; p.series.push({ id: uid(), title: j[0], product: '', amount: null, unit: '', every: j[2] || 0, per: j[3] || 'week', start: addDays(p.sowDate || todayStr(), j[1] || 0), end: '' }); });
  }
  if (p.layout === 'free' && !(p.positions || []).length) p.positions = Draw.layout(c, Object.assign({}, p, { layout: 'rows' })).pts;
  // photos
  p.photos = p.photos || {};
  for (const slot of ['front', 'back']) {
    if (d.newPhotos[slot] || d.removePhotos[slot]) {
      if (p.photos[slot]) { await DB.delPhoto(p.photos[slot]); delete photoURLs[p.photos[slot]]; delete p.photos[slot]; }
    }
    if (d.newPhotos[slot]) { const id = uid(); await DB.putPhoto(id, d.newPhotos[slot]); p.photos[slot] = id; }
  }
  // remember custom variety
  if (p.variety && !varieties(p.cropId).includes(p.variety)) {
    S.customVarieties = S.customVarieties || {};
    (S.customVarieties[p.cropId] = S.customVarieties[p.cropId] || []).push(p.variety);
  }
  syncTasks(p);
  await save();
  draft = null;
  if (isNew) location.replace('#/plant/' + p.id); else history.back();
}

function newCropDialog(cb) {
  modal(`<h3>New crop</h3><form id="ncf" class="form">
    <label>English name<input name="en" required></label><label>Japanese name<input name="ja"></label>
    <label>Colour<input name="color" type="color" value="#5c9e48"></label>
    <label>Plant family<select name="family">${Object.entries(FAMILIES).map(([k, v]) => `<option value="${k}"${k === 'other' ? ' selected' : ''}>${v[0]} ${v[1]}</option>`).join('')}</select></label>
    <div class="two"><label>Days to earliest harvest<input name="daysHarvest" type="number" value="60"></label><label>Mature size (cm)<input name="spread" type="number" value="20"></label></div>
    <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary">Add crop</button></div></form>`, (m, close) => {
    m.querySelector('[data-x=no]').onclick = close;
    m.querySelector('#ncf').onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      const cr = { id: 'c_' + uid(), en: f.en.value.trim(), ja: f.ja.value.trim(), color: f.color.value, method: 'seed', layout: 'rows', depth: 1, rowSp: 20, sowSp: 5, thinStage: '', thinSp: null, daysThin: null, daysHarvest: num(f.daysHarvest), spread: num(f.spread), varieties: [], custom: true, family: f.family.value, sow: [] };
      S.customCrops.push(cr); await save(); close(); cb(cr.id);
    };
  });
}

// ---------- pages: planting ----------
function pagePlant(p) {
  if (!p) return { html: notFound() };
  const c = container(p.containerId), cr = crop(p.cropId), td = todayStr();
  setChrome(c ? c.name : 'Crop', { back: true, kicker: p.status === 'harvested' ? 'Grown in' : 'Growing in' });
  const open = sortTasks(S.tasks.filter(t => t.plantingId === p.id && !t.done));
  const done = S.tasks.filter(t => t.plantingId === p.id && t.done).sort((a, b) => (a.doneOn < b.doneOn ? 1 : -1));
  const sowN = p.sowDate ? daysBetween(p.sowDate, td) : null;
  const hvN = p.harvestDate ? daysBetween(td, p.harvestDate) : null;
  const harvested = p.status === 'harvested';
  const seed = p.method === 'seed';
  const L = c ? Draw.dims(c).L : 0;
  const rowish = ['rows', 'continuous', 'staggered'].includes(p.layout);
  const rowsUsed = c && rowish ? Draw.rowCount(c, p) : null;
  const plantsNow = c ? Draw.layout(c, p).pts.length : 0;
  const dl = [
    ['Planting', seed ? 'From seed' : 'Seedlings / tubers'],
    c && (p.from > 0 || p.to < L) ? ['Section', `${p.from}–${p.to} cm from top`] : null,
    ['Layout', (LAYOUTS.find(l => l[0] === p.layout) || [, p.layout])[1] + (rowish && p.dir === 'along' ? ' (lengthways)' : '') + (rowsUsed ? ` · ${rowsUsed} row${rowsUsed > 1 ? 's' : ''}` : '') + (plantsNow && p.layout !== 'continuous' ? ` · ${plantsNow} plants` : '')],
    seed && p.depth != null ? ['Sowing depth', p.depth + ' cm'] : null,
    p.plantSp != null ? [seed ? 'Sowing distance' : 'Plant spacing', p.plantSp + ' cm'] : null,
    rowish && p.rowSp != null ? ['Between rows', p.rowSp + ' cm'] : null,
    (() => { const gw = germWindow(p); return gw ? ['Germination', `expected ${shortDate(gw[0])}–${shortDate(gw[1])}${p.germ ? ` · <b>${p.germ.result}</b> (${shortDate(p.germ.date)})` : ''}`] : null; })(),
    seed && p.thinSp ? ['Thinning', `${p.thinStage ? p.thinStage + ' → ' : ''}${p.thinSp} cm${p.thinned ? ` ✓ done ${shortDate(p.thinDoneOn)}` : ` · around ${shortDate(p.thinDate)}`}`] : null,
    p.spread ? ['Mature size', `~${p.spread} cm across`] : null,
    c && !harvested ? ['Size in drawing', (() => { const now = Math.round(Draw.radius(p, td) * 2), full = Math.round(Math.max(1, +p.spread || Draw.spacingNow(p))); return `${now} cm across today (grows to ~${full} cm by ${p.harvestDate ? shortDate(p.harvestDate) : 'harvest'})${seed && +p.thinSp > 0 && !p.thinned ? ' · stays seedling-sized until thinning' : ''}`; })()] : null,
    (p.fert || []).length ? ['Starting fertiliser', p.fert.map(f => `${esc(f.product || 'fertiliser')}${f.amount != null ? ' ' + fmtAmt(f.amount, f.unit) : ''}`).join('<br>')] : null,
    (p.series || []).length ? ['Extra fertiliser / jobs', p.series.map(s => `${esc(seriesTitle(s))} · ${+s.every > 0 ? `every ${s.every} ${s.per}${s.every > 1 ? 's' : ''}${s.stopped ? ' (stopped)' : ''}` : 'once'}`).join('<br>')] : null,
    c ? ['Previous crop here', (() => { const rn = rotationNote(c, p.from, p.to, p.cropId, p.sowDate || '9', p.id); return rn ? esc(cropName(rn.prev.cropId)) + (rn.same ? ` <span class="warnchip">⚠ same family</span>` : '') : '—'; })()] : null,
  ].filter(Boolean);

  A.addTask = () => taskDialog(null, p);
  A.logHarvest = () => harvestDialog(p);
  A.editHarvest = el => harvestDialog(p, (p.harvests || []).find(h => h.id === el.dataset.id));
  A.harvest = async () => {
    if (!await confirmBox(`Mark <b>${esc(cr.en)}</b> as harvested and clear it from ${esc(c ? c.name : 'the bed')}?<br><small>It stays in the history.</small>`, 'Harvest finished')) return;
    p.status = 'harvested'; p.harvestedOn = td;
    if (c) (c.history = c.history || []).push({ plantingId: p.id, cropId: p.cropId, variety: p.variety, from: p.from, to: p.to, sowDate: p.sowDate, harvestedOn: td });
    syncTasks(p); await save(); go('#/container/' + c.id);
  };
  A.unharvest = async () => { p.status = 'active'; if (c) c.history = (c.history || []).filter(h => h.plantingId !== p.id); syncTasks(p); await save(); render(); };
  A.del = async () => {
    if (!await confirmBox(`Delete this ${esc(cr.en)} planting completely, including tasks and photos?`, 'Delete', true)) return;
    await removePlanting(p); await save(); location.replace('#/container/' + (c ? c.id : ''));
  };

  const html = `<div class="crophead" style="--c:${cr.color}">
      <div class="chtitle">${ic(p.cropId, 52)}<h2>${esc(cr.en)} <span class="ja">${esc(cr.ja)}</span></h2></div>
      <div class="datebar">
        <div><small>${seed ? 'Sown' : 'Planted'}</small><b>${shortDate(p.sowDate)}</b><small>${sowN == null ? '' : sowN === 0 ? 'today' : sowN > 0 ? sowN + ' days ago' : 'in ' + -sowN + ' days'}</small></div>
        <div><small>${harvested ? 'Harvested' : 'Harvest from'}</small><b>${harvested ? shortDate(p.harvestedOn) : shortDate(p.harvestDate)}</b><small>${harvested ? '' : hvN == null ? '' : hvN > 0 ? 'in ' + hvN + ' days' : '🧺 ready now'}</small></div>
      </div></div>
    ${(() => { const pb = pickBy(p); if (!pb || harvested) return ''; return `<p class="pickby${pb.date < td ? ' late' : ''}">${pb.cont ? `Picking season runs to about <b>${shortDate(pb.date)}</b>` : `Best picked by <b>${shortDate(pb.date)}</b>`} — after that ${esc(pb.late)}.</p>`; })()}
    <div class="varrow"><div class="grow"><small>Variety</small><div class="variety">${esc(p.variety || '—')}</div></div>
      <a class="packet ph" href="#/plant/${p.id}/photos">${p.photos && (p.photos.front || p.photos.back) ? `<img data-photo="${p.photos.front || p.photos.back}" alt="Seed packet">` : '<span>No packet photo<br><small>tap to view / add</small></span>'}</a></div>
    ${harvested ? `<div class="banner">This crop was harvested on ${niceDate(p.harvestedOn)}. <button class="link" data-act="unharvest">Undo</button></div>` : ''}
    <section><h3>To do</h3>
      ${open.length ? `<ul class="tasks">${open.map(t => taskLi(t, false)).join('')}</ul>` : '<p class="muted">Nothing to do.</p>'}
      ${harvested ? '' : `<button class="btn small" data-act="addTask">＋ Add task</button>`}</section>
    ${done.length ? `<details class="donelog"><summary>Done log (${done.length})</summary><ul class="tasks">${done.map(t => taskLi(t, false)).join('')}</ul></details>` : ''}
    ${harvestSection(p)}
    ${diarySection(p)}
    ${c ? `<section><h3>In ${esc(c.name)}</h3><a class="plotwrap small" href="#/container/${c.id}">${plotSVG(c, { width: Math.min(window.innerWidth, 640) - 32, maxH: 320, highlight: p.id, labels: true, grid: true, plantings: decorate(harvested ? [p] : activeIn(c.id)) })}</a>
      ${harvested ? '' : `<a class="btn small" href="#/plant/${p.id}/arrange">✥ Arrange plants by hand</a>`}</section>` : ''}
    <section><h3>Details</h3><dl class="details">${dl.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      ${p.notes ? `<p class="pre">${esc(p.notes)}</p>` : ''}</section>
    ${S.plantings.filter(x => x.cropId === p.cropId).length > 1 ? `<a class="btn small" href="#/compare?crop=${p.cropId}">📊 Compare with other years</a>` : ''}
    <div class="btnrow"><a class="btn" href="#/plant/${p.id}/edit">Edit</a>${harvested ? '' : `<button class="btn primary" data-act="harvest">🧺 Harvest finished</button>`}</div>
    <div class="btnrow"><button class="link danger" data-act="del">Delete planting</button></div>`;
  return { html, after: () => diaryAfter(p) };
}

async function removePlanting(p) {
  for (const id of [...Object.values(p.photos || {}), ...(p.diary || []).map(d => d.photo)]) { await DB.delPhoto(id); delete photoURLs[id]; }
  S.tasks = S.tasks.filter(t => t.plantingId !== p.id);
  S.plantings = S.plantings.filter(x => x !== p);
  const c = container(p.containerId);
  if (c) c.history = (c.history || []).filter(h => h.plantingId !== p.id);
}

// Task add/edit dialog
function taskDialog(t, p) {
  if (t && t.kind === 'water') return waterTaskDialog(t);
  if (t && !t.plantingId && t.containerId) return container(t.containerId) && bedTaskDialog(container(t.containerId), t);
  const isNew = !t;
  p = p || planting(t.plantingId);
  const s = t && t.seriesId ? (p.series || []).find(x => x.id === t.seriesId) : null;
  const every = s ? +s.every : 0;
  modal(`<h3>${isNew ? 'Add task' : 'Edit task'}</h3>
    <p class="muted small">${ic(p.cropId)} ${esc(cropName(p.cropId))}${container(p.containerId) ? ' · ' + esc(container(p.containerId).name) : ''}</p>
    <form id="tf" class="form">${isNew ? templatePicker() : ''}
      <label>Task<input name="title" value="${esc(t ? t.title : '')}" placeholder="e.g. Add support netting" required></label>
      <label>${t && t.done ? 'Done on' : 'Date'}<input name="due" type="date" value="${esc(t ? (t.done ? t.doneOn : effDue(t)) : todayStr())}"></label>
      ${(isNew || s) && !(t && t.done) ? `<div class="rep-row"><select name="every">${[0, 1, 2, 3, 4, 5, 6, 7, 10, 14].map(n => `<option value="${n}"${every === n ? ' selected' : ''}>${n === 0 ? 'Does not repeat' : 'Repeat every ' + n}</option>`).join('')}</select>
        <select name="per">${['day', 'week', 'month'].map(u => `<option value="${u}"${s && s.per === u ? ' selected' : ''}>${u}(s)</option>`).join('')}</select></div>
        <small class="hint">The next one is scheduled from the day you tick it off.</small>` : ''}
      <div class="btns">${isNew ? '' : `<button type="button" class="btn danger" data-x="del">Delete</button>`}${s && !t.done ? `<button type="button" class="btn" data-x="skip">Skip this one</button>` : ''}<button class="btn primary">Save</button></div>
      ${!isNew ? `<a class="link" href="#/plant/${p.id}" data-x="open">Open crop page →</a>` : ''}
    </form>`, (m, close) => {
    const f = m.querySelector('#tf'); wireTemplates(m, f);
    const op = m.querySelector('[data-x=open]'); if (op) op.onclick = () => close();
    f.onsubmit = async e => {
      e.preventDefault();
      const title = f.title.value.trim(), due = f.due.value || todayStr();
      const ev = f.every ? +f.every.value : 0, per = f.per ? f.per.value : 'week';
      if (isNew) {
        if (ev > 0) { const ns = { id: uid(), title, product: '', amount: null, unit: '', every: ev, per, start: due, end: '' }; (p.series = p.series || []).push(ns); syncTasks(p); }
        else S.tasks.push({ id: uid(), plantingId: p.id, kind: 'custom', title, due, done: false });
      } else {
        if (t.done) { t.doneOn = due; t.title = title; redate(t, p, due); }
        else { t.title = title; t.due = due; }
        if (s) {
          if (title !== seriesTitle(s)) s.customTitle = title;
          if (ev === 0) { s.every = 0; } else { s.every = ev; s.per = per; }
        }
      }
      await save(); close(); render();
    };
    const del = m.querySelector('[data-x=del]');
    if (del) del.onclick = async () => {
      close();
      if (s && !t.done) {
        if (!await confirmBox('Delete this repeating job? No more reminders will be created for it.', 'Delete', true)) return;
        s.stopped = true; S.tasks = S.tasks.filter(x => x !== t);
      } else {
        if (!await confirmBox('Delete this task?', 'Delete', true)) return;
        if (t.kind === 'thin' && t.done) { p.thinned = false; }
        S.tasks = S.tasks.filter(x => x !== t);
        if (t.kind === 'thin' || t.kind === 'harvest') p['no_' + t.kind] = true;
      }
      await save(); render();
    };
    const skip = m.querySelector('[data-x=skip]');
    if (skip) skip.onclick = async () => { t.due = addInterval(todayStr(), +s.every, s.per); await save(); close(); render(); };
  });
}

// ---------- pages: photos ----------
function pagePhotos(p) {
  if (!p) return { html: notFound() };
  setChrome('Seed packet', { back: true, kicker: cropName(p.cropId) });
  const ph = p.photos || {};
  const slot = (k, l) => `<figure class="bigphoto ph">${ph[k] ? `<img data-photo="${ph[k]}" alt="${l}">` : `<label class="phslot big"><span>＋ Add ${l.toLowerCase()}</span><input type="file" accept="image/*" data-slot="${k}" hidden></label>`}<figcaption>${l}${ph[k] ? ` · <label class="link">replace<input type="file" accept="image/*" data-slot="${k}" hidden></label>` : ''}</figcaption></figure>`;
  const html = `<h2 class="ptitle">${esc(cropName(p.cropId))}</h2>${p.variety ? `<p class="center">${esc(p.variety)}</p>` : ''}${slot('front', 'Front')}${slot('back', 'Back')}<p class="hint center">Pinch to zoom.</p>`;
  const after = () => $$('input[data-slot]').forEach(inp => inp.addEventListener('change', async () => {
    const f = inp.files[0]; if (!f) return;
    const blob = await compress(f), k = inp.dataset.slot;
    p.photos = p.photos || {};
    if (p.photos[k]) { await DB.delPhoto(p.photos[k]); delete photoURLs[p.photos[k]]; }
    const id = uid(); await DB.putPhoto(id, blob); p.photos[k] = id; await save(); render();
  }));
  return { html, after };
}


// ---------- drag areas that still let the page scroll ----------
// Touching something draggable (grab(target) true) blocks scrolling for that touch only;
// touching empty space scrolls as normal. While dragging near the top/bottom edge the page auto-scrolls.
function dragZone(box, grab) {
  box.style.touchAction = 'auto';
  box.addEventListener('touchstart', e => { if (grab(e.target)) e.preventDefault(); }, { passive: false });
  let last = null, raf = 0, onMove = null;
  const tick = () => {
    raf = 0; if (!last || !onMove) return;
    const H = window.innerHeight, top = 90, bot = H - 70;
    const dy = last.clientY > bot ? Math.min(18, (last.clientY - bot) / 3 + 4) : last.clientY < top ? -Math.min(18, (top - last.clientY) / 3 + 4) : 0;
    if (dy) { const y0 = window.scrollY; window.scrollBy(0, dy); if (window.scrollY !== y0) onMove(last); raf = requestAnimationFrame(tick); }
  };
  return {
    move(e, fn) { last = { clientX: e.clientX, clientY: e.clientY }; onMove = fn; if (!raf) raf = requestAnimationFrame(tick); },
    stop() { last = null; onMove = null; if (raf) cancelAnimationFrame(raf); raf = 0; },
  };
}

// ---------- pages: arrange ----------
function pageArrange(p) {
  if (!p) return { html: notFound() };
  const c = container(p.containerId);
  setChrome('Arrange plants', { back: true, kicker: crop(p.cropId).en + (c ? ' · ' + c.name : '') });
  if (!draft) draft = { pts: p.layout === 'free' ? (p.positions || []).map(q => q.slice()) : Draw.layout(c, p).pts.map(q => q.slice()), mode: 'move' };
  const d = draft;
  const vw = Math.min(window.innerWidth, 640) - 32;
  const { W, L } = Draw.dims(c);
  const px = Math.min(vw / W, (window.innerHeight * 0.6) / L);
  const draw = () => {
    const tmp = decorate([Object.assign({}, p, { layout: 'free', positions: d.pts })])[0];
    const others = decorate(activeIn(c.id).filter(x => x.id !== p.id));
    $('#arr').innerHTML = Draw.svg(c, [...others, tmp], { px, today: todayStr(), highlight: p.id, edit: p.id, showMargin: true, grid: true });
    $('#cnt').textContent = `${d.pts.length} plant${d.pts.length === 1 ? '' : 's'}`;
  };
  A.mode = el => { d.mode = el.dataset.v; $$('[data-act=mode]').forEach(b => b.classList.toggle('on', b.dataset.v === d.mode)); };
  A.reset = () => { d.pts = Draw.layout(c, Object.assign({}, p, { layout: p.layout === 'free' ? 'rows' : p.layout })).pts.map(q => q.slice()); draw(); };
  A.clear = () => { d.pts = []; draw(); };
  A.save = async () => { p.layout = 'free'; p.positions = d.pts.map(q => [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10]); await save(); draft = null; history.back(); };
  const html = `<p class="hint">Drag plants to where they really are. Switch to “Add” and tap to add a plant, or “Remove” and tap one to remove it.</p>
    <div class="seg">${[['move', '✥ Move'], ['add', '＋ Add'], ['remove', '✕ Remove']].map(([v, l]) => `<button type="button" data-act="mode" data-v="${v}" class="${d.mode === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="plotwrap" id="arr"></div><p class="center muted" id="cnt"></p>
    <div class="btnrow"><button class="btn" data-act="reset">Reset to pattern</button><button class="btn" data-act="clear">Clear all</button></div>
    <button class="btn primary wide" data-act="save">Save arrangement</button>`;
  const after = () => {
    draw();
    const box = $('#arr');
    let drag = null;
    const toCm = e => { const svg = box.querySelector('svg'); const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const r = pt.matrixTransform(svg.getScreenCTM().inverse()); return [r.x, r.y]; };
    const clampIn = q => { q[0] = Math.max(0, Math.min(W, q[0])); q[1] = Math.max(0, Math.min(L, q[1])); return q; };
    box.addEventListener('pointerdown', e => {
      const circ = e.target.closest('circle[data-i]');
      if (d.mode === 'move' && circ) { drag = +circ.dataset.i; box.setPointerCapture(e.pointerId); e.preventDefault(); }
      else if (d.mode === 'remove' && circ) { d.pts.splice(+circ.dataset.i, 1); draw(); }
      else if (d.mode === 'add') { const q = clampIn(toCm(e)); if (Draw.inside(c, q[0], q[1])) { d.pts.push(q); draw(); } }
    });
    const dz = dragZone(box, t => d.mode !== 'move' || !!t.closest('circle[data-i]'));
    const mv = e => {
      if (drag == null) return;
      const q = clampIn(toCm(e)); d.pts[drag] = q;
      const el = box.querySelector(`circle[data-i="${drag}"]`); if (el) { el.setAttribute('cx', q[0]); el.setAttribute('cy', q[1]); }
    };
    box.addEventListener('pointermove', e => { if (drag == null) return; mv(e); dz.move(e, mv); });
    const end = () => { dz.stop(); if (drag != null) { drag = null; draw(); } };
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  };
  return { html, after };
}

// ---------- pages: settings ----------
function pageSettings() {
  setChrome('Tools', { tab: 'settings', kicker: 'Backup, weather & settings' });
  A.export = exportBackup;
  A.import = () => $('#impf').click();
  A.delCrop = async el => {
    const id = el.dataset.id;
    if (S.plantings.some(p => p.cropId === id)) return alert('This crop is used by a planting, so it can’t be deleted.');
    if (!await confirmBox('Delete this custom crop?', 'Delete', true)) return;
    S.customCrops = S.customCrops.filter(c => c.id !== id); await save(); render();
  };
  A.delVar = async el => { const { id, v } = el.dataset; S.customVarieties[id] = (S.customVarieties[id] || []).filter(x => x !== v); await save(); render(); };
  A.newCrop = () => newCropDialog(() => render());
  A.persist = async () => { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist().catch(() => false); storageNote(true); };
  const cv = Object.entries(S.customVarieties || {}).filter(([, l]) => l.length);
  A.lang = async el => { S.lang = el.dataset.v; await save(); render(); };
  A.waterTog = async () => { S.water = Object.assign({}, S.water, { on: !(S.water && S.water.on === false) ? false : true }); await save(); render(); };
  const html = `${themeSettings()}
    <section><h3>Crop names</h3><div class="seg"><button type="button" data-act="lang" data-v="en" class="${S.lang !== 'ja' ? 'on' : ''}">English first</button><button type="button" data-act="lang" data-v="ja" class="${S.lang === 'ja' ? 'on' : ''}">日本語 first</button></div></section>
    <section><h3>Watering reminders</h3><p>One daily job for pots &amp; bags, spaced by season and skipped after rain (needs the weather location below for the rain check).</p>
      <div class="btnrow"><button class="btn small" data-act="waterTog">${S.water && S.water.on === false ? 'Turn on' : 'Turn off'}</button></div></section>
    <section><h3>Records</h3><div class="btnrow"><a class="btn" href="#/review">📒 Season review</a><a class="btn" href="#/compare">📊 Compare years</a></div><div class="btnrow"><a class="btn" href="#/map">🗺 Garden map</a></div></section>
    ${harvestTotalsSection()}<section><h3>Backup</h3>
      <p>Everything is stored only on this phone. Back up regularly and save the file to Proton Drive or Google Drive.</p>
      <p class="muted">Last backup: ${S.lastBackup ? niceDate(S.lastBackup) : 'never'}</p>
      <div class="btnrow"><button class="btn primary" data-act="export">💾 Export backup</button><button class="btn" data-act="import">Restore from backup…</button></div>
      <input type="file" id="impf" accept=".json,application/json,text/plain" hidden>
      <p class="hint" id="persist"></p></section>
    ${weatherSettings()}
    <section><h3>Custom crops</h3>
      ${S.customCrops.length ? `<ul class="plist">${S.customCrops.map(c => `<li>${ic(c.id)}<span class="grow">${esc(c.en)} ${esc(c.ja)}</span><button class="link danger" data-act="delCrop" data-id="${c.id}">delete</button></li>`).join('')}</ul>` : '<p class="muted">None yet.</p>'}
      <button class="btn small" data-act="newCrop">＋ Add crop</button></section>
    <section><h3>Your varieties</h3>
      ${cv.length ? `<ul class="plist">${cv.flatMap(([id, l]) => l.map(v => `<li>${ic(id)}<span class="grow">${esc(v)} <small>${esc(crop(id).en)}</small></span><button class="link danger" data-act="delVar" data-id="${id}" data-v="${esc(v)}">delete</button></li>`)).join('')}</ul>` : '<p class="muted">Varieties you type in that aren’t in the catalogue are remembered here.</p>'}</section>
    <section><h3>Catalogue</h3><p class="muted">${CATALOG.length} built-in crops with about 5 varieties each. Values are typical starting points — always check the packet.</p>
      <details><summary>Show crops</summary><ul class="plist">${CATALOG.map(c => `<li>${ic(c.id)}<span class="grow">${esc(c.en)} ${esc(c.ja)}<small>${c.varieties.map(esc).join('、')}</small></span></li>`).join('')}</ul></details></section>
    <p class="hint center">Garden Planner · v${APP_VERSION}</p>`;
  const after = async () => {
    $('#impf').addEventListener('change', e => importBackup(e.target.files[0]));
    storageNote();
  };
  return { html, after };
}

async function storageNote(retried) {
  const el = $('#persist'); if (!el) return;
  const ok = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted().catch(() => false) : false;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let t;
  if (ok) t = '🔒 Storage is marked as protected — the phone won’t clear it on its own.';
  else if (ios && installed) t = '🔒 Installed on your Home Screen, so iOS keeps this app’s data (it isn’t cleared like ordinary Safari websites). It’s only lost if you delete the app from the Home Screen — keep exporting backups.';
  else if (ios) t = 'ℹ️ Opened in Safari: Safari may clear data for sites you haven’t visited in a while. Use Share → <b>Add to Home Screen</b> and open the app from there — keep your data by exporting a backup first and restoring it in the installed app.';
  else if (installed) t = `ℹ️ Your phone’s browser hasn’t marked storage as “protected”. It decides this itself (there’s no setting to force it) and normally only clears app data when the phone is almost out of space. Your backups are the real safety net. <button class="link" data-act="persist">${retried ? 'Still not granted — try again' : 'Ask again'}</button>`;
  else t = 'ℹ️ Opened in the browser. Install it (browser menu → <b>Install app</b> / Add to Home screen) for the safest storage, and keep exporting backups.';
  el.innerHTML = t;
}
async function exportBackup() {
  const photos = {};
  for (const k of await DB.photoKeys()) { const b = await DB.getPhoto(k); if (b) photos[k] = await blobToDataURL(b); }
  const name = `garden-backup-${todayStr()}.json`;
  const data = JSON.stringify({ app: 'garden-planner', format: 1, exported: new Date().toISOString(), state: S, photos });
  const markDone = async () => { S.lastBackup = todayStr(); await save(); render(); };
  const file = new File([data], name, { type: 'application/json' });
  const txt = new File([data], name.replace('.json', '.txt'), { type: 'text/plain' });
  for (const f of [file, txt]) {
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], title: name }); return markDone(); }
      catch (e) { if (e.name === 'AbortError') return; }
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  markDone();
}
async function importBackup(file) {
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { return alert('That file is not a Garden Planner backup.'); }
  if (!data || data.app !== 'garden-planner' || !data.state) return alert('That file is not a Garden Planner backup.');
  if (!await confirmBox(`Restore the backup from <b>${new Date(data.exported).toLocaleString('en-GB')}</b>?<br>This replaces everything currently in the app.`, 'Restore', true)) return;
  await DB.clearPhotos();
  for (const k of Object.keys(photoURLs)) delete photoURLs[k];
  for (const [k, u] of Object.entries(data.photos || {})) { const b = await (await fetch(u)).blob(); await DB.putPhoto(k, b); }
  S = Object.assign(blank(), data.state);
  applyTheme();
  await save(); alert('Backup restored.'); go('#/');
}

// ---------- boot ----------
const APP_VERSION = '1.3.5';
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (el.dataset.act === 'editTask') { const t = S.tasks.find(x => x.id === el.dataset.id); if (t) taskDialog(t); return; }
  if (A[el.dataset.act]) { e.preventDefault(); A[el.dataset.act](el); }
});
document.addEventListener('change', e => { if (e.target.matches('input[data-task]')) toggleTask(e.target.dataset.task, e.target.checked); });
$('#back').addEventListener('click', () => { if (history.length > 1) history.back(); else go('#/'); });
window.addEventListener('hashchange', render);
// re-render on a new day (tasks roll forward)
let lastDay = todayStr();
document.addEventListener('visibilitychange', () => { if (!document.hidden && todayStr() !== lastDay) { lastDay = todayStr(); render(); } });

(async () => {
  try { S = Object.assign(blank(), await DB.get('state') || {}); }
  catch (e) { S = blank(); alert('Storage is unavailable in this browser mode — changes will not be saved.'); }
  applyTheme();
  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
