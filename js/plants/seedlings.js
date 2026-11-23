// Seedlings raised in cell trays and small pots, then planted out into a bed/bag or thrown away. Your tray and small-pot
// sizes, when to sow trays for a planting day, and picking seedlings you've already started when adding or planning a crop.

import { A, render, setChrome } from '../core/router.js';
import { S, save } from '../core/state.js';
import { confirmBox, modal } from '../core/ui.js';
import { addDays, daysBetween, esc, num, shortDate, todayStr, uid } from '../core/util.js';
import { activeIn, container, isPlanned, planting, sectionOf } from '../garden/garden.js';
import { activatePlan, linkedStart } from '../garden/planning.js';
import { BED_ICON, syncTasks } from '../garden/tasks.js';
import { applyCrop, recalc } from '../pages/planting-form.js';
import { allCrops, crop, ic, varieties } from './crops.js';
import { germDialog, germChecks, germText, pctText, syncStartGerm } from './germination.js';
import { KEPT, lastLeaves, leafDialog, startReady } from './growth.js';

export const NURSERY = {
  tray: { en: '49-cell tray', unit: 'cell', size: '28.5 × 28.5 cm · 7 × 7 cells · 3.5 cm deep', cells: 49, cols: 7 },
  pot: { en: '9 cm pots', unit: 'pot', size: '⌀9 × 7.5 cm deep' },
};
// typical days from sowing to planting out (cell tray / 9 cm pot) — 本葉の枚数 is the real sign
export const TRANSPLANT = {
  hakusai: [22, '本葉4–5枚'], cabbage: [30, '本葉5–6枚'], broccoli: [30, '本葉5–6枚'], cauliflower: [30, '本葉5–6枚'], lettuce: [28, '本葉4–5枚'],
  chingensai: [20, '本葉3–4枚'], komatsuna: [18, '本葉3枚'], mizuna: [20, '本葉3–4枚'], shungiku: [25, '本葉4–5枚'], nanohana: [25, '本葉4–5枚'],
  naganegi: [55, '草丈20 cm'], hatamanegi: [55, '草丈20 cm'], onion: [55, '草丈20–25 cm, 鉛筆の太さ'], celery: [70, '本葉6–8枚'],
  tomato: [55, '第1花房の開花前後'], minitomato: [55, '第1花房の開花前後'], nasu: [70, '本葉7–8枚, 一番花の蕾'], piman: [70, '本葉10枚前後, 一番花の蕾'],
  shishito: [70, '本葉10枚前後'], chilli: [70, '本葉10枚前後'], kyuri: [28, '本葉3–4枚'], zucchini: [28, '本葉3–4枚'],
  edamame: [14, '初生葉が開いた頃'], ingen: [14, '初生葉が開いた頃'], snappea: [21, '本葉3–4枚'], sayaendo: [21, '本葉3–4枚'],
  soramame: [25, '本葉2–3枚'], corn: [20, '本葉3枚'], strawberry: [40, '本葉3枚'], daikon: [0, 'roots resent moving — sow direct'], carrot: [0, 'roots resent moving — sow direct'],
};
export const tpDays = id => (TRANSPLANT[id] || [30])[0] || 25;
const DISCARD = ['Spare / too many', 'Weak or leggy', 'Pests or disease', 'Died / dried out'];
export const start = id => (S.starts || []).find(s => s.id === id);
export const startLeft = s => (s.count || 0) - (s.events || []).reduce((a, e) => a + (+e.n || 0), 0);
export const startsGrowing = () => (S.starts || []).filter(s => s.status === 'growing');
export const startWhere = s => s.kind === 'tray' ? `Tray ${s.tray || 1}` : NURSERY.pot.en;
export function trayFree(no, exceptId) {
  return NURSERY.tray.cells - startsGrowing().filter(s => s.kind === 'tray' && (s.tray || 1) === no && s.id !== exceptId).reduce((a, s) => a + startLeft(s), 0);
}
function trayNos() { return [...new Set(startsGrowing().filter(s => s.kind === 'tray').map(s => s.tray || 1))].sort((a, b) => a - b); }

// ---------- seedling jobs ----------
export function syncStartTasks(s) {
  const mine = S.tasks.filter(t => t.startId === s.id && !t.done);
  if (s.status !== 'growing') { S.tasks = S.tasks.filter(t => !mine.includes(t)); return; }
  const upsert = (kind, want, due, title) => {
    const open = mine.find(t => t.kind === kind), anyDone = S.tasks.some(t => t.startId === s.id && t.kind === kind && t.done);
    if (!want) { if (open) S.tasks = S.tasks.filter(x => x !== open); return; }
    if (open) Object.assign(open, { due, title }); else if (!anyDone) S.tasks.push({ id: uid(), startId: s.id, kind, title, due, done: false });
  };
  syncStartGerm(s);   // looks at how many are up, until they are
  const tp = TRANSPLANT[s.cropId];
  const pp = s.planId && planting(s.planId);
  upsert('transplant', !s.no_transplant && !(pp && isPlanned(pp)), startReady(s), `Plant out seedlings${tp && tp[1] ? ` (${tp[1]})` : ''}`);
}
export function startTaskMeta(t) {
  const s = start(t.startId); if (!s) return '';
  return `${ic(s.cropId)}<b>${esc(crop(s.cropId).en)}</b> · 🌱 ${esc(startWhere(s))}`;
}

// ---------- drawing trays and pots ----------
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

// ---------- the seedlings page ----------
export function pageSeedlings() {
  setChrome('Seedlings', { back: true, kicker: 'Trays & small pots' });
  const td = todayStr(), grow = startsGrowing();
  const card = s => {
    const left = startLeft(s), age = daysBetween(s.sowDate, td), ready = startReady(s), n = daysBetween(td, ready), tp = TRANSPLANT[s.cropId];
    return `<li class="start"><div class="srow"><span class="lic">${ic(s.cropId, 28)}</span><span class="grow"><b>${esc(crop(s.cropId).en)}</b>${s.variety ? ` · ${esc(s.variety)}` : ''}
      <small>${left} ${NURSERY[s.kind].unit}${left === 1 ? '' : 's'} · ${esc(startWhere(s))}${s.seeds ? ` · ${s.seeds} seed${s.seeds > 1 ? 's' : ''} each` : ''}${s.kept && s.kept !== 'out' ? ' · ' + (KEPT.find(k => k[0] === s.kept) || [, ''])[1].toLowerCase() : ''}</small>
      <small>Sown ${shortDate(s.sowDate)} (${age} day${age === 1 ? '' : 's'})${s.germ ? ` · ${esc(germText(s))}` : s.upOn ? ` · up ${shortDate(s.upOn)}` : ''} · ${n > 0 ? `ready in ~${n} days` : n === 0 ? 'ready about now' : 'ready to plant out'}${tp && tp[1] ? ` (${esc(tp[1])})` : ''}</small>
      ${s.notes ? `<small>${esc(s.notes)}</small>` : ''}</span><button class="tmore" data-act="editStart" data-id="${s.id}" aria-label="Edit">⋯</button></div>
      <div class="btnrow"><button class="btn small primary" data-act="plantOut" data-id="${s.id}">🌱 Plant out</button><button class="btn small" data-act="binStart" data-id="${s.id}">🗑 Discard</button>${s.kind === 'tray' ? `<button class="btn small" data-act="potOn" data-id="${s.id}">🪴 Pot on</button>` : ''}${!s.upOn || (s.germ && !s.germ.over) ? `<button class="btn small" data-act="upStart" data-id="${s.id}">${s.germ ? 'Look again' : 'How many are up?'}</button>` : `<button class="btn small" data-act="leafStart" data-id="${s.id}">🌿 ${lastLeaves(s) ? lastLeaves(s).n + ' leaves' : 'Leaves'}</button>`}</div></li>`;
  };
  const trays = trayNos(), pots = grow.filter(s => s.kind === 'pot');
  const past = (S.starts || []).filter(s => s.status !== 'growing').sort((a, b) => (a.sowDate < b.sowDate ? 1 : -1)).slice(0, 30);
  A.newStart = () => startDialog();
  A.editStart = el => startDialog(start(el.dataset.id));
  A.plantOut = el => plantOutDialog(start(el.dataset.id));
  A.binStart = el => discardDialog(start(el.dataset.id));
  A.leafStart = el => { const s = start(el.dataset.id); leafDialog(s, crop(s.cropId).en + ' seedlings'); };
  A.upStart = el => germDialog(start(el.dataset.id));
  A.potOn = el => potOnDialog(start(el.dataset.id));
  const html = `
    ${!grow.length ? `<div class="empty-state"><p>No seedlings on the go.</p></div>` : ''}
    ${trays.map(no => `<section><h3>Tray ${no} <small class="muted">· ${trayFree(no)} of 49 cells free</small></h3><div class="traywrap">${traySVG(no)}</div>
      <ul class="plist starts">${grow.filter(s => s.kind === 'tray' && (s.tray || 1) === no).map(card).join('')}</ul></section>`).join('')}
    ${pots.length ? `<section><h3>9 cm pots <small class="muted">· ${pots.reduce((a, s) => a + startLeft(s), 0)} in use</small></h3><div class="traywrap">${potsSVG(pots)}</div><ul class="plist starts">${pots.map(card).join('')}</ul></section>` : ''}
    <div class="btnrow"><button class="btn primary" data-act="newStart">＋ Start seedlings</button></div>
    <p class="hint">Tray: ${NURSERY.tray.en}${NURSERY.tray.size ? ` (${NURSERY.tray.size})` : ''}. Pots: ${NURSERY.pot.size}. <button type="button" class="link" data-act="nursery">Change sizes</button> Small cells dry out fast — check them every day, and harden seedlings off outside for a few days before planting out.</p>
    ${past.length ? `<details><summary>Finished (${past.length})</summary><ul class="plist log">${past.map(s => `<li class="logi"><div class="lrow"><span class="lic">${ic(s.cropId)}</span><span class="grow"><b>${esc(crop(s.cropId).en)}</b>${s.variety ? ` · ${esc(s.variety)}` : ''}<small>${s.count} ${NURSERY[s.kind].unit}s sown ${shortDate(s.sowDate)} · ${(s.events || []).map(eventText).join(' · ')}</small></span></div></li>`).join('')}</ul></details>` : ''}`;
  return { html };
}
export function seedlingsHomeSection() {
  const grow = startsGrowing(); if (!grow.length) return '';
  const td = todayStr();
  return `<h3 class="grp">Seedlings</h3><a class="card wide" href="#/seedlings"><div class="chips">${grow.map(s => { const n = daysBetween(td, startReady(s));
    return `<span class="chip">${ic(s.cropId)}${esc(crop(s.cropId).en)} ×${startLeft(s)}${n <= 0 ? ' · ready' : ''}</span>`; }).join('')}</div><div class="csize">${trayNos().map(n => 'Tray ' + n).concat(grow.some(s => s.kind === 'pot') ? ['9 cm pots'] : []).join(' · ')} ›</div></a>`;
}

// ---------- dialogs ----------
export function startDialog(s, preset) {
  const isNew = !s, td = todayStr();
  const d = s ? Object.assign({}, s) : Object.assign({ cropId: '', variety: '', kind: 'tray', tray: trayNos().find(n => trayFree(n) > 0) || (trayNos().length ? Math.max(...trayNos()) + 1 : 1), count: '', seeds: '', sowDate: td, notes: '' }, preset || {});
  const plan = d.planId && planting(d.planId);
  const trayOpts = () => { const nos = trayNos(), extra = nos.length ? Math.max(...nos) + 1 : 1; return [...new Set([...nos, d.tray || extra, extra])].sort((a, b) => a - b).map(n => `<option value="${n}"${n === (d.tray || 1) ? ' selected' : ''}>Tray ${n}${nos.includes(n) ? ` · ${trayFree(n, s && s.id)} free` : ' (new)'}</option>`).join(''); };
  modal(`<h3>${isNew ? 'Start seedlings' : 'Edit seedlings'}</h3>
    ${plan ? `<p class="msg small">📅 For the planned ${esc(crop(plan.cropId).en)} in ${esc((container(plan.containerId) || {}).name || '')} on ${shortDate(plan.sowDate)}.</p>` : ''}
    <form id="sdf" class="form">
      <label>Crop<select name="cropId" required><option value="">Choose a crop…</option>${allCrops().map(x => `<option value="${x.id}"${x.id === d.cropId ? ' selected' : ''}>${esc(x.en)}${x.ja ? ' ' + esc(x.ja) : ''}</option>`).join('')}</select></label>
      <label>Variety<input name="variety" list="svars" value="${esc(d.variety || '')}" autocomplete="off"><datalist id="svars"></datalist></label>
      <label>Raised in<div class="seg">${['tray', 'pot'].map(k => `<button type="button" data-k="${k}" class="${d.kind === k ? 'on' : ''}">${NURSERY[k].en}</button>`).join('')}</div></label>
      <div class="two"><label id="trayL"${d.kind === 'tray' ? '' : ' hidden'}>Which tray<select name="tray">${trayOpts()}</select></label>
        <label><span id="cntL">${d.kind === 'tray' ? 'Cells used' : 'Number of pots'}</span><input name="count" type="number" inputmode="numeric" min="1" value="${d.count || ''}" required></label></div>
      <div class="two"><label>Seeds per ${d.kind === 'tray' ? 'cell' : 'pot'}<input name="seeds" type="number" inputmode="numeric" min="1" value="${d.seeds || ''}" placeholder="optional"></label>
        <label>Sown on<input name="sowDate" type="date" value="${d.sowDate}" max="${td}"></label></div>
      <label>Kept<div class="seg wrap">${KEPT.map(([k, l]) => `<button type="button" data-kept="${k}" class="${(d.kept || 'out') === k ? 'on' : ''}">${l}</button>`).join('')}</div></label>
      <p class="hint" id="tpHint"></p>
      <label>Notes<input name="notes" value="${esc(d.notes || '')}" placeholder="e.g. heat mat, under cover"></label>
      <div class="btns">${isNew ? '<button type="button" class="btn" data-x="no">Cancel</button>' : '<button type="button" class="btn danger" data-x="del" data-own-confirm>Delete</button>'}<button class="btn primary">Save</button></div></form>`, (m, close) => {
    const f = m.querySelector('#sdf');
    const hint = () => {
      const id = f.cropId.value; m.querySelector('#svars').innerHTML = id ? varieties(id).map(v => `<option value="${esc(v)}">`).join('') : '';
      const tp = TRANSPLANT[id];
      m.querySelector('#tpHint').innerHTML = !id ? '' : tp && !tp[0] ? `⚠ ${esc(crop(id).en)}: ${esc(tp[1])}.` : `Plant out in about <b>${daysBetween(f.sowDate.value || todayStr(), startReady({ cropId: id, sowDate: f.sowDate.value || todayStr(), kept: d.kept }))} days</b> at this time of year${tp && tp[1] ? ` — at ${esc(tp[1])}` : ''}.`;
    };
    f.cropId.onchange = hint; f.sowDate.onchange = hint; hint();
    m.querySelectorAll('[data-kept]').forEach(b => b.onclick = () => { d.kept = b.dataset.kept; m.querySelectorAll('[data-kept]').forEach(x => x.classList.toggle('on', x === b)); hint(); });
    m.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      d.kind = b.dataset.k; m.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('on', x === b));
      m.querySelector('#trayL').hidden = d.kind !== 'tray'; m.querySelector('#cntL').textContent = d.kind === 'tray' ? 'Cells used' : 'Number of pots';
    });
    const no = m.querySelector('[data-x=no]'); if (no) no.onclick = close;
    const del = m.querySelector('[data-x=del]');
    if (del) del.onclick = async () => { close(); if (!await confirmBox('Delete these seedlings and their history?', 'Delete', true)) return; S.starts = S.starts.filter(x => x !== s); S.tasks = S.tasks.filter(t => t.startId !== s.id); await save(); render(); };
    f.onsubmit = async e => {
      e.preventDefault();
      const o = { cropId: f.cropId.value, variety: f.variety.value.trim(), kind: d.kind, tray: d.kind === 'tray' ? +f.tray.value || 1 : null, count: +f.count.value || 1, seeds: num(f.seeds.value), sowDate: f.sowDate.value || td, notes: f.notes.value.trim(), kept: d.kept || 'out' };
      if (o.kind === 'tray') { const free = trayFree(o.tray, s && s.id), need = o.count - (s ? s.count - startLeft(s) : 0); if (need > free && !confirm(`Tray ${o.tray} only has ${free} free cells. Save anyway?`)) return; }
      if (isNew) {
        s = Object.assign({ id: uid(), status: 'growing', created: new Date().toISOString(), events: [] }, o, plan ? { planId: plan.id } : {}); (S.starts = S.starts || []).push(s);
        if (plan) { const t = S.tasks.find(t => t.plantingId === plan.id && t.kind === 'plan_tray' && !t.done); if (t) { t.done = true; t.doneOn = o.sowDate; } }
      }
      else { if (o.sowDate !== s.sowDate) s.no_transplant = false; Object.assign(s, o); }
      if (startLeft(s) <= 0 && s.status === 'growing') s.status = 'done';
      syncStartTasks(s); await save(); close(); render();
    };
  });
}
export function plantOutDialog(s) {
  if (!s) return;
  const left = startLeft(s), spots = S.containers.filter(c => c.type !== 'nursery');
  modal(`<h3>Plant out ${esc(crop(s.cropId).en)}</h3><p class="muted small">${left} ${NURSERY[s.kind].unit}${left === 1 ? '' : 's'} in ${esc(startWhere(s))} · sown ${shortDate(s.sowDate)}</p>
    <form id="pof" class="form"><label>How many are you planting?<input name="n" type="number" inputmode="numeric" min="1" max="${left}" value="${left}"></label></form>
    ${(() => { const pp = s.planId && planting(s.planId); return pp && isPlanned(pp) ? `<p class="small">Planned spot</p><ul class="plist pick"><li><a href="#" data-plan="${pp.id}">📅 <span class="grow"><b>${esc((container(pp.containerId) || {}).name || '')}${sectionOf(pp) ? ' · ' + sectionOf(pp) : ''}</b><small>planned for ${shortDate(pp.sowDate)}</small></span>›</a></li></ul><p class="small">Somewhere else?</p>` : '<p class="small">Where to?</p>'; })()}<ul class="plist pick">${spots.map(c => `<li><a href="#" data-c="${c.id}">${c.type === 'bed' ? BED_ICON(22) : '🪴'} <span class="grow"><b>${esc(c.name)}</b><small>${activeIn(c.id).map(p => esc(crop(p.cropId).en)).join(', ') || 'empty'}</small></span>›</a></li>`).join('') || '<li class="muted">Add a bed or bag first.</li>'}</ul>
    <p class="hint">Next you’ll mark where they go, like any new planting. Any you don’t plant stay here — plant out again to put some in another bed, bag or pot.</p>
    <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button></div>`, (m, close) => {
    m.querySelector('[data-x=no]').onclick = close;
    const pl = m.querySelector('[data-plan]');
    if (pl) pl.onclick = async e => { e.preventDefault(); const n = Math.max(1, Math.min(left, +m.querySelector('#pof').n.value || left)), pp = planting(pl.dataset.plan);
      const t = S.tasks.find(t => t.plantingId === pp.id && t.kind === 'plan_sow' && !t.done); if (t) { t.done = true; t.doneOn = todayStr(); }
      activatePlan(pp, todayStr(), n); await save(); close(); location.hash = '#/plant/' + pp.id; };
    m.querySelectorAll('[data-c]').forEach(a => a.onclick = e => {
      e.preventDefault(); const n = Math.max(1, Math.min(left, +m.querySelector('#pof').n.value || left));
      close(); location.hash = `#/plant/new/${a.dataset.c}?crop=${encodeURIComponent(s.cropId)}&start=${s.id}&n=${n}`;
    });
  });
}
// what happened to some of them, in a few words
function eventText(e) {
  if (e.type === 'out') return `${e.n} planted in ${esc((container((planting(e.pid) || {}).containerId) || {}).name || 'a bed')} ${shortDate(e.date)}`;
  if (e.type === 'pot') return `${e.n} potted on ${shortDate(e.date)}`;
  if (e.type === 'resow') return e.gaps ? `empty cells re-sown ${shortDate(e.date)}` : `re-sown ${shortDate(e.date)} (first sown ${shortDate(e.was)})`;
  return `${e.n} discarded ${shortDate(e.date)}${e.reason ? ` (${esc(e.reason.toLowerCase())})` : ''}`;
}
// moving some from a tray into small pots to grow on: they become their own group of seedlings in pots
export function potOnDialog(s) {
  if (!s) return;
  const left = startLeft(s), td = todayStr();
  modal(`<h3>Pot on ${esc(crop(s.cropId).en)} seedlings</h3><p class="muted small">${left} ${NURSERY.tray.unit}${left === 1 ? '' : 's'} in ${esc(startWhere(s))} · sown ${shortDate(s.sowDate)}</p>
    <form id="ptf" class="form"><div class="two"><label>How many<input name="n" type="number" inputmode="numeric" min="1" max="${left}" value="${left}"></label><label>When<input name="date" type="date" value="${td}" min="${s.sowDate}" max="${td}"></label></div>
      <p class="hint">Into ${esc(NURSERY.pot.en)} (${esc(NURSERY.pot.size)}). They’re kept as their own group, so you can plant them out later; the rest stay in the tray.</p>
      <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary">Pot on</button></div></form>`, (m, close) => {
    const f = m.querySelector('#ptf'); m.querySelector('[data-x=no]').onclick = close;
    f.onsubmit = async e => {
      e.preventDefault();
      const n = Math.max(1, Math.min(left, +f.n.value || left)), date = f.date.value && f.date.value <= td ? f.date.value : td;
      const ns = { id: uid(), status: 'growing', created: new Date().toISOString(), events: [], cropId: s.cropId, variety: s.variety || '', kind: 'pot', tray: null, count: n, seeds: 1,
        sowDate: s.sowDate, upOn: s.upOn || null, kept: s.kept, leaves: (s.leaves || []).slice(), from: s.id, pottedOn: date, notes: `Potted on from ${startWhere(s).toLowerCase()} on ${shortDate(date)}` };
      if (s.germ) ns.germ = Object.assign(JSON.parse(JSON.stringify(s.germ)), { stopped: true, over: true });   // up already: no more looks for these
      (S.starts = S.starts || []).push(ns);
      (s.events = s.events || []).push({ id: uid(), type: 'pot', date, n, to: ns.id });
      if (startLeft(s) <= 0) s.status = 'done';
      syncStartTasks(s); syncStartTasks(ns); await save(); close(); render();
    };
  });
}
export function discardDialog(s) {
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
export function prefillFromStart(d, q) {
  const s = start(q.get('start')); if (!s) return;
  const cr = crop(s.cropId);
  d.startId = s.id; d.startN = Math.min(+q.get('n') || startLeft(s), startLeft(s));
  d.method = 'seedling'; d.variety = s.variety || d.variety;
  if (cr.method === 'seed') {   // seed crops raised in a tray: final spacing, and harvest still counts from sowing
    if (cr.thinSp) d.plantSp = Math.max(+cr.sowSp || 0, +cr.thinSp);
    d.seededOn = s.sowDate; d.harvestManual = false; recalc(d);
  }
  d.notes = d.notes || `Raised in ${startWhere(s).toLowerCase()}, sown ${shortDate(s.sowDate)}`;
}
export function startPlanted(d, p) {
  const s = start(d.startId); if (!s) return;
  p.startId = s.id; p.seededOn = s.sowDate; p.raisedIn = s.kind;
  (s.events = s.events || []).push({ id: uid(), type: 'out', date: p.sowDate || todayStr(), n: d.startN || startLeft(s), pid: p.id });
  if (startLeft(s) <= 0) s.status = 'done';
  const tt = S.tasks.find(t => t.startId === s.id && t.kind === 'transplant' && !t.done);
  if (tt && s.status === 'done') { tt.done = true; tt.doneOn = p.sowDate || todayStr(); }
  syncStartTasks(s);
}
export function startLogItems() {
  const out = [];
  for (const s of S.starts || []) {
    const n = crop(s.cropId).en, where = startWhere(s), href = '#/seedlings';
    if (!s.from) out.push({ date: s.sowDate, kind: 'sow', title: `Sowed ${n}${s.variety ? ' · ' + s.variety : ''} in ${s.count} ${NURSERY[s.kind].unit}${s.count > 1 ? 's' : ''}`, sub: where, href, cids: [], pids: [] });
    const looks = s.from ? [] : germChecks(s);   // (a potted-on group carries its tray's looks: they're logged there)
    if (looks.length) for (const k of looks) out.push({ date: k.date, kind: 'note', title: `${n} seedlings: ${pctText(k)}`, sub: where, href, cids: [], pids: [] });
    else if (s.upOn && !s.from) out.push({ date: s.upOn, kind: 'note', title: `${n} seedlings came up`, sub: where, href, cids: [], pids: [] });
    if (s.from && s.pottedOn) out.push({ date: s.pottedOn, kind: 'sow', title: `Potted on ${s.count} ${n} seedlings`, sub: `${startWhere(start(s.from) || { kind: 'tray' })} → ${where}`, href, cids: [], pids: [] });
    for (const e of s.events || []) {
      const p = e.pid && planting(e.pid), c = p && container(p.containerId);
      if (e.type === 'out') out.push({ date: e.date, kind: 'sow', title: `Planted out ${e.n} ${n} seedlings`, sub: `${where} → ${c ? c.name : 'bed'}`, href: p ? '#/plant/' + p.id : href, cids: c ? [c.id] : [], pids: p ? [p.id] : [] });
      else if (e.type === 'resow') out.push({ date: e.date, kind: 'sow', title: e.gaps ? `Re-sowed the empty cells of ${n}` : `Re-sowed ${n} (first sown ${shortDate(e.was)})`, sub: where, href, cids: [], pids: [] });
      else if (e.type === 'bin') out.push({ date: e.date, kind: 'done', title: `Discarded ${e.n} ${n} seedlings`, sub: where + (e.reason ? ' · ' + e.reason : ''), href, cids: [], pids: [] });
    }
  }
  return out;
}

// ---------- seedlings already started ----------
const freeStarts = exceptPid => startsGrowing().filter(s => { const pp = s.planId && planting(s.planId); return !pp || !isPlanned(pp) || pp.id === exceptPid; });
export function startChooser(d) {
  const list = freeStarts(); if (!list.length) return '';
  const td = todayStr();
  return `<div class="usestart"><small>Use seedlings you’ve started</small><div class="sowchips">${list.map(s => { const ready = startReady(s);
    return `<button type="button" class="chip${d.useStart === s.id ? ' on' : ''}" data-act="useStart" data-id="${s.id}">${ic(s.cropId, 20)}${esc(crop(s.cropId).en)}${s.variety ? ' · ' + esc(s.variety) : ''} <small>×${startLeft(s)} · ${esc(startWhere(s))} · ${ready <= td ? 'ready' : 'ready ~' + shortDate(ready)}</small></button>`; }).join('')}</div></div>`;
}
export function applyStart(d, s, c) {
  if (d.useStart === s.id) { d.useStart = null; d.startId = null; d.startN = null; return; }
  const keepSow = d.sowDate, cr = crop(s.cropId);
  if (d.cropId !== s.cropId) applyCrop(d, cr, c);
  d.sowDate = keepSow; d.variety = s.variety || d.variety; d.method = 'seedling'; d.useStart = s.id; d.raise = s.kind;
  if (cr.method === 'seed' && cr.thinSp) d.plantSp = Math.max(+cr.sowSp || 0, +cr.thinSp);
  d.seededOn = s.sowDate; d.harvestManual = false; recalc(d);
  if (!d.notes) d.notes = `Raised in ${startWhere(s).toLowerCase()}, sown ${shortDate(s.sowDate)}`;
}
// on save of a new planting that uses started seedlings
export function linkStartOnSave(d, p) {
  const s = d.useStart && start(d.useStart); if (!s) return;
  if (p.status === 'planned') { s.planId = p.id; p.raise = s.kind; syncStartTasks(s); }
  else { d.startId = s.id; d.startN = d.startN || startLeft(s); }
}
export function startReadyNote(d) {
  const s = d.useStart && start(d.useStart); if (!s) return '';
  const ready = startReady(s);
  return `<p class="hint">🌱 Using ${startLeft(s)} ${esc(crop(s.cropId).en)} seedlings from ${esc(startWhere(s).toLowerCase())}, ready about ${shortDate(ready)}${d.sowDate && ready > d.sowDate ? ` — <b>after</b> this date; they may need longer` : ''}.</p>`;
}
// planned crop page: link seedlings started separately
export function planStartLinks(p) {
  if (!isPlanned(p) || linkedStart(p)) return '';
  const m = freeStarts().filter(s => s.cropId === p.cropId); if (!m.length) return '';
  A.linkStart = async el => { const s = start(el.dataset.id); s.planId = p.id; p.method = 'seedling'; p.raise = s.kind; if (!p.variety) p.variety = s.variety; syncStartTasks(s); syncTasks(p); await save(); render(); };
  return `<div class="btnrow">${m.map(s => `<button class="btn small" data-act="linkStart" data-id="${s.id}">🌱 Use my ${esc(crop(s.cropId).en)} seedlings (${esc(startWhere(s))}, ×${startLeft(s)})</button>`).join('')}</div>`;
}
// season plan gaps: offer started seedlings first
export function gapStartChips(c, g) {
  const prevFam = g.prev ? crop(g.prev.cropId).family : null;
  return freeStarts().filter(s => !(prevFam && prevFam !== 'other' && crop(s.cropId).family === prevFam))
    .map(s => `<a class="chip mine" href="#/plant/new/${c.id}?plan=1&from=${g.a}&to=${g.b}&date=${g.s}&usestart=${s.id}">🌱 ${esc(crop(s.cropId).en)} <small>your seedlings ×${startLeft(s)}</small></a>`).join('');
}

// ---------- your seed trays and small pots (sizes are yours to set) ----------
export function applyNursery() {
  const n = S.nursery; if (!n) return;
  if (+n.cells > 0) { NURSERY.tray.cells = +n.cells; NURSERY.tray.cols = +n.cols > 0 ? +n.cols : Math.round(Math.sqrt(+n.cells)); NURSERY.tray.en = `${n.cells}-cell tray`; }
  if (n.traySize) NURSERY.tray.size = n.traySize;
  if (+n.potCm > 0) { NURSERY.pot.en = `${n.potCm} cm pots`; NURSERY.pot.size = `⌀${n.potCm} cm`; }
}
export function nurseryDialog() {
  const t = NURSERY.tray, potCm = (S.nursery && S.nursery.potCm) || 9;
  modal(`<h3>Your trays & pots</h3><form id="nuf" class="form">
      <div class="two"><label>Cells per tray<input name="cells" type="number" min="1" inputmode="numeric" value="${t.cells}"></label><label>Cells across<input name="cols" type="number" min="1" inputmode="numeric" value="${t.cols}"></label></div>
      <label>Tray size <small>(optional, for your notes)</small><input name="traySize" value="${esc(t.size || '')}"></label>
      <label>Small pot size (cm across)<input name="potCm" type="number" min="1" step="0.5" inputmode="decimal" value="${potCm}"></label>
      <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary">Save</button></div></form>`, (m, close) => {
    m.querySelector('[data-x=no]').onclick = close;
    m.querySelector('#nuf').onsubmit = async e => { e.preventDefault(); const f = e.target; S.nursery = { cells: +f.cells.value || t.cells, cols: +f.cols.value || null, traySize: f.traySize.value.trim(), potCm: +f.potCm.value || 9 }; applyNursery(); await save(); close(); render(); };
  });
}

// ---------- when to sow trays for a planting day ----------
// when to sow in a tray to be ready by a planting date
export function traySowFor(id, plantDate) { return traySowPlan(id, plantDate).sow; }
// when to sow, and where the tray needs to be kept for that to work: where you usually keep trays, or somewhere
// warmer if seedlings would barely grow there (e.g. tomatoes for Golden Week need to start indoors in late winter)
export function traySowPlan(id, plantDate) {
  const usual = ((S.starts || []).slice(-1)[0] || {}).kept || 'out', tp = tpDays(id);
  const order = KEPT.map(k => k[0]).slice(Math.max(0, KEPT.findIndex(k => k[0] === usual)));
  const lo = addDays(plantDate, -Math.round(tp * 2)), hi = addDays(plantDate, -7);
  let last = null;
  for (const kept of order) {
    let sow = addDays(plantDate, -tp), best = null;
    for (let i = 0; i < 12; i++) {
      const r = startReady({ cropId: id, sowDate: sow, kept }), diff = daysBetween(plantDate, r);
      if (!best || Math.abs(diff) < Math.abs(best.diff)) best = { sow, diff };
      if (Math.abs(diff) <= 2) break;
      let next = addDays(sow, -Math.round(diff * 0.7)); if (next < lo) next = lo; if (next > hi) next = hi;
      if (next === sow) break; sow = next;
    }
    last = { sow: best.sow, kept, late: best.diff < -3 };
    if (Math.abs(best.diff) <= 5 && daysBetween(best.sow, plantDate) <= tp * 1.4) return last;   // ready in time without crawling along
  }
  return last;   // even the warmest spot is slow: the earliest sensible date, kept as warm as possible
}
export function trayDateOf(p) { if (p.seededOn) return { d: p.seededOn }; const s = p.id && (S.starts || []).find(x => x.planId === p.id); return s ? { d: s.sowDate, up: s.upOn } : null; }
