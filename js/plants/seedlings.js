// Seedlings raised in cell trays and small pots, then planted out into a bed/bag or thrown away. Your tray and small-pot
// sizes, when to sow trays for a planting day, and picking seedlings you've already started when adding or planning a crop.

import { A, render, setChrome } from '../core/router.js';
import { S, save } from '../core/state.js';
import { confirmBox, modal } from '../core/ui.js';
import { addDays, daysBetween, esc, num, shortDate, todayStr, uid } from '../core/util.js';
import { activeIn, container, isPlanned, planting, sectionOf } from '../garden/garden.js';
import { activatePlan, linkedStart } from '../garden/planning.js';
import { BED_ICON, syncTasks } from '../garden/tasks.js';
import { Draw } from '../draw.js';
import { applyCrop, recalc } from '../pages/planting-form.js';
import { allCrops, crop, ic, varieties } from './crops.js';
import { germDialog, germChecks, germText, pctText, syncStartGerm } from './germination.js';
import { KEPT, keptText, lastLeaves, leafDialog, moveKept, startReady } from './growth.js';

// ---------- your trays and pots ----------
// The kinds of tray and pot you raise seedlings in (S.nursery.items): a tray type has cells (and how many across), a pot
// size its width. Each seedling group knows its type (s.nid) and kind ('tray' or 'pot'); trays are numbered — Tray 1,
// Tray 2… — each of one type, so a 49-cell and a 9-cell tray can be on the go together.
const DEFAULT_NURSERY = [{ id: 'nt_tray', kind: 'tray', cells: 49, cols: 7, size: '28.5 × 28.5 cm · 3.5 cm deep' }, { id: 'nt_pot', kind: 'pot', cm: 9, size: '7.5 cm deep' }];
const ntName = t => t.kind === 'pot' ? `${t.cm} cm pots` : `${t.cells}-cell tray`;
export const nurseryTypes = () => ((S.nursery && S.nursery.items) || DEFAULT_NURSERY).map(t => Object.assign({}, t, { name: ntName(t) }));
// a seedling group's (or a type id's) tray or pot type
export function ntype(o) {
  const all = nurseryTypes(), id = typeof o === 'string' ? o : o && o.nid, kind = (o && o.kind) || 'tray';
  return all.find(t => t.id === id) || all.find(t => t.kind === kind) || all[0];
}
export const unitOf = s => s.kind === 'pot' ? 'pot' : 'cell';
// seedlings growing in each pot or cell (once thinned) — usually one
export const perOf = s => Math.max(1, Math.round(+s.per || 1));
export const plantsOf = (s, n = startLeft(s)) => n * perOf(s);
export function addNurseryType(t) {
  addNurseryType.ensure();
  const o = t.kind === 'pot' ? { id: 'nt_' + uid(), kind: 'pot', cm: +t.cm, size: t.size || '' } : { id: 'nt_' + uid(), kind: 'tray', cells: +t.cells, cols: +t.cols > 0 ? +t.cols : Math.round(Math.sqrt(+t.cells)), size: t.size || '' };
  S.nursery.items.push(o); return Object.assign({ name: ntName(o) }, o);
}
// (the list is only saved once you change it: until then, the usual 49-cell tray and 9 cm pots)
addNurseryType.ensure = () => { if (!S.nursery || !Array.isArray(S.nursery.items)) S.nursery = { items: DEFAULT_NURSERY.map(x => Object.assign({}, x)) }; };
// data version 9: the one tray size and one pot size of before become the first two of your list
export function migrateNursery() {
  if (S.nursery && Array.isArray(S.nursery.items)) return;
  const o = S.nursery || {}, cells = +o.cells > 0 ? +o.cells : 0, cm = +o.potCm > 0 ? +o.potCm : 0;
  S.nursery = { items: [
    cells ? { id: 'nt_tray', kind: 'tray', cells, cols: +o.cols > 0 ? +o.cols : Math.round(Math.sqrt(cells)), size: o.traySize || '' } : Object.assign({}, DEFAULT_NURSERY[0]),
    cm ? { id: 'nt_pot', kind: 'pot', cm, size: '' } : Object.assign({}, DEFAULT_NURSERY[1])] };
  for (const s of S.starts || []) if (!s.nid) s.nid = s.kind === 'pot' ? 'nt_pot' : 'nt_tray';
}

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
export const startWhere = s => s.kind === 'tray' ? `Tray ${s.tray || 1}` : ntype(s).name;
const inTray = (no, exceptId) => startsGrowing().filter(s => s.kind === 'tray' && (s.tray || 1) === no && s.id !== exceptId);
// the type of tray number `no` (from what's growing in it)
export const trayType = (no, exceptId) => { const s = inTray(no, exceptId)[0]; return s ? ntype(s) : null; };
export function trayFree(no, exceptId) {
  const t = trayType(no, exceptId) || trayType(no); return (t ? t.cells : 0) - inTray(no, exceptId).reduce((a, s) => a + startLeft(s), 0);
}
function trayNos() { return [...new Set(startsGrowing().filter(s => s.kind === 'tray').map(s => s.tray || 1))].sort((a, b) => a - b); }
const nextTrayNo = () => { const nos = trayNos(); return nos.length ? Math.max(...nos) + 1 : 1; };

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
  const t = trayType(no), cols = t.cols || Math.round(Math.sqrt(t.cells)), cells = [];
  for (const s of startsGrowing().filter(s => s.kind === 'tray' && (s.tray || 1) === no).sort((a, b) => (a.created || '') < (b.created || '') ? -1 : 1))
    for (let i = 0; i < startLeft(s); i++) cells.push(s);
  const W = cols * px + 6, H = Math.ceil(t.cells / cols) * px + 6;
  let g = `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="5" fill="#2f2a26"/>`;
  for (let i = 0; i < t.cells; i++) {
    const x = 3 + (i % cols) * px, y = 3 + Math.floor(i / cols) * px, s = cells[i];
    g += `<rect x="${x + 1}" y="${y + 1}" width="${px - 2}" height="${px - 2}" rx="3" fill="${s ? '#6b4f36' : '#4a403a'}"/>`;
    if (s) g += `<circle cx="${x + px / 2}" cy="${y + px / 2}" r="${px * (s.upOn ? .36 : .14)}" fill="${crop(s.cropId).color || '#7fb069'}" stroke="#1f1a16" stroke-width=".8"/>`;
  }
  return `<svg class="tray" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${g}</svg>`;
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
      <small>${left} ${unitOf(s)}${left === 1 ? '' : 's'} · ${esc(startWhere(s))}${perOf(s) > 1 ? ` · ${perOf(s)} plants each (${plantsOf(s)} in all)` : s.seeds ? ` · ${s.seeds} seed${s.seeds > 1 ? 's' : ''} each` : ''}${' · ' + esc(keptText(s))}</small>
      <small>Sown ${shortDate(s.sowDate)} (${age} day${age === 1 ? '' : 's'})${s.germ ? ` · ${esc(germText(s))}` : s.upOn ? ` · up ${shortDate(s.upOn)}` : ''} · ${n > 0 ? `ready in ~${n} days` : n === 0 ? 'ready about now' : 'ready to plant out'}${tp && tp[1] ? ` (${esc(tp[1])})` : ''}</small>
      ${s.from ? `<small>Replanted from ${start(s.from) ? esc(startWhere(start(s.from))) : 'a tray'} on ${shortDate(s.movedOn || s.pottedOn)}</small>` : ''}${s.notes ? `<small>${esc(s.notes)}</small>` : ''}</span><button class="tmore" data-act="editStart" data-id="${s.id}" aria-label="Edit">⋯</button></div>
      <div class="btnrow"><button class="btn small primary" data-act="replant" data-id="${s.id}">🌱 Replant</button><button class="btn small" data-act="binStart" data-id="${s.id}">🗑 Discard</button>${!s.upOn || (s.germ && !s.germ.over) ? `<button class="btn small" data-act="upStart" data-id="${s.id}">${s.germ ? 'Look again' : 'How many are up?'}</button>` : `<button class="btn small" data-act="leafStart" data-id="${s.id}">🌿 ${lastLeaves(s) ? lastLeaves(s).n + ' leaves' : 'Leaves'}</button>`}</div></li>`;
  };
  const trays = trayNos(), potTypes = nurseryTypes().filter(t => t.kind === 'pot' && grow.some(s => s.kind === 'pot' && ntype(s).id === t.id));
  const past = (S.starts || []).filter(s => s.status !== 'growing').sort((a, b) => (a.sowDate < b.sowDate ? 1 : -1)).slice(0, 30);
  A.newStart = () => startDialog();
  A.editStart = el => startDialog(start(el.dataset.id));
  A.replant = el => replantDialog(start(el.dataset.id));
  A.binStart = el => discardDialog(start(el.dataset.id));
  A.leafStart = el => { const s = start(el.dataset.id); leafDialog(s, crop(s.cropId).en + ' seedlings'); };
  A.upStart = el => germDialog(start(el.dataset.id));
  const html = `
    ${!grow.length ? `<div class="empty-state"><p>No seedlings on the go.</p></div>` : ''}
    ${trays.map(no => `<section><h3>Tray ${no} <small class="muted">· ${esc(trayType(no).name)} · ${trayFree(no)} of ${trayType(no).cells} cells free</small></h3><div class="traywrap">${traySVG(no)}</div>
      <ul class="plist starts">${grow.filter(s => s.kind === 'tray' && (s.tray || 1) === no).map(card).join('')}</ul></section>`).join('')}
    ${potTypes.map(t => { const list = grow.filter(s => s.kind === 'pot' && ntype(s).id === t.id); return `<section><h3>${esc(t.name)} <small class="muted">· ${list.reduce((a, s) => a + startLeft(s), 0)} in use</small></h3><div class="traywrap">${potsSVG(list)}</div><ul class="plist starts">${list.map(card).join('')}</ul></section>`; }).join('')}
    <div class="btnrow"><button class="btn primary" data-act="newStart">＋ Start seedlings</button></div>
    <p class="hint">Your trays & pots: ${nurseryTypes().map(t => esc(t.name)).join(', ')}. <button type="button" class="link" data-act="nursery">Add or change sizes</button> Small cells dry out fast — check them every day, and harden seedlings off outside for a few days before planting out.</p>
    ${past.length ? `<details><summary>Finished (${past.length})</summary><ul class="plist log">${past.map(s => `<li class="logi"><div class="lrow"><span class="lic">${ic(s.cropId)}</span><span class="grow"><b>${esc(crop(s.cropId).en)}</b>${s.variety ? ` · ${esc(s.variety)}` : ''}<small>${s.count} ${unitOf(s)}s ${s.from ? `replanted ${shortDate(s.movedOn || s.pottedOn)}` : `sown ${shortDate(s.sowDate)}`} · ${(s.events || []).map(eventText).join(' · ')}</small></span></div></li>`).join('')}</ul></details>` : ''}`;
  return { html };
}
export function seedlingsHomeSection() {
  const grow = startsGrowing(); if (!grow.length) return '';
  const td = todayStr();
  return `<h3 class="grp">Seedlings</h3><a class="card wide" href="#/seedlings"><div class="chips">${grow.map(s => { const n = daysBetween(td, startReady(s));
    return `<span class="chip">${ic(s.cropId)}${esc(crop(s.cropId).en)} ×${startLeft(s)}${n <= 0 ? ' · ready' : ''}</span>`; }).join('')}</div><div class="csize">${trayNos().map(n => 'Tray ' + n).concat([...new Set(grow.filter(s => s.kind === 'pot').map(s => ntype(s).name))]).join(' · ')} ›</div></a>`;
}

// ---------- dialogs ----------
// where seedlings can go in your trays and pots: a tray on the go with free cells, a new tray of any type, pots of any size
// (value "t:<no>", "n:<type id>" or "p:<type id>"), leaving out where they are now
function nurseryChoices(not, exceptId) {
  const out = [];
  for (const no of trayNos()) if (!(not && not.kind === 'tray' && (not.tray || 1) === no)) out.push({ v: 't:' + no, label: `Tray ${no} · ${trayType(no).name}`, sub: `${trayFree(no, exceptId)} cells free` });
  for (const t of nurseryTypes().sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'tray' ? -1 : 1))) {
    if (t.kind === 'tray') out.push({ v: 'n:' + t.id, label: `A new ${t.name}`, sub: `Tray ${nextTrayNo()}` });
    else if (!(not && not.kind === 'pot' && ntype(not).id === t.id)) out.push({ v: 'p:' + t.id, label: t.name, sub: t.size || '' });
  }
  return out;
}
const placeOf = v => { const [k, x] = String(v).split(':'); return k === 't' ? { kind: 'tray', tray: +x, nid: trayType(+x).id } : k === 'n' ? { kind: 'tray', tray: nextTrayNo(), nid: x } : { kind: 'pot', tray: null, nid: x }; };
// a size of tray or pot you don't have yet, typed in where you need it
const newSizeFields = `<div id="ntNew" class="ntnew" hidden><div class="seg"><button type="button" data-nk="tray" class="on">Tray</button><button type="button" data-nk="pot">Pots</button></div>
  <div class="two" data-for="tray"><label>Cells<input name="ncells" type="number" inputmode="numeric" min="1" placeholder="e.g. 9"></label><label>Across <small>(optional)</small><input name="ncols" type="number" inputmode="numeric" min="1" placeholder="e.g. 3"></label></div>
  <div class="two" data-for="pot" hidden><label>Pot width (cm)<input name="ncm" type="number" inputmode="decimal" min="1" step="0.5" placeholder="e.g. 12"></label><span></span></div></div>`;
function wireNewSize(m, f) {
  let nk = 'tray';
  m.querySelectorAll('[data-nk]').forEach(b => b.onclick = () => { nk = b.dataset.nk; m.querySelectorAll('[data-nk]').forEach(x => x.classList.toggle('on', x === b)); m.querySelectorAll('#ntNew [data-for]').forEach(x => { x.hidden = x.dataset.for !== nk; }); });
  return () => {   // the new type, made from what was typed (or null, with the reason given)
    if (nk === 'tray') { const c = +f.ncells.value; if (!(c > 0 && c <= 500)) { alert('How many cells does the tray have?'); return null; } return addNurseryType({ kind: 'tray', cells: c, cols: +f.ncols.value || 0 }); }
    const cm = +f.ncm.value; if (!(cm > 0 && cm <= 60)) { alert('How wide are the pots, in cm?'); return null; } return addNurseryType({ kind: 'pot', cm });
  };
}
export function startDialog(s, preset) {
  const isNew = !s, td = todayStr();
  const d = s ? Object.assign({}, s) : Object.assign({ cropId: '', variety: '', kind: 'tray', count: '', seeds: '', sowDate: td, notes: '' }, preset || {});
  const plan = d.planId && planting(d.planId);
  const choices = nurseryChoices(null, s && s.id);
  const now = s ? (s.kind === 'tray' ? 't:' + (s.tray || 1) : 'p:' + ntype(s).id)
    : d.kind === 'pot' ? (choices.find(c => c.v.startsWith('p:')) || {}).v : ((choices.find(c => c.v.startsWith('t:') && trayFree(+c.v.slice(2)) > 0) || choices.find(c => c.v.startsWith('n:')) || {}).v);
  modal(`<h3>${isNew ? 'Start seedlings' : 'Edit seedlings'}</h3>
    ${plan ? `<p class="msg small">📅 For the planned ${esc(crop(plan.cropId).en)} in ${esc((container(plan.containerId) || {}).name || '')} on ${shortDate(plan.sowDate)}.</p>` : ''}
    <form id="sdf" class="form">
      <label>Crop<select name="cropId" required><option value="">Choose a crop…</option>${allCrops().map(x => `<option value="${x.id}"${x.id === d.cropId ? ' selected' : ''}>${esc(x.en)}${x.ja ? ' ' + esc(x.ja) : ''}</option>`).join('')}</select></label>
      <label>Variety<input name="variety" list="svars" value="${esc(d.variety || '')}" autocomplete="off"><datalist id="svars"></datalist></label>
      <label>Raised in<select name="where">${choices.map(c => `<option value="${c.v}"${c.v === now ? ' selected' : ''}>${esc(c.label)}${c.sub ? ' · ' + esc(c.sub) : ''}</option>`).join('')}<option value="add">＋ Another size of tray or pot…</option></select></label>
      ${newSizeFields}
      <div class="two"><label><span id="cntL">${d.kind === 'pot' ? 'Number of pots' : 'Cells used'}</span><input name="count" type="number" inputmode="numeric" min="1" value="${d.count || ''}" required></label>
        <label><span id="seedL">Seeds per ${d.kind === 'pot' ? 'pot' : 'cell'}</span><input name="seeds" type="number" inputmode="numeric" min="1" value="${d.seeds || ''}" placeholder="optional"></label></div>
      <label><span id="perL">Plants kept in each ${d.kind === 'pot' ? 'pot' : 'cell'}</span> <small>(after thinning; usually 1)</small><input name="per" type="number" inputmode="numeric" min="1" value="${d.per || ''}" placeholder="1"></label>
      <label>Sown on<input name="sowDate" type="date" value="${d.sowDate}" max="${td}"></label>
      <label>Kept<div class="seg wrap">${KEPT.map(([k, l]) => `<button type="button" data-kept="${k}" class="${(d.kept || 'out') === k ? 'on' : ''}">${l}</button>`).join('')}</div></label>
      ${isNew ? '' : `<label id="movedL" hidden>Moved there on <small>(earlier days count where they were before)</small><input name="moved" type="date" value="${td}" min="${s.sowDate}" max="${td}"></label>`}
      <p class="hint" id="tpHint"></p>
      <label>Notes<input name="notes" value="${esc(d.notes || '')}" placeholder="e.g. heat mat, under cover"></label>
      <div class="btns">${isNew ? '<button type="button" class="btn" data-x="no">Cancel</button>' : '<button type="button" class="btn danger" data-x="del" data-own-confirm>Delete</button>'}<button class="btn primary">Save</button></div></form>`, (m, close) => {
    const f = m.querySelector('#sdf'), newType = wireNewSize(m, f);
    // these seedlings as the form has them: moved (when editing) on the day given
    const asKept = id => { const o = Object.assign({}, s || {}, { cropId: id, sowDate: f.sowDate.value || todayStr() }); if (!s) o.kept = d.kept; else moveKept(o, d.kept, (f.moved && f.moved.value) || td); return o; };
    const hint = () => {
      const id = f.cropId.value; m.querySelector('#svars').innerHTML = id ? varieties(id).map(v => `<option value="${esc(v)}">`).join('') : '';
      const tp = TRANSPLANT[id];
      m.querySelector('#tpHint').innerHTML = !id ? '' : tp && !tp[0] ? `⚠ ${esc(crop(id).en)}: ${esc(tp[1])}.` : `Plant out in about <b>${daysBetween(f.sowDate.value || todayStr(), startReady(asKept(id)))} days</b> at this time of year${tp && tp[1] ? ` — at ${esc(tp[1])}` : ''}.`;
    };
    f.cropId.onchange = hint; f.sowDate.onchange = hint; hint();
    const where = () => {
      const add = f.where.value === 'add'; m.querySelector('#ntNew').hidden = !add;
      const pot = add ? !!m.querySelector('[data-nk=pot].on') : f.where.value.startsWith('p:');
      m.querySelector('#cntL').textContent = pot ? 'Number of pots' : 'Cells used'; m.querySelector('#seedL').textContent = `Seeds per ${pot ? 'pot' : 'cell'}`; m.querySelector('#perL').textContent = `Plants kept in each ${pot ? 'pot' : 'cell'}`;
    };
    f.where.onchange = where; m.querySelectorAll('[data-nk]').forEach(b => b.addEventListener('click', where));
    m.querySelectorAll('[data-kept]').forEach(b => b.onclick = () => { d.kept = b.dataset.kept; m.querySelectorAll('[data-kept]').forEach(x => x.classList.toggle('on', x === b)); const ml = m.querySelector('#movedL'); if (ml) { ml.hidden = d.kept === (s.kept || 'out'); f.moved.onchange = hint; } hint(); });
    const no = m.querySelector('[data-x=no]'); if (no) no.onclick = close;
    const del = m.querySelector('[data-x=del]');
    if (del) del.onclick = async () => { close(); if (!await confirmBox('Delete these seedlings and their history?', 'Delete', true)) return; S.starts = S.starts.filter(x => x !== s); S.tasks = S.tasks.filter(t => t.startId !== s.id); await save(); render(); };
    f.onsubmit = async e => {
      e.preventDefault();
      let v = f.where.value;
      if (v === 'add') { const t = newType(); if (!t) return; v = (t.kind === 'tray' ? 'n:' : 'p:') + t.id; }
      const at = placeOf(v);
      const o = { cropId: f.cropId.value, variety: f.variety.value.trim(), kind: at.kind, nid: at.nid, tray: at.tray, count: +f.count.value || 1, seeds: num(f.seeds.value), per: +f.per.value > 1 ? Math.round(+f.per.value) : null, sowDate: f.sowDate.value || td, notes: f.notes.value.trim(), kept: d.kept || 'out' };
      if (o.kind === 'tray') {
        const known = trayNos().includes(o.tray), free = known ? trayFree(o.tray, s && s.id) : ntype(o.nid).cells, need = o.count - (s && s.kind === 'tray' && (s.tray || 1) === o.tray ? s.count - startLeft(s) : 0);
        if (need > free && !confirm(`Tray ${o.tray} only has ${free} free cells. Save anyway?`)) return;
      }
      if (isNew) {
        s = Object.assign({ id: uid(), status: 'growing', created: new Date().toISOString(), events: [] }, o, plan ? { planId: plan.id } : {}); (S.starts = S.starts || []).push(s);
        if (plan) { const t = S.tasks.find(t => t.plantingId === plan.id && t.kind === 'plan_tray' && !t.done); if (t) { t.done = true; t.doneOn = o.sowDate; } }
      }
      else {
        if (o.sowDate !== s.sowDate) s.no_transplant = false;
        const kept = o.kept; delete o.kept; Object.assign(s, o);
        moveKept(s, kept, f.moved && f.moved.value && f.moved.value >= s.sowDate ? f.moved.value : td);   // where they are now, and since when
      }
      if (startLeft(s) <= 0 && s.status === 'growing') s.status = 'done';
      syncStartTasks(s); await save(); close(); render();
    };
  });
}
// Replant: some (or all) of a group of seedlings go somewhere else — into a bed, bag or pot in the garden (they become a
// planting there), or into another tray or pots to grow on (they become their own group). The rest stay where they are.
export function replantDialog(s) {
  if (!s) return;
  const left = startLeft(s), td = todayStr(), spots = S.containers.filter(c => c.type !== 'nursery'), pp = s.planId && planting(s.planId);
  const nursery = nurseryChoices(s);
  modal(`<h3>Replant ${esc(crop(s.cropId).en)} seedlings</h3><p class="muted small">${left} ${unitOf(s)}${left === 1 ? '' : 's'} in ${esc(startWhere(s))} · sown ${shortDate(s.sowDate)}</p>
    <form id="pof" class="form"><div class="two"><label>${perOf(s) > 1 ? `How many ${unitOf(s)}s? <small>(${perOf(s)} plants each)</small>` : 'How many?'}<input name="n" type="number" inputmode="numeric" min="1" max="${left}" value="${left}"></label><label>When<input name="date" type="date" value="${td}" min="${s.sowDate}" max="${td}"></label></div></form>
    ${pp && isPlanned(pp) ? `<p class="small">Planned spot</p><ul class="plist pick"><li><a href="#" data-plan="${pp.id}">📅 <span class="grow"><b>${esc((container(pp.containerId) || {}).name || '')}${sectionOf(pp) ? ' · ' + sectionOf(pp) : ''}</b><small>planned for ${shortDate(pp.sowDate)}</small></span>›</a></li></ul>` : ''}
    <p class="small">Into the garden</p><ul class="plist pick">${spots.map(c => {
      // the same crop growing there already: these can fill its gaps (one that never came up, one that died) instead
      const same = activeIn(c.id).filter(p => p.cropId === s.cropId);
      return same.map(p => `<li><a href="#" data-fill="${p.id}">🩹 <span class="grow"><b>${esc(c.name)} · fill gaps in the ${esc(crop(p.cropId).en.toLowerCase())} there</b><small>${p.method === 'seed' ? 'sown' : 'planted'} ${shortDate(p.sowDate)}${sectionOf(p) ? ' · ' + esc(sectionOf(p)) : ''} — replacing ones that didn’t make it</small></span>›</a></li>`).join('')
        + `<li><a href="#" data-c="${c.id}">${c.type === 'bed' ? BED_ICON(22) : '🪴'} <span class="grow"><b>${esc(c.name)}${same.length ? ' · as a new planting' : ''}</b><small>${activeIn(c.id).map(p => esc(crop(p.cropId).en)).join(', ') || 'empty'}</small></span>›</a></li>`;
    }).join('') || '<li class="muted">No beds, bags or pots yet.</li>'}</ul>
    <p class="small">Into a tray or pots, to grow on</p>
    <form id="poper" class="form"><label>Plants in each new pot or cell<input name="per" type="number" inputmode="numeric" min="1" value="1"></label></form><ul class="plist pick">${nursery.map(c => `<li><a href="#" data-nt="${c.v}">🌱 <span class="grow"><b>${esc(c.label)}</b>${c.sub ? `<small>${esc(c.sub)}</small>` : ''}</span>›</a></li>`).join('')}<li><a href="#" data-nt="add">＋ <span class="grow"><b>Another size of tray or pot…</b></span>›</a></li></ul>
    <form id="pon" class="form">${newSizeFields}<div class="btns" id="ponGo" hidden><button class="btn primary">Replant here</button></div></form>
    <p class="hint">The rest stay in ${esc(startWhere(s))} — replant again to put some somewhere else.</p>
    <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button></div>`, (m, close) => {
    const f = m.querySelector('#pof'), fn = m.querySelector('#pon'), newType = wireNewSize(m, fn);
    const howMany = () => Math.max(1, Math.min(left, +f.n.value || left)), when = () => (f.date.value && f.date.value <= td ? f.date.value : td);
    m.querySelector('[data-x=no]').onclick = close;
    const pl = m.querySelector('[data-plan]');
    if (pl) pl.onclick = async e => { e.preventDefault(); const n = howMany(), p = planting(pl.dataset.plan);
      const t = S.tasks.find(t => t.plantingId === p.id && t.kind === 'plan_sow' && !t.done); if (t) { t.done = true; t.doneOn = when(); }
      activatePlan(p, when(), n); await save(); close(); location.hash = '#/plant/' + p.id; };
    m.querySelectorAll('[data-c]').forEach(a => a.onclick = e => {
      e.preventDefault(); const n = howMany(), date = when();
      close(); location.hash = `#/plant/new/${a.dataset.c}?crop=${encodeURIComponent(s.cropId)}&start=${s.id}&n=${n}${date !== td ? '&date=' + date : ''}`;
    });
    const go = async v => { moveSeedlings(s, howMany(), when(), placeOf(v), +m.querySelector('#poper').per.value || 1); await save(); close(); render(); };
    m.querySelectorAll('[data-fill]').forEach(a => a.onclick = async e => { e.preventDefault(); const p = planting(a.dataset.fill); fillGaps(s, howMany(), when(), p); await save(); close(); location.hash = '#/plant/' + p.id; });
    m.querySelectorAll('[data-nt]').forEach(a => a.onclick = e => {
      e.preventDefault();
      if (a.dataset.nt !== 'add') return go(a.dataset.nt);
      m.querySelector('#ntNew').hidden = false; m.querySelector('#ponGo').hidden = false;
    });
    fn.onsubmit = e => { e.preventDefault(); const t = newType(); if (t) go((t.kind === 'tray' ? 'n:' : 'p:') + t.id); };
  });
}
export const plantOutDialog = replantDialog;   // the "plant out" job opens it too
// n seedlings from group s fill gaps in planting p (the same crop): they become part of it, no new planting
export function fillGaps(s, n, date, p) {
  (s.events = s.events || []).push({ id: uid(), type: 'out', date, n, pid: p.id, fill: true });
  const f = { date, n: plantsOf(s, n), startId: s.id }; (p.fills = p.fills || []).push(f);
  drawFill(p, f, s.sowDate);
  if (startLeft(s) <= 0) s.status = 'done';
  const tt = S.tasks.find(t => t.startId === s.id && t.kind === 'transplant' && !t.done);
  if (tt && s.status === 'done') { tt.done = true; tt.doneOn = date; }
  syncStartTasks(s);
}
// filled-in seedlings in the planting's drawing: added as plants of their own age, near the middle (arrange them by
// hand where they really are — and take out any that died). The planting's other plants stay where they were.
export function drawFill(p, f, sown, pts) {
  const c = container(p.containerId); if (!c || f.drawn) return;
  const L = Draw.layout(c, p); if (L.many || L.drill) return;   // too many to place one by one, or a drill
  // where: the spots round the middle furthest from the plants already there
  let add = pts;
  if (!add) {
    const have = L.pts, cand = fewSpots(c, p, Math.min(12, have.length + f.n)) || [];
    add = []; for (let k = 0; k < f.n && cand.length; k++) {
      const far = q => Math.min(Infinity, ...have.concat(add).map(h => Math.hypot(h[0] - q[0], h[1] - q[1])));
      cand.sort((a, b) => far(b) - far(a)); add.push(cand.shift());
    }
  }
  add = add.map(q => [q[0], q[1], sown || f.date]);
  if (!add.length) return;
  p.positions = L.pts.map(q => q.slice()).concat(add); p.layout = 'free'; f.drawn = true;
}
// seedlings planted out as a planting of their own where the same crop already grows, that were really filling its
// gaps: they join it — where they were placed — and the extra planting goes
export function mergeAsFill(dup, into) {
  const c = container(dup.containerId), placed = c ? Draw.layout(c, dup).pts : [];
  let first = true;
  for (const s of S.starts || []) for (const e of s.events || []) if (e.type === 'out' && e.pid === dup.id) {
    e.pid = into.id; e.fill = true;
    const f = { date: e.date, n: first && placed.length ? placed.length : e.n, startId: s.id }; (into.fills = into.fills || []).push(f);
    drawFill(into, f, dup.seededOn || s.sowDate, first && placed.length ? placed : null); first = false;
  }
  S.tasks = S.tasks.filter(t => t.plantingId !== dup.id);
  S.plantings = S.plantings.filter(x => x !== dup);
  if (c) c.history = (c.history || []).filter(h => h.plantingId !== dup.id);
}
// the planting this one could have been filling gaps in: the same crop, already growing in the same space when these were planted out
export const fillTarget = p => p.startId && activeIn(p.containerId).find(x => x.id !== p.id && x.cropId === p.cropId && x.sowDate <= p.sowDate && x.from < p.to - 0.01 && x.to > p.from + 0.01);
// n seedlings from group s into another tray or pots: their own group from then on (up already: no more looks for them)
export function moveSeedlings(s, n, date, at, per = 1) {
  per = Math.max(1, Math.round(+per || 1));
  const plants = plantsOf(s, n), pots = Math.max(1, Math.ceil(plants / per));   // n of s's pots or cells hold `plants` seedlings
  if (at && at.nid && !at.kind) at = Object.assign({ kind: ntype(at.nid).kind }, at, ntype(at.nid).kind === 'tray' ? { tray: at.tray || nextTrayNo() } : { tray: null });
  const ns = { id: uid(), status: 'growing', created: new Date().toISOString(), events: [], cropId: s.cropId, variety: s.variety || '', kind: at.kind, nid: at.nid, tray: at.kind === 'tray' ? at.tray : null, count: pots, seeds: null, per: per > 1 ? per : null,
    sowDate: s.sowDate, upOn: s.upOn || null, kept: s.kept, keptLog: s.keptLog ? s.keptLog.map(e => Object.assign({}, e)) : undefined, leaves: (s.leaves || []).slice(), from: s.id, movedOn: date };
  if (s.germ) ns.germ = Object.assign(JSON.parse(JSON.stringify(s.germ)), { stopped: true, over: true });
  (S.starts = S.starts || []).push(ns);
  (s.events = s.events || []).push({ id: uid(), type: 'move', date, n, to: ns.id });
  if (startLeft(s) <= 0) s.status = 'done';
  syncStartTasks(s); syncStartTasks(ns);
  return ns;
}
// what happened to some of them, in a few words
function eventText(e) {
  if (e.type === 'out' && e.fill) return `${e.n} filled gaps in ${esc((container((planting(e.pid) || {}).containerId) || {}).name || 'a bed')} ${shortDate(e.date)}`;
  if (e.type === 'out') return `${e.n} planted in ${esc((container((planting(e.pid) || {}).containerId) || {}).name || 'a bed')} ${shortDate(e.date)}`;
  if (e.type === 'move' || e.type === 'pot') { const to = start(e.to); return `${e.n} replanted into ${esc(to ? startWhere(to) : 'pots')} ${shortDate(e.date)}`; }
  if (e.type === 'resow') return e.gaps ? `empty cells re-sown ${shortDate(e.date)}` : `re-sown ${shortDate(e.date)} (first sown ${shortDate(e.was)})`;
  return `${e.n} discarded ${shortDate(e.date)}${e.reason ? ` (${esc(e.reason.toLowerCase())})` : ''}`;
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
  d.startId = s.id; d.startN = Math.min(+q.get('n') || startLeft(s), startLeft(s)); d.startPlants = plantsOf(s, d.startN);
  d.method = 'seedling'; d.variety = s.variety || d.variety;
  if (cr.method === 'seed') {   // seed crops raised in a tray: final spacing, and harvest still counts from sowing
    if (cr.thinSp) d.plantSp = Math.max(+cr.sowSp || 0, +cr.thinSp);
    d.seededOn = s.sowDate; d.harvestManual = false; recalc(d);
  }
  d.notes = d.notes || `Raised in ${startWhere(s).toLowerCase()}, sown ${shortDate(s.sowDate)}`;
  placeFew(d, d.startPlants);
}
// where n seedlings go in a bag or pot: spaced round the middle of the section (one in the middle) — null in a bed
export function fewSpots(c, d, n) {
  if (!c || c.type === 'bed' || !(n > 0) || n > 12) return null;
  const { W } = Draw.dims(c), m = +c.margin || 0, cy = (+d.from + +d.to) / 2;
  if (n === 1) return [[Math.round(W / 2 * 10) / 10, Math.round(cy * 10) / 10]];
  const rx = Math.max(2, (W / 2 - m) * 0.5), ry = Math.max(2, ((+d.to - +d.from) / 2 - m) * 0.5);
  return Array.from({ length: n }, (_, i) => { const a = Math.PI * 2 * i / n + (n === 2 ? 0 : -Math.PI / 2); return [Math.round((W / 2 + rx * Math.cos(a)) * 10) / 10, Math.round((cy + ry * Math.sin(a)) * 10) / 10]; });
}
// a few seedlings into a bag or pot: that many plants (beds keep their rows)
function placeFew(d, n) {
  const pts = fewSpots(container(d.containerId), d, n); if (!pts) return;
  if (n === 1) { d.layout = 'center'; return; }
  d.layout = 'free'; d.positions = pts;
}
export function startPlanted(d, p) {
  const s = start(d.startId); if (!s) return;
  p.startId = s.id; p.seededOn = s.sowDate; p.raisedIn = s.kind; p.raisedName = ntype(s).name;
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
    if (!s.from) out.push({ date: s.sowDate, kind: 'sow', title: `Sowed ${n}${s.variety ? ' · ' + s.variety : ''} in ${s.count} ${unitOf(s)}${s.count > 1 ? 's' : ''}`, sub: where, href, cids: [], pids: [] });
    const looks = s.from ? [] : germChecks(s);   // (a potted-on group carries its tray's looks: they're logged there)
    if (looks.length) for (const k of looks) out.push({ date: k.date, kind: 'note', title: `${n} seedlings: ${pctText(k)}`, sub: where, href, cids: [], pids: [] });
    else if (s.upOn && !s.from) out.push({ date: s.upOn, kind: 'note', title: `${n} seedlings came up`, sub: where, href, cids: [], pids: [] });
    if (s.from && (s.movedOn || s.pottedOn)) out.push({ date: s.movedOn || s.pottedOn, kind: 'sow', title: `Replanted ${s.count} ${n} seedlings`, sub: `${start(s.from) ? startWhere(start(s.from)) : 'tray'} → ${where}`, href, cids: [], pids: [] });
    for (const e of s.events || []) {
      const p = e.pid && planting(e.pid), c = p && container(p.containerId);
      if (e.type === 'out' && e.fill) out.push({ date: e.date, kind: 'sow', title: `Filled gaps in the ${n.toLowerCase()} with ${e.n} seedling${e.n === 1 ? '' : 's'}`, sub: `${where} → ${c ? c.name : 'bed'}`, href: p ? '#/plant/' + p.id : href, cids: c ? [c.id] : [], pids: p ? [p.id] : [] });
      else if (e.type === 'out') out.push({ date: e.date, kind: 'sow', title: `Planted out ${e.n} ${n} seedlings`, sub: `${where} → ${c ? c.name : 'bed'}`, href: p ? '#/plant/' + p.id : href, cids: c ? [c.id] : [], pids: p ? [p.id] : [] });
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
// your trays and pots: add a size, change one, or remove one you no longer use
export function nurseryDialog() {
  let editing = null;
  const inUse = t => startsGrowing().some(s => ntype(s).id === t.id);
  modal('<div></div>', (m, close) => {
    const draw = () => {
      const all = nurseryTypes(), e = editing && all.find(t => t.id === editing), kind = e ? e.kind : 'tray';
      m.querySelector('.sheet').innerHTML = `<h3>Your trays & pots</h3>
        <ul class="plist">${all.map(t => `<li><span class="grow"><b>${esc(t.name)}</b><small>${t.kind === 'tray' ? `${t.cols || Math.round(Math.sqrt(t.cells))} across` : 'pots'}${t.size ? ' · ' + esc(t.size) : ''}${inUse(t) ? ' · in use' : ''}</small></span><button type="button" class="link" data-ed="${t.id}">change</button>${inUse(t) || all.filter(x => x.kind === t.kind).length < 2 ? '' : `<button type="button" class="link danger" data-rm="${t.id}">remove</button>`}</li>`).join('')}</ul>
        <form id="nuf" class="form"><h4>${e ? 'Change ' + esc(e.name) : 'Add a size'}</h4>
          ${e ? '' : `<div class="seg"><button type="button" data-k="tray" class="on">Tray</button><button type="button" data-k="pot">Pots</button></div>`}
          <div class="two" data-for="tray"${kind === 'tray' ? '' : ' hidden'}><label>Cells<input name="cells" type="number" min="1" inputmode="numeric" value="${e && e.cells || ''}"></label><label>Across<input name="cols" type="number" min="1" inputmode="numeric" value="${e && e.cols || ''}" placeholder="optional"></label></div>
          <label data-for="pot"${kind === 'pot' ? '' : ' hidden'}>Pot width (cm)<input name="cm" type="number" min="1" step="0.5" inputmode="decimal" value="${e && e.cm || ''}"></label>
          <label>Size <small>(optional, for your notes)</small><input name="size" value="${esc(e && e.size || '')}" placeholder="e.g. 28 × 28 cm, 5 cm deep"></label>
          <div class="btns">${e ? '<button type="button" class="btn" data-x="new">Add a size instead</button>' : ''}<button type="button" class="btn" data-x="no">Done</button><button class="btn primary">${e ? 'Save' : 'Add'}</button></div></form>`;
      let k = kind;
      m.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { k = b.dataset.k; m.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('on', x === b)); m.querySelectorAll('#nuf [data-for]').forEach(x => { x.hidden = x.dataset.for !== k; }); });
      m.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => { editing = b.dataset.ed; draw(); });
      m.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => { addNurseryType.ensure(); S.nursery.items = S.nursery.items.filter(t => t.id !== b.dataset.rm); await save(); draw(); });
      m.querySelector('[data-x=no]').onclick = () => { close(); render(); };
      const nw = m.querySelector('[data-x=new]'); if (nw) nw.onclick = () => { editing = null; draw(); };
      m.querySelector('#nuf').onsubmit = async ev => {
        ev.preventDefault(); const f = ev.target, size = f.size.value.trim();
        if (k === 'tray' && !(+f.cells.value > 0 && +f.cells.value <= 500)) return alert('How many cells does the tray have?');
        if (k === 'pot' && !(+f.cm.value > 0 && +f.cm.value <= 60)) return alert('How wide are the pots, in cm?');
        if (e) {
          addNurseryType.ensure(); const t = S.nursery.items.find(x => x.id === e.id);
          if (k === 'tray') { const c = +f.cells.value, used = Math.max(0, ...trayNos().filter(no => trayType(no).id === t.id).map(no => t.cells - trayFree(no))); if (c < used) return alert(`A tray of this size has ${used} cells in use.`); Object.assign(t, { cells: c, cols: +f.cols.value || Math.round(Math.sqrt(c)), size }); }
          else Object.assign(t, { cm: +f.cm.value, size });
        } else addNurseryType(k === 'tray' ? { kind: 'tray', cells: +f.cells.value, cols: +f.cols.value, size } : { kind: 'pot', cm: +f.cm.value, size });
        editing = null; await save(); draw();
      };
    };
    draw();
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
