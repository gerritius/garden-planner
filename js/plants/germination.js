// Coming up: seeds sown where they grow, and seedlings sown in trays or small pots, are looked at every few days until they're up. Each look records roughly what
// share has come up (0–100 %). Nothing yet → look again in a few days (cold soil can take weeks, spinach especially);
// some → look again until most are up or it stops changing. When they came up is worked out from the looks, and
// thinning and harvest are counted from that — while nothing is up, nothing is counted as if it were.
//
// p.germ = { checks: [{ date, pct, rough? }], stopped?, — and, worked out from those: date (when they came up, or null),
//            pct (the latest share), result ('none' | 'patchy' | 'good'), over (no more looks needed) }
// The same on a seedling group in a tray or pots (s.germ), whose s.upOn is then the day they came up.

import { render } from '../core/router.js';
import { S, save } from '../core/state.js';
import { modal } from '../core/ui.js';
import { addDays, daysBetween, esc, shortDate, todayStr, uid } from '../core/util.js';
import { Draw } from '../draw.js';
import { container } from '../garden/garden.js';
import { syncTasks } from '../garden/tasks.js';
import { crop } from './crops.js';
import { germWindow, harvestEstimate, thinEstimate } from './growth.js';
import { startLeft, syncStartTasks, unitOf } from './seedlings.js';

export const MOSTLY = 70;   // % up that counts as come up well: no more looks
const AGAIN_NONE = 3, AGAIN_SOME = 4;   // days to the next look
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
// (a germination saved the old way — one answer, no looks — reads as that one look)
const oldLook = g => g.result === 'none' ? { date: g.date, pct: 0 } : g.result === 'patchy' ? { date: g.date, pct: 40, rough: true } : { date: g.date, pct: 90 };
export const germChecks = p => { const g = p.germ; if (!g) return []; return (Array.isArray(g.checks) ? g.checks : g.date ? [oldLook(g)] : []).slice().sort(byDate); };
export const lastCheck = p => germChecks(p).pop() || null;
export const notUpYet = p => !!(p.germ && p.germ.result === 'none');
const lc = p => crop(p.cropId).en.toLowerCase();
// a seedling group (tray or small pots) rather than a planting in a bed or pot
const isStart = o => o.kind === 'tray' || o.kind === 'pot';
// when they should come up: seedlings kept indoors come up at warm-soil speed
function gwOf(o) {
  if (!isStart(o)) return germWindow(o);
  const g = crop(o.cropId).germ;
  if ((o.kept || 'out') === 'in' && g) return [addDays(o.sowDate, g[0]), addDays(o.sowDate, g[1])];
  return germWindow({ cropId: o.cropId, method: 'seed', sowDate: o.sowDate });
}
const resync = o => isStart(o) ? syncStartTasks(o) : syncTasks(o);
export const pctText = c => c.rough ? 'patchy' : c.pct <= 0 ? 'none up yet' : c.pct >= 100 ? 'all up' : `about ${c.pct}% up`;

// when they came up: the day about half of those that came up were up — between the look before and the look after
function upDate(cs) {
  const max = Math.max(0, ...cs.map(c => c.pct)); if (!max) return null;
  const half = max / 2, i = cs.findIndex(c => c.pct >= half), c = cs[i], b = cs[i - 1];
  if (!b) return c.date;   // up at the first look
  return addDays(b.date, Math.round(daysBetween(b.date, c.date) * (half - b.pct) / Math.max(1, c.pct - b.pct)));
}
function summarise(p) {
  const cs = germChecks(p), last = cs[cs.length - 1];
  if (!last) { p.germ = null; return; }
  const g = p.germ, prev = cs[cs.length - 2];
  g.checks = cs; g.date = upDate(cs); g.pct = last.pct;
  g.result = last.pct <= 0 ? 'none' : last.rough || last.pct < MOSTLY ? 'patchy' : 'good';
  // done looking: most are up, you said so, or it hasn't changed in the last few days
  g.over = !!g.stopped || last.pct >= MOSTLY || (!!prev && last.pct > 0 && Math.abs(last.pct - prev.pct) <= 2 && daysBetween(prev.date, last.date) >= 3);
}
export function recordGermCheck(p, { date, pct }) {
  const g = p.germ = p.germ || { checks: [] };
  g.checks = (g.checks || []).filter(c => c.date !== date).concat({ date, pct: Math.max(0, Math.min(100, Math.round(+pct || 0))) });
  g.stopped = false; summarise(p);
}
export function removeGermCheck(p, date) { if (!p.germ) return; p.germ.checks = germChecks(p).filter(c => c.date !== date); summarise(p); settleStart(p); }
export function moveGermCheck(p, from, to) { const c = germChecks(p).find(x => x.date === from); if (!c || from === to) return; removeGermCheck(p, to); c.date = to; if (p.germ) { p.germ.checks = germChecks(p).filter(x => x.date !== from).concat(c); summarise(p); settleStart(p); } }
function stopLooking(p) { if (p.germ) { p.germ.stopped = true; summarise(p); } }

// data version 8: the one answer the old check gave becomes the first look
export function migrateGermChecks() {
  const td = todayStr();
  for (const p of S.plantings || []) {
    const g = p.germ; if (!g || Array.isArray(g.checks)) continue;
    if (!g.date) { p.germ = null; continue; }
    const none = g.result === 'none', patchy = g.result === 'patchy';
    p.germ = { checks: [oldLook(g)], stopped: patchy || (none && daysBetween(g.date, td) > 30) };
    const t = (S.tasks || []).find(x => x.plantingId === p.id && x.kind === 'germ' && x.done && x.doneOn === g.date); if (t) t.look = g.date;
    summarise(p);
  }
}

// ---------- the job: look at them ----------
function slowNote(p) {
  const gw = gwOf(p), cr = crop(p.cropId), td = todayStr(); if (!gw || td <= gw[1]) return '';
  const days = daysBetween(p.sowDate, td), cold = cr.germ && daysBetween(p.sowDate, gw[1]) > cr.germ[1] * 1.15;
  return ` — ${days} days since sowing${cold ? ', slow in the cold' : ''}`;
}
export function nextLook(p) {
  const gw = gwOf(p); if (!gw) return null;
  const last = lastCheck(p); if (!last) return gw[1];
  return p.germ.over ? null : addDays(last.date, last.pct > 0 ? AGAIN_SOME : AGAIN_NONE);
}
function lookTitle(p) {
  const gw = gwOf(p), last = lastCheck(p);
  if (!last) return `Check seedlings are up (expected ${shortDate(gw[0])}–${shortDate(gw[1])})`;
  return last.pct > 0 ? `Check how many ${lc(p)} have come up (${pctText(last).replace(' up', '')} on ${shortDate(last.date)})`
    : `Check whether the ${lc(p)} is up yet (nothing on ${shortDate(last.date)}${slowNote(p)})`;
}
export function syncGermTask(p) {
  const due = p.method === 'seed' && !p.no_germ && p.status === 'active' ? nextLook(p) : null;
  const open = S.tasks.find(t => t.plantingId === p.id && t.kind === 'germ' && !t.done);
  if (!due) { if (open) S.tasks = S.tasks.filter(x => x !== open); return; }
  const title = lookTitle(p);
  if (open) { open.due = due; open.title = title; return; }
  if (!lastCheck(p) && S.tasks.some(t => t.plantingId === p.id && t.kind === 'germ' && t.done && !t.look && !t.resown && t.doneOn >= p.sowDate)) return;   // ticked before looks were recorded
  S.tasks.push({ id: uid(), plantingId: p.id, kind: 'germ', title, due, done: false });
}
// seedlings in a tray or pots: the same looks, as their 'sgerm' job (none once they were marked up the old way)
export function syncStartGerm(s) {
  const due = s.status === 'growing' && !s.no_sgerm && !(s.upOn && !s.germ) ? nextLook(s) : null;
  const open = S.tasks.find(t => t.startId === s.id && t.kind === 'sgerm' && !t.done);
  if (!due) { if (open) S.tasks = S.tasks.filter(x => x !== open); return; }
  const title = lookTitle(s);
  if (open) { open.due = due; open.title = title; return; }
  if (!lastCheck(s) && S.tasks.some(t => t.startId === s.id && t.kind === 'sgerm' && t.done && !t.look && !t.resown && t.doneOn >= s.sowDate)) return;
  S.tasks.push({ id: uid(), startId: s.id, kind: 'sgerm', title, due, done: false });
}
// after a look at seedlings: the day they came up (none while nothing is up)
const settleStart = s => { if (isStart(s)) s.upOn = (s.germ && s.germ.date) || null; };

// ---------- in words ----------
export function germText(p, short) {
  const g = p.germ, last = lastCheck(p); if (!g || !last) return '';
  const days = g.date ? daysBetween(p.sowDate, g.date) : null, when = g.date ? (short ? `in ${days} day${days === 1 ? '' : 's'}` : `~${shortDate(g.date)}`) : '';
  if (g.result === 'none') return g.over ? 'nothing came up' : short ? 'not up yet' : `nothing up yet (looked ${shortDate(last.date)})`;
  if (g.result === 'good') return `came up well${when ? (short ? ' ' : ', ') + when : ''}`;
  return `${pctText(last).replace(' up', '')}${when ? ` · ${g.over ? 'came' : 'coming'} up ${when}` : ''}`;
}

// ---------- recording a look ----------
export function germDialog(p, opts = {}) {
  const gw = gwOf(p), cs = germChecks(p), td = todayStr(), since = daysBetween(p.sowDate, td), st = isStart(p);
  // counting them: cells or pots with a seedling, spots sown (rows, stations) — or, for a drill sown a seed every
  // centimetre or so, the seedlings along a short stretch of row (nobody counts a whole drill)
  const c = !st && container(p.containerId), drill = !st && p.layout === 'continuous' && !p.thinned;
  const sp = st ? 0 : Draw.spacingNow(p), stretch = sp >= 4 ? 30 : 10;
  const per = st ? startLeft(p) : drill ? Math.max(1, Math.round(stretch / sp)) : c ? Draw.count(c, p) : 0;
  const unit = st ? unitOf(p) : '';
  const chips = [[0, 'None yet'], [5, 'A few'], [25, 'A quarter'], [50, 'Half'], [75, 'Most'], [100, 'All']];
  modal(`<h3>How many of the ${esc(lc(p))} have come up?</h3>
    <p class="muted small">Sown ${shortDate(p.sowDate)} (${since} day${since === 1 ? '' : 's'} ago)${gw ? ` · expected ${shortDate(gw[0])}–${shortDate(gw[1])}` : ''}${cs.length ? `<br>So far: ${cs.map(x => `${shortDate(x.date)} ${esc(pctText(x))}`).join(' · ')}` : ''}</p>
    <form id="gcf" class="form">
      <div class="sowchips">${chips.map(([v, l]) => `<button type="button" class="chip big" data-pct="${v}">${l}</button>`).join('')}</div>
      <label>Roughly what share has come up? <small>(a guess is fine)</small><span class="pctin"><input name="pct" type="number" inputmode="numeric" min="0" max="100" step="1" required placeholder="e.g. 20"> %</span></label>
      ${drill ? `<label>…or count the seedlings along ${stretch} cm of row <small>(about ${per} seeds sown there — one every ${sp} cm)</small><span class="pctin"><input name="cnt" type="number" inputmode="numeric" min="0" step="1"> up</span></label>`
        : st && per > 1 ? `<label>…or count the ${unit}s with a seedling up <small>(of ${per} ${unit}s sown)</small><span class="pctin"><input name="cnt" type="number" inputmode="numeric" min="0" max="${per}" step="1"> up</span></label>`
        : per > 1 ? `<label>…or count them <small>(of about ${per.toLocaleString('en-AU')} spots sown)</small><span class="pctin"><input name="cnt" type="number" inputmode="numeric" min="0" step="1"> up</span></label>` : ''}
      <label>Looked on<input name="date" type="date" value="${td}" min="${p.sowDate}" max="${td}"></label>
      <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary">Save</button></div></form>`, (m, close) => {
    const f = m.querySelector('#gcf');
    const mark = () => m.querySelectorAll('[data-pct]').forEach(b => b.classList.toggle('on', f.pct.value !== '' && +b.dataset.pct === +f.pct.value));
    m.querySelectorAll('[data-pct]').forEach(b => b.onclick = () => { f.pct.value = b.dataset.pct; if (f.cnt) f.cnt.value = ''; mark(); });
    f.pct.oninput = () => { if (f.cnt) f.cnt.value = ''; mark(); };
    if (f.cnt) f.cnt.oninput = () => { if (f.cnt.value !== '') f.pct.value = Math.min(100, Math.round(+f.cnt.value / per * 100)); mark(); };
    m.querySelector('[data-x=no]').onclick = () => { close(); render(); };
    f.onsubmit = async e => {
      e.preventDefault();
      const date = f.date.value && f.date.value <= td ? f.date.value : td, pct = +f.pct.value;
      recordGermCheck(p, { date, pct });
      const t = opts.task; if (t) { t.done = true; t.doneOn = date; t.look = date; }
      settleStart(p); resync(p); await save(); close();
      if (p.germ.result === 'good') return render();
      setTimeout(() => afterLook(p), 320);
    };
  });
}
// what next, after a look that didn't find them all up
function afterLook(p) {
  const g = p.germ, td = todayStr(), gw = gwOf(p), since = daysBetween(p.sowDate, (lastCheck(p) || { date: td }).date), again = nextLook(p), st = isStart(p);
  const long = gw && since > 3 * Math.max(5, daysBetween(p.sowDate, gw[1]));
  const keep = again ? `look again ~${shortDate(again)}` : 'look again in a few days', remind = again ? `the app will remind you to ${keep}` : keep;
  let msg, btns;
  if (g.result === 'none') {
    msg = long ? `Still nothing after ${since} days — longer than ${esc(lc(p))} usually takes, even in cold soil. The seed may not have taken.`
      : `Nothing up yet after ${since} days. ${esc(crop(p.cropId).en)} can take a while, especially in cold soil — keep it moist, and ${remind}. ${st ? 'Planting out' : 'Thinning'} waits until they're up.`;
    btns = [['keep', `Keep waiting — ${keep}`, !long], ['all', 'Re-sow today (dates start again)', long], ['stop', 'Stop checking — nothing will come up']];
  } else if (!g.over) {
    msg = `${pctText(lastCheck(p)).replace(/^./, s => s.toUpperCase())}. More may still come — ${remind}. If that's all that will come up, re-sow the ${st ? 'empty ' + unitOf(p) + 's' : 'gaps'}.`;
    btns = [['keep', `Keep checking — ${keep}`, true], ['gaps', `That’s all — I re-sowed the ${st ? 'empty ' + unitOf(p) + 's' : 'gaps'} today`], ['leave', 'That’s all — leave it as it is'], ['all', 'Re-sow everything today (dates start again)']];
  } else {
    msg = `${pctText(lastCheck(p)).replace(/^./, s => s.toUpperCase())} — the same as last time, so that's probably all that will come up. Re-sow the ${st ? 'empty ' + unitOf(p) + 's' : 'gaps'}?`;
    btns = [['gaps', `I re-sowed the ${st ? 'empty ' + unitOf(p) + 's' : 'gaps'} today`, true], ['leave', 'Leave it as it is'], ['all', 'Re-sow everything today (dates start again)']];
  }
  modal(`<h3>${g.result === 'none' ? 'Nothing up yet' : 'Patchy so far'}</h3><p class="msg">${msg}</p>
    <div class="btns col">${btns.map(([k, l, main]) => `<button class="btn${main ? ' primary' : ''}" data-r="${k}">${l}</button>`).join('')}</div>`, (m, close) => {
    m.querySelectorAll('[data-r]').forEach(b => b.onclick = async () => {
      const r = b.dataset.r;
      if (r === 'gaps') {
        if (st) (p.events = p.events || []).push({ id: uid(), type: 'resow', date: td, n: 0, gaps: true });
        else S.tasks.push({ id: uid(), plantingId: p.id, kind: 'custom', title: 'Re-sowed gaps (patchy germination)', due: td, done: true, doneOn: td });
        stopLooking(p);
      }
      if (r === 'leave' || r === 'stop') stopLooking(p);
      if (r === 'all') (st ? resowStart : resow)(p);
      resync(p); await save(); close(); render();
    });
  });
}
function resowStart(s) {
  const td = todayStr();
  S.tasks = S.tasks.filter(t => !(t.startId === s.id && !t.done && ['sgerm', 'transplant'].includes(t.kind)));
  for (const t of S.tasks) if (t.startId === s.id && t.kind === 'sgerm') t.resown = true;
  (s.events = s.events || []).push({ id: uid(), type: 'resow', date: td, n: 0, was: s.sowDate });
  s.sowDate = td; s.germ = null; s.upOn = null;
}
function resow(p) {
  const cr = crop(p.cropId), td = todayStr();
  S.tasks = S.tasks.filter(t => !(t.plantingId === p.id && (['thin', 'harvest', 'pickby'].includes(t.kind) || (t.kind === 'germ' && !t.done))));
  for (const t of S.tasks) if (t.plantingId === p.id && t.kind === 'germ') t.resown = true;   // looks at the first sowing stay in the record
  S.tasks.push({ id: uid(), plantingId: p.id, kind: 'custom', title: `Re-sown (was sown ${shortDate(p.sowDate)})`, due: td, done: true, doneOn: td });
  p.sowDate = td; p.thinned = false; p.thinDoneOn = null; p.germ = null;
  if (cr.daysThin && p.thinSp && !p.thinFixed) p.thinDate = thinEstimate(p);
  if (cr.daysHarvest && !p.harvestFixed) p.harvestDate = harvestEstimate(p);
}
