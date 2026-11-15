/* Seedlings raised in cell trays and small pots, then planted out into a bed/bag or thrown away. */
'use strict';

const NURSERY = {
  tray: { en: '49-cell tray', unit: 'cell', size: '28.5 × 28.5 cm · 7 × 7 cells · 3.5 cm deep', cells: 49, cols: 7 },
  pot: { en: '9 cm pots', unit: 'pot', size: '⌀9 × 7.5 cm deep' },
};
// typical days from sowing to planting out (cell tray / 9 cm pot) — 本葉の枚数 is the real sign
const TRANSPLANT = {
  hakusai: [22, '本葉4–5枚'], cabbage: [30, '本葉5–6枚'], broccoli: [30, '本葉5–6枚'], cauliflower: [30, '本葉5–6枚'], lettuce: [28, '本葉4–5枚'],
  chingensai: [20, '本葉3–4枚'], komatsuna: [18, '本葉3枚'], mizuna: [20, '本葉3–4枚'], shungiku: [25, '本葉4–5枚'], nanohana: [25, '本葉4–5枚'],
  naganegi: [55, '草丈20 cm'], hatamanegi: [55, '草丈20 cm'], onion: [55, '草丈20–25 cm, 鉛筆の太さ'], celery: [70, '本葉6–8枚'],
  tomato: [55, '第1花房の開花前後'], minitomato: [55, '第1花房の開花前後'], nasu: [70, '本葉7–8枚, 一番花の蕾'], piman: [70, '本葉10枚前後, 一番花の蕾'],
  shishito: [70, '本葉10枚前後'], chilli: [70, '本葉10枚前後'], kyuri: [28, '本葉3–4枚'], zucchini: [28, '本葉3–4枚'],
  edamame: [14, '初生葉が開いた頃'], ingen: [14, '初生葉が開いた頃'], snappea: [21, '本葉3–4枚'], sayaendo: [21, '本葉3–4枚'],
  soramame: [25, '本葉2–3枚'], corn: [20, '本葉3枚'], strawberry: [40, '本葉3枚'], daikon: [0, 'roots resent moving — sow direct'], carrot: [0, 'roots resent moving — sow direct'],
};
const tpDays = id => (TRANSPLANT[id] || [30])[0] || 25;
const DISCARD = ['Spare / too many', 'Weak or leggy', 'Pests or disease', 'Died / dried out'];

const start = id => (S.starts || []).find(s => s.id === id);
const startLeft = s => (s.count || 0) - (s.events || []).reduce((a, e) => a + (+e.n || 0), 0);
const startsGrowing = () => (S.starts || []).filter(s => s.status === 'growing');
const startWhere = s => s.kind === 'tray' ? `Tray ${s.tray || 1}` : NURSERY.pot.en;
function trayFree(no, exceptId) {
  return NURSERY.tray.cells - startsGrowing().filter(s => s.kind === 'tray' && (s.tray || 1) === no && s.id !== exceptId).reduce((a, s) => a + startLeft(s), 0);
}
function trayNos() { return [...new Set(startsGrowing().filter(s => s.kind === 'tray').map(s => s.tray || 1))].sort((a, b) => a - b); }

// ---------- tasks ----------
function syncStartTasks(s) {
  const mine = S.tasks.filter(t => t.startId === s.id && !t.done);
  if (s.status !== 'growing') { S.tasks = S.tasks.filter(t => !mine.includes(t)); return; }
  const upsert = (kind, want, due, title) => {
    const open = mine.find(t => t.kind === kind), anyDone = S.tasks.some(t => t.startId === s.id && t.kind === kind && t.done);
    if (!want) { if (open) S.tasks = S.tasks.filter(x => x !== open); return; }
    if (open) Object.assign(open, { due, title }); else if (!anyDone) S.tasks.push({ id: uid(), startId: s.id, kind, title, due, done: false });
  };
  const gw = germWindow({ cropId: s.cropId, method: 'seed', sowDate: s.sowDate });
  upsert('sgerm', !!gw && !s.upOn && !s.no_sgerm, gw && gw[1], gw ? `Check seedlings are up (expected ${shortDate(gw[0])}–${shortDate(gw[1])})` : '');
  const tp = TRANSPLANT[s.cropId];
  upsert('transplant', !s.no_transplant, addDays(s.sowDate, tpDays(s.cropId)), `Plant out seedlings${tp && tp[1] ? ` (${tp[1]})` : ''}`);
}
function startTaskMeta(t) {
  const s = start(t.startId); if (!s) return '';
  return `${ic(s.cropId)}<b>${esc(crop(s.cropId).en)}</b> · 🌱 ${esc(startWhere(s))}`;
}

// ---------- drawing ----------
function traySVG(no, px = 22) {
  const cols = NURSERY.tray.cols, cells = [];
  for (const s of startsGrowing().filter(s => s.kind === 'tray' && (s.tray || 1) === no).sort((a, b) => (a.created || '') < (b.created || '') ? -1 : 1))
    for (let i = 0; i < startLeft(s); i++) cells.push(s);
  const W = cols * px + 6;
  let g = `<rect x="1" y="1" width="${W - 2}" height="${W - 2}" rx="5" fill="#2f2a26"/>`;
  for (let i = 0; i < NURSERY.tray.cells; i++) {
    const x = 3 + (i % cols) * px, y = 3 + Math.floor(i / cols) * px, s = cells[i];
    g += `<rect x="${x + 1}" y="${y + 1}" width="${px - 2}" height="${px - 2}" rx="3" fill="${s ? '#6b4f36' : '#4a403a'}"/>`;
    if (s) g += `<circle cx="${x + px / 2}" cy="${y + px / 2}" r="${px * (s.upOn ? .36 : .14)}" fill="${crop(s.cropId).color || '#7fb069'}" stroke="#1f1a16" stroke-width=".8"/>`;
  }
  return `<svg class="tray" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}">${g}</svg>`;
}
function potsSVG(list, px = 26) {
  const all = []; list.forEach(s => { for (let i = 0; i < startLeft(s); i++) all.push(s); });
  if (!all.length) return '';
  const cols = Math.min(all.length, 8), rows = Math.ceil(all.length / cols), W = cols * px + 4, H = rows * px + 4;
  return `<svg class="tray" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${all.map((s, i) => { const cx = 2 + (i % cols) * px + px / 2, cy = 2 + Math.floor(i / cols) * px + px / 2;
    return `<circle cx="${cx}" cy="${cy}" r="${px * .45}" fill="#3a3230"/><circle cx="${cx}" cy="${cy}" r="${px * .36}" fill="#6b4f36"/><circle cx="${cx}" cy="${cy}" r="${px * (s.upOn ? .26 : .1)}" fill="${crop(s.cropId).color || '#7fb069'}" stroke="#1f1a16" stroke-width=".8"/>`; }).join('')}</svg>`;
}

// ---------- page ----------
function pageSeedlings() {
  setChrome('Seedlings', { back: true, kicker: 'Trays & small pots' });
  const td = todayStr(), grow = startsGrowing();
  const card = s => {
    const left = startLeft(s), age = daysBetween(s.sowDate, td), ready = addDays(s.sowDate, tpDays(s.cropId)), n = daysBetween(td, ready), tp = TRANSPLANT[s.cropId];
    return `<li class="start"><div class="srow"><span class="lic">${ic(s.cropId, 28)}</span><span class="grow"><b>${esc(crop(s.cropId).en)}</b>${s.variety ? ` · ${esc(s.variety)}` : ''}
      <small>${left} ${NURSERY[s.kind].unit}${left === 1 ? '' : 's'} · ${esc(startWhere(s))}${s.seeds ? ` · ${s.seeds} seed${s.seeds > 1 ? 's' : ''} each` : ''}</small>
      <small>Sown ${shortDate(s.sowDate)} (${age} day${age === 1 ? '' : 's'})${s.upOn ? ` · up ${shortDate(s.upOn)}` : ''} · ${n > 0 ? `ready in ~${n} days` : n === 0 ? 'ready about now' : 'ready to plant out'}${tp && tp[1] ? ` (${esc(tp[1])})` : ''}</small>
      ${s.notes ? `<small>${esc(s.notes)}</small>` : ''}</span><button class="tmore" data-act="editStart" data-id="${s.id}" aria-label="Edit">⋯</button></div>
      <div class="btnrow"><button class="btn small primary" data-act="plantOut" data-id="${s.id}">🌱 Plant out</button><button class="btn small" data-act="binStart" data-id="${s.id}">🗑 Discard</button>${!s.upOn ? `<button class="btn small" data-act="upStart" data-id="${s.id}">They’re up</button>` : ''}</div></li>`;
  };
  const trays = trayNos(), pots = grow.filter(s => s.kind === 'pot');
  const past = (S.starts || []).filter(s => s.status !== 'growing').sort((a, b) => (a.sowDate < b.sowDate ? 1 : -1)).slice(0, 30);
  A.newStart = () => startDialog();
  A.editStart = el => startDialog(start(el.dataset.id));
  A.plantOut = el => plantOutDialog(start(el.dataset.id));
  A.binStart = el => discardDialog(start(el.dataset.id));
  A.upStart = async el => { const s = start(el.dataset.id); s.upOn = td; syncStartTasks(s); await save(); render(); };
  const html = `
    ${!grow.length ? `<div class="empty-state"><p>No seedlings on the go.</p></div>` : ''}
    ${trays.map(no => `<section><h3>Tray ${no} <small class="muted">· ${trayFree(no)} of 49 cells free</small></h3><div class="traywrap">${traySVG(no)}</div>
      <ul class="plist starts">${grow.filter(s => s.kind === 'tray' && (s.tray || 1) === no).map(card).join('')}</ul></section>`).join('')}
    ${pots.length ? `<section><h3>9 cm pots <small class="muted">· ${pots.reduce((a, s) => a + startLeft(s), 0)} in use</small></h3><div class="traywrap">${potsSVG(pots)}</div><ul class="plist starts">${pots.map(card).join('')}</ul></section>` : ''}
    <div class="btnrow"><button class="btn primary" data-act="newStart">＋ Start seedlings</button></div>
    <p class="hint">Tray: ${NURSERY.tray.size}. Pots: ${NURSERY.pot.size}. Small cells dry out fast — check them every day, and harden seedlings off outside for a few days before planting out.</p>
    ${past.length ? `<details><summary>Finished (${past.length})</summary><ul class="plist log">${past.map(s => `<li class="logi"><div class="lrow"><span class="lic">${ic(s.cropId)}</span><span class="grow"><b>${esc(crop(s.cropId).en)}</b>${s.variety ? ` · ${esc(s.variety)}` : ''}<small>${s.count} ${NURSERY[s.kind].unit}s sown ${shortDate(s.sowDate)} · ${(s.events || []).map(e => e.type === 'out' ? `${e.n} planted in ${esc((container((planting(e.pid) || {}).containerId) || {}).name || 'a bed')} ${shortDate(e.date)}` : `${e.n} discarded ${shortDate(e.date)}${e.reason ? ` (${esc(e.reason.toLowerCase())})` : ''}`).join(' · ')}</small></span></div></li>`).join('')}</ul></details>` : ''}`;
  return { html };
}
function seedlingsHomeSection() {
  const grow = startsGrowing(); if (!grow.length) return '';
  const td = todayStr();
  return `<h3 class="grp">Seedlings</h3><a class="card wide" href="#/seedlings"><div class="chips">${grow.map(s => { const n = daysBetween(td, addDays(s.sowDate, tpDays(s.cropId)));
    return `<span class="chip">${ic(s.cropId)}${esc(crop(s.cropId).en)} ×${startLeft(s)}${n <= 0 ? ' · ready' : ''}</span>`; }).join('')}</div><div class="csize">${trayNos().map(n => 'Tray ' + n).concat(grow.some(s => s.kind === 'pot') ? ['9 cm pots'] : []).join(' · ')} ›</div></a>`;
}

// ---------- dialogs ----------
function startDialog(s) {
  const isNew = !s, td = todayStr();
  const d = s ? Object.assign({}, s) : { cropId: '', variety: '', kind: 'tray', tray: trayNos().find(n => trayFree(n) > 0) || (trayNos().length ? Math.max(...trayNos()) + 1 : 1), count: '', seeds: '', sowDate: td, notes: '' };
  const trayOpts = () => { const nos = trayNos(), extra = nos.length ? Math.max(...nos) + 1 : 1; return [...new Set([...nos, d.tray || extra, extra])].sort((a, b) => a - b).map(n => `<option value="${n}"${n === (d.tray || 1) ? ' selected' : ''}>Tray ${n}${nos.includes(n) ? ` · ${trayFree(n, s && s.id)} free` : ' (new)'}</option>`).join(''); };
  modal(`<h3>${isNew ? 'Start seedlings' : 'Edit seedlings'}</h3>
    <form id="sdf" class="form">
      <label>Crop<select name="cropId" required><option value="">Choose a crop…</option>${allCrops().map(x => `<option value="${x.id}"${x.id === d.cropId ? ' selected' : ''}>${esc(x.en)}${x.ja ? ' ' + esc(x.ja) : ''}</option>`).join('')}</select></label>
      <label>Variety<input name="variety" list="svars" value="${esc(d.variety || '')}" autocomplete="off"><datalist id="svars"></datalist></label>
      <label>Raised in<div class="seg">${['tray', 'pot'].map(k => `<button type="button" data-k="${k}" class="${d.kind === k ? 'on' : ''}">${NURSERY[k].en}</button>`).join('')}</div></label>
      <div class="two"><label id="trayL"${d.kind === 'tray' ? '' : ' hidden'}>Which tray<select name="tray">${trayOpts()}</select></label>
        <label><span id="cntL">${d.kind === 'tray' ? 'Cells used' : 'Number of pots'}</span><input name="count" type="number" inputmode="numeric" min="1" value="${d.count || ''}" required></label></div>
      <div class="two"><label>Seeds per ${d.kind === 'tray' ? 'cell' : 'pot'}<input name="seeds" type="number" inputmode="numeric" min="1" value="${d.seeds || ''}" placeholder="optional"></label>
        <label>Sown on<input name="sowDate" type="date" value="${d.sowDate}" max="${td}"></label></div>
      <p class="hint" id="tpHint"></p>
      <label>Notes<input name="notes" value="${esc(d.notes || '')}" placeholder="e.g. heat mat, under cover"></label>
      <div class="btns">${isNew ? '<button type="button" class="btn" data-x="no">Cancel</button>' : '<button type="button" class="btn danger" data-x="del">Delete</button>'}<button class="btn primary">Save</button></div></form>`, (m, close) => {
    const f = m.querySelector('#sdf');
    const hint = () => {
      const id = f.cropId.value; m.querySelector('#svars').innerHTML = id ? varieties(id).map(v => `<option value="${esc(v)}">`).join('') : '';
      const tp = TRANSPLANT[id];
      m.querySelector('#tpHint').innerHTML = !id ? '' : tp && !tp[0] ? `⚠ ${esc(crop(id).en)}: ${esc(tp[1])}.` : `Plant out in about <b>${tpDays(id)} days</b>${tp && tp[1] ? ` — at ${esc(tp[1])}` : ''}.`;
    };
    f.cropId.onchange = hint; hint();
    m.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      d.kind = b.dataset.k; m.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('on', x === b));
      m.querySelector('#trayL').hidden = d.kind !== 'tray'; m.querySelector('#cntL').textContent = d.kind === 'tray' ? 'Cells used' : 'Number of pots';
    });
    const no = m.querySelector('[data-x=no]'); if (no) no.onclick = close;
    const del = m.querySelector('[data-x=del]');
    if (del) del.onclick = async () => { close(); if (!await confirmBox('Delete these seedlings and their history?', 'Delete', true)) return; S.starts = S.starts.filter(x => x !== s); S.tasks = S.tasks.filter(t => t.startId !== s.id); await save(); render(); };
    f.onsubmit = async e => {
      e.preventDefault();
      const o = { cropId: f.cropId.value, variety: f.variety.value.trim(), kind: d.kind, tray: d.kind === 'tray' ? +f.tray.value || 1 : null, count: +f.count.value || 1, seeds: num(f.seeds.value), sowDate: f.sowDate.value || td, notes: f.notes.value.trim() };
      if (o.kind === 'tray') { const free = trayFree(o.tray, s && s.id), need = o.count - (s ? s.count - startLeft(s) : 0); if (need > free && !confirm(`Tray ${o.tray} only has ${free} free cells. Save anyway?`)) return; }
      if (isNew) { s = Object.assign({ id: uid(), status: 'growing', created: new Date().toISOString(), events: [] }, o); (S.starts = S.starts || []).push(s); }
      else { if (o.sowDate !== s.sowDate) s.no_transplant = false; Object.assign(s, o); }
      if (startLeft(s) <= 0 && s.status === 'growing') s.status = 'done';
      syncStartTasks(s); await save(); close(); render();
    };
  });
}
function plantOutDialog(s) {
  if (!s) return;
  const left = startLeft(s), spots = S.containers.filter(c => c.type !== 'nursery');
  modal(`<h3>Plant out ${esc(crop(s.cropId).en)}</h3><p class="muted small">${left} ${NURSERY[s.kind].unit}${left === 1 ? '' : 's'} in ${esc(startWhere(s))} · sown ${shortDate(s.sowDate)}</p>
    <form id="pof" class="form"><label>How many are you planting?<input name="n" type="number" inputmode="numeric" min="1" max="${left}" value="${left}"></label></form>
    <p class="small">Where to?</p><ul class="plist pick">${spots.map(c => `<li><a href="#" data-c="${c.id}">${c.type === 'bed' ? BED_ICON(22) : '🪴'} <span class="grow"><b>${esc(c.name)}</b><small>${activeIn(c.id).map(p => esc(crop(p.cropId).en)).join(', ') || 'empty'}</small></span>›</a></li>`).join('') || '<li class="muted">Add a bed or bag first.</li>'}</ul>
    <p class="hint">Next you’ll mark where they go in the bed, like any new planting. Any you don’t plant stay here.</p>
    <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button></div>`, (m, close) => {
    m.querySelector('[data-x=no]').onclick = close;
    m.querySelectorAll('[data-c]').forEach(a => a.onclick = e => {
      e.preventDefault(); const n = Math.max(1, Math.min(left, +m.querySelector('#pof').n.value || left));
      close(); location.hash = `#/plant/new/${a.dataset.c}?crop=${encodeURIComponent(s.cropId)}&start=${s.id}&n=${n}`;
    });
  });
}
function discardDialog(s) {
  if (!s) return;
  const left = startLeft(s), td = todayStr();
  modal(`<h3>Discard ${esc(crop(s.cropId).en)} seedlings</h3><p class="muted small">${left} left in ${esc(startWhere(s))}</p>
    <form id="dsf" class="form"><div class="two"><label>How many<input name="n" type="number" inputmode="numeric" min="1" max="${left}" value="${left}"></label><label>When<input name="date" type="date" value="${td}" max="${td}"></label></div>
      <div class="libchips">${DISCARD.map(r => `<label class="chip tog"><input type="radio" name="reason" value="${esc(r)}"><span>${esc(r)}</span></label>`).join('')}</div>
      <label>Note<input name="note" placeholder="optional"></label>
      <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn danger">Discard</button></div></form>`, (m, close) => {
    const f = m.querySelector('#dsf'); m.querySelector('[data-x=no]').onclick = close;
    f.onsubmit = async e => {
      e.preventDefault();
      const n = Math.max(1, Math.min(left, +f.n.value || left)), r = (f.querySelector('input[name=reason]:checked') || {}).value || '';
      (s.events = s.events || []).push({ id: uid(), type: 'bin', date: f.date.value || td, n, reason: [r, f.note.value.trim()].filter(Boolean).join(' — ') });
      if (startLeft(s) <= 0) s.status = 'done';
      syncStartTasks(s); await save(); close(); render();
    };
  });
}
// called from the planting form when it was opened from "Plant out"
function prefillFromStart(d, q) {
  const s = start(q.get('start')); if (!s) return;
  const cr = crop(s.cropId);
  d.startId = s.id; d.startN = Math.min(+q.get('n') || startLeft(s), startLeft(s));
  d.method = 'seedling'; d.variety = s.variety || d.variety;
  if (cr.method === 'seed') {   // seed crops raised in a tray: final spacing, and harvest still counts from sowing
    if (cr.thinSp) d.plantSp = Math.max(+cr.sowSp || 0, +cr.thinSp);
    if (cr.daysHarvest) { d.harvestDate = addDays(s.sowDate, +cr.daysHarvest); if (d.harvestDate < addDays(d.sowDate, 14)) d.harvestDate = addDays(d.sowDate, 14); d.harvestManual = true; }
  }
  d.notes = d.notes || `Raised in ${startWhere(s).toLowerCase()}, sown ${shortDate(s.sowDate)}`;
}
function startPlanted(d, p) {
  const s = start(d.startId); if (!s) return;
  p.startId = s.id; p.seededOn = s.sowDate; p.raisedIn = s.kind;
  (s.events = s.events || []).push({ id: uid(), type: 'out', date: p.sowDate || todayStr(), n: d.startN || startLeft(s), pid: p.id });
  if (startLeft(s) <= 0) s.status = 'done';
  const tt = S.tasks.find(t => t.startId === s.id && t.kind === 'transplant' && !t.done);
  if (tt && s.status === 'done') { tt.done = true; tt.doneOn = p.sowDate || todayStr(); }
  syncStartTasks(s);
}
function startLogItems() {
  const out = [];
  for (const s of S.starts || []) {
    const n = crop(s.cropId).en, where = startWhere(s), href = '#/seedlings';
    out.push({ date: s.sowDate, kind: 'sow', title: `Sowed ${n}${s.variety ? ' · ' + s.variety : ''} in ${s.count} ${NURSERY[s.kind].unit}${s.count > 1 ? 's' : ''}`, sub: where, href, cids: [], pids: [] });
    if (s.upOn) out.push({ date: s.upOn, kind: 'note', title: `${n} seedlings came up`, sub: where, href, cids: [], pids: [] });
    for (const e of s.events || []) {
      const p = e.pid && planting(e.pid), c = p && container(p.containerId);
      if (e.type === 'out') out.push({ date: e.date, kind: 'sow', title: `Planted out ${e.n} ${n} seedlings`, sub: `${where} → ${c ? c.name : 'bed'}`, href: p ? '#/plant/' + p.id : href, cids: c ? [c.id] : [], pids: p ? [p.id] : [] });
      else out.push({ date: e.date, kind: 'done', title: `Discarded ${e.n} ${n} seedlings`, sub: where + (e.reason ? ' · ' + e.reason : ''), href, cids: [], pids: [] });
    }
  }
  return out;
}
