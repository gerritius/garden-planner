// How plants develop with the temperature they get: when seedlings come up, when to thin, true leaves, when the
// harvest starts and how long the crop keeps (packet days, main harvest, holding in the ground).

import { coverWarmth, dayTemp, growUnits, normalT, refNormalT, tempFor } from '../climate/climate.js';
import { render } from '../core/router.js';
import { S, save } from '../core/state.js';
import { modal } from '../core/ui.js';
import { addDays, daysBetween, esc, pd, shortDate, todayStr } from '../core/util.js';
import { container, isLive, isPlanned } from '../garden/garden.js';
import { raisable, syncPlanTasks } from '../garden/planning.js';
import { SOIL_T, soilTempFor, soilTemps } from '../garden/soil.js';
import { syncTasks, upsertAuto } from '../garden/tasks.js';
import { crop, kin } from './crops.js';
import { germChecks, notUpYet, syncGermTask } from './germination.js';
import { ddBetween, learnedFactor, learnedText } from './learning.js';
import { startsGrowing, syncStartTasks, tpDays, transplantOf, trayDateOf } from './seedlings.js';
import { GROW, HEADING } from '../data/catalog.js';

// ---------- thinning: counted from when seedlings came up, at the speed the temperature allows ----------
export function emergeDate(p) {
  if (p.germ && p.germ.date && p.germ.result !== 'none') return { d: p.germ.date, known: true };
  const gw = germWindow(Object.assign({}, p, { method: 'seed' }));
  const mid = gw ? daysBetween(p.sowDate, gw[0]) + daysBetween(gw[0], gw[1]) / 2 : 7;
  const d = addDays(p.sowDate, Math.round(mid * (p.cropId ? learnedFactor(p.cropId, 'germ') : 1)));
  // looked and nothing up yet: they come up tomorrow at the earliest (not on the expected day that has gone by)
  if (notUpYet(p)) { const tm = addDays(todayStr(), 1); return { d: d > tm ? d : tm, known: false, notUp: true }; }
  return { d, known: false };
}
// ---------- growth speed: each crop's own response to temperature ----------
// From the daily mean (°C): no growth at or below tb, the packet's speed at tref, no faster above tcap (a straight line in
// between). Warm-season crops follow a curve instead — `warm: [lo, opt]`: nothing at or below lo, picking up quickly and
// close to full speed from opt — which fits them better than a straight line (see growUnits). The values are checked
// against how each crop is known to behave here: komatsuna ~25 days in summer and ~80–90 sown in December, spring
// cabbage heading in spring, eggplant and peppers needing more heat than tomatoes, and sweet potato and taro planted in May dug in autumn. Each crop's values are its grow, in its record (data/crops.js).
// a crop of your own: from the growing temperatures on its packet (生育適温, e.g. 15–25 °C) — or, without them, plain
// days (calendar days, not stretched by the cold or sped up by warmth) rather than a guess
export function ownGrow(cr) {
  const lo = +cr.tempLo, hi = +cr.tempHi;
  if (!(lo > 0 && hi > lo)) return { tb: 0, tref: 1, tcap: 1, plain: true };
  return lo >= 18 ? { tb: lo - 10, tref: lo + 4, tcap: hi, warm: [lo - 11, lo + 1] } : { tb: Math.max(0, lo - 14), tref: lo + 2, tcap: hi };
}
export const growParams = id => {
  const own = (S.customCrops || []).find(c => c.id === id);
  if (own && +own.tempLo > 0 && +own.tempHi > +own.tempLo) return ownGrow(own);   // your packet's temperatures win
  return GROW[kin(id)] || ownGrow(crop(id));                                     // else the crop it's like (or plain days)
};
export const isWarmCrop = id => !!growParams(id).warm;
function ddUntil(from, need, id, tempFn) {
  const daily = S.weather && S.weather.daily, T = tempFn || (x => dayTemp(x, daily));
  let d = from, acc = 0;
  for (let i = 0; i < 400 && acc < need; i++) { d = addDays(d, 1); acc += growUnits(id, T(d)); }
  return d;
}
// leaf-stage milestones (thinning, ready to plant out): catalogue days are warm-weather numbers, so use a fixed reference temperature
function leafDate(id, emerge, leafDays, tempFn, factor) { const g = growParams(id); return ddUntil(emerge, Math.max(3, leafDays) * (g.tref - g.tb) * (factor || 1), id, tempFn); }
// `days` of growth from a date, at the pace the temperatures there allow (a cold spell stretches them)
export const growthDate = (id, from, days, containerId, p) => leafDate(id, from, days, tempFor(containerId, p));
export const germAvg = id => { const g = crop(id).germ || [5, 10]; return (g[0] + g[1]) / 2; };
export function thinEstimate(p) {
  const cr = crop(p.cropId); if (!cr.daysThin || !p.sowDate) return p.thinDate || '';
  const tf = tempFor(p.containerId, p), e = emergeDate(p).d;
  return leafAnchored(p, p.cropId, e, leafTarget(p.thinStage || cr.thinStage), tf) || leafDate(p.cropId, e, Math.max(5, cr.daysThin - germAvg(p.cropId)), tf, learnedFactor(p.cropId, 'thin'));
}
// seedlings in trays/pots: ready to plant out
export function startEmerge(s) {
  if (s.upOn) return s.upOn;
  const est = keptAt(s, s.sowDate) === 'in' ? addDays(s.sowDate, Math.round(germAvg(s.cropId)))   // sown in a warm room: warm-soil speed
    : emergeDate({ cropId: s.cropId, sowDate: s.sowDate, method: 'seed' }).d;
  if (notUpYet(s)) { const tm = addDays(todayStr(), 1); return est > tm ? est : tm; }   // looked, nothing up yet
  return est;
}
export const KEPT = [['out', 'Outside', 0], ['cover', 'Under cover / cold frame', 3], ['in', 'Indoors / heated', 8]];
// where seedlings were on a given day: s.keptLog records moves ([{ date, kept }], the first from sowing); without one, s.kept
export const keptAt = (s, d) => { const log = s.keptLog || []; let k = log.length ? log[0].kept : s.kept; for (const e of log) if (e.date <= d) k = e.kept; return k || 'out'; };
const keptBoost = k => (KEPT.find(x => x[0] === k) || KEPT[0])[2];
// temperature the seedlings see each day: outside, under cover (a few degrees warmer), or indoors (heated room — at least
// ~18 °C) — wherever they were that day (null: outside all along)
export const keptTemp = s => {
  if (![s.kept, ...(s.keptLog || []).map(e => e.kept)].some(k => k && k !== 'out')) return null;
  const daily = S.weather && S.weather.daily;
  return x => { const k = keptAt(s, x), t = dayTemp(x, daily) + keptBoost(k); return k === 'in' ? Math.max(t, 18) : t; };
};
// moved somewhere else (outside, under cover, indoors) on `date`
export function moveKept(s, kept, date) {
  if ((s.kept || 'out') === kept) return;
  const before = (s.keptLog && s.keptLog.length ? s.keptLog : [{ date: s.sowDate, kept: s.kept || 'out' }]).filter(e => e.date < date);
  s.keptLog = before.length ? before.concat({ date, kept }) : [{ date: s.sowDate, kept }];   // (moved the day they were sown: there all along)
  s.kept = kept;
}
export const keptText = s => { const l = (KEPT.find(k => k[0] === (s.kept || 'out')) || KEPT[0])[1].toLowerCase(), log = s.keptLog || []; return log.length > 1 ? `${l} since ${shortDate(log[log.length - 1].date)}` : l; };
// ready to plant out: from your leaf count when there is one, else the crop's days to planting out at the pace the
// temperatures allow (null when the crop's days aren't known — a crop of your own without them)
export function startReady(s) {
  const tf = keptTemp(s), e = startEmerge(s), tp = transplantOf(s.cropId);
  const byLeaves = leafAnchored(s, s.cropId, e, leafTarget((tp || [])[1]), tf); if (byLeaves) return byLeaves;
  if (!tp || !(tp[0] > 0)) return null;
  return leafDate(s.cropId, e, Math.max(5, tp[0] - germAvg(s.cropId)), tf, learnedFactor(s.cropId, 'out'));
}
// harvest: catalogue days hold for sowing at the crop's usual (best) time; colder sowings stretch out
export const _need = {};
// Growth the catalogue days represent: packet days are for central Japan (中間地) at the crop's usual time there, so they
// are worth the growth those days give with central-Japan temperatures from the usual sowing month nearest to this
// sowing. Your own climate then decides how long that growth takes — cooler places slower, warmer ones faster — and a
// crop sown in spring where it's usually autumn-sown (onions in Hokkaido) isn't counted as sitting through a winter.
export function refMonth(id, effSow) {
  const c = crop(id), months = (c.sowRef && c.sowRef.length ? c.sowRef : c.sow) || [], m = pd(effSow).getMonth() + 1;
  if (!months.length) return m;
  // the usual month whose central-Japan weather is most like this sowing's here: closest temperature, the same way
  // (warming or cooling) — in central Japan that's the month itself; in Okinawa's January it's October, in Hokkaido's May, April
  const T = normalT(effSow), up = normalT(addDays(effSow, 30)) > T;
  const mid = mm => `2026-${String(mm).padStart(2, '0')}-15`;
  const score = mm => Math.abs(refNormalT(mid(mm)) - T) + ((refNormalT(addDays(mid(mm), 30)) > refNormalT(mid(mm))) === up ? 0 : 6);
  return months.slice().sort((a, b) => score(a) - score(b) || a - b)[0];
}
export function calibratedNeed(id, days, offset, month) {
  const k = [id, days, offset, month].join('|'); if (_need[k] != null) return _need[k];
  const from = addDays(`2026-${String(month).padStart(2, '0')}-15`, offset), end = addDays(from, days);
  let acc = 0; for (let d = from; d < end; d = addDays(d, 1)) acc += growUnits(id, refNormalT(d));
  return (_need[k] = acc || days * 8);
}
export function harvestModel(p, raw) {
  const cr = crop(p.cropId), dh = +p.daysFrom || cr.daysHarvest; if (!dh || !p.sowDate) return null;
  const g = germAvg(p.cropId);
  let from, days, offset, eff;
  if (p.method === 'seed') { from = emergeDate(p).d; days = dh - g; offset = g; eff = p.sowDate; }
  else if (cr.method === 'seed' && trayDateOf(p)) { const t = trayDateOf(p); from = t.up || emergeDate({ cropId: p.cropId, sowDate: t.d, method: 'seed' }).d; days = dh - g; offset = g; eff = t.d; }
  else if (cr.method === 'seed' && raisable(p.cropId)) { from = p.sowDate; days = Math.max(14, dh - tpDays(p.cropId)); offset = tpDays(p.cropId); eff = addDays(p.sowDate, -offset); }
  else { from = p.sowDate; days = dh; offset = 0; eff = p.sowDate; }
  const dd = Math.max(7, Math.round(days));
  return { from, days: dd, need: calibratedNeed(p.cropId, dd, Math.round(offset), refMonth(p.cropId, eff)) * (raw ? 1 : learnedFactor(p.cropId, 'harvest')) };
}
export function harvestEstimate(p) {
  const m = harvestModel(p); if (!m) return p.harvestDate || '';
  let d = ddUntil(m.from, m.need, p.cropId, tempFor(p.containerId, p));
  const fe = frostEnd(p); if (fe && d > fe) d = fe;   // autumn potatoes: the tops die back with the first frosts, so they're dug then
  return d < addDays(p.sowDate, 14) ? addDays(p.sowDate, 14) : d;
}
// for frost-tender crops planted for autumn: the date the first frosts usually finish the tops (normal mean temperature falls to ~8.5 °C)
export function frostEnd(p) {
  const cr = crop(p.cropId); if (!cr.frostEnd || !p.sowDate) return null;
  if (normalT(addDays(p.sowDate, 45)) >= normalT(p.sowDate)) return null;   // planted as it warms up (spring): dug before summer, not stopped by frost
  const c = container(p.containerId); if (c && c.indoor) return null;
  for (let d = addDays(p.sowDate, 30), i = 0; i < 200; i++, d = addDays(d, 1)) if (normalT(d) < 8.5) return d;
  return null;
}
// data version 2: plantings from before harvest dates followed the temperature keep dates that were clearly typed in by hand
export function migrateHarvestDates() {
  if (S.hvMig) return;
  for (const p of S.plantings) {
    if (p.status === 'harvested' || !p.harvestDate || !p.sowDate) continue;
    const cr = crop(p.cropId), dh = +cr.daysHarvest || 0, tp = raisable(p.cropId) ? tpDays(p.cropId) : 0;
    const old = [addDays(p.sowDate, dh), addDays(p.sowDate, Math.max(14, dh - tp)), p.seededOn ? addDays(p.seededOn, dh) : null].filter(Boolean);
    if (!old.some(o => Math.abs(daysBetween(o, p.harvestDate)) <= 1)) p.harvestFixed = true;
  }
  S.hvMig = true;
}
// keep harvest dates current unless set by hand or picking has started
export function syncHarvest() {
  for (const p of S.plantings) {
    if (p.status === 'harvested' || p.harvestFixed || (p.harvests || []).length || !crop(p.cropId).daysHarvest) continue;
    if (S.tasks.some(t => t.plantingId === p.id && t.kind === 'harvest' && t.done)) continue;
    const nd = harvestEstimate(p);
    if (nd && nd !== p.harvestDate) { p.harvestDate = nd; syncTasks(p); }
  }
  for (const p of S.plantings) if (isPlanned(p)) syncPlanTasks(p);   // tray-sowing reminders follow the weather too
  for (const s of startsGrowing()) syncStartTasks(s);                 // and plant-out dates of seedlings in trays
}
export function harvestNote(p) {
  if (p.harvestFixed) return 'date set by you';
  const c = container(p.containerId), m = harvestModel(p), cr = crop(p.cropId), t = trayDateOf(p);
  const base = m ? `${+p.daysFrom || cr.daysHarvest} days from ${p.method === 'seed' ? 'sowing' : t && cr.method === 'seed' ? 'tray sowing' : 'planting'} in usual weather, counted from ${shortDate(m.from)} at the pace the temperatures allow` : 'estimated from the catalogue and the temperatures';
  const bits = [base];
  if (c && (c.indoor || (c.sun || 'full') !== 'full')) bits.push(c.indoor ? 'indoors' : (c.sun === 'part' ? 'part sun' : 'shade'));
  const l = learnedText(p.cropId, 'harvest'); if (l) bits.push('your ' + crop(p.cropId).en.toLowerCase() + ' has been ' + l);
  return bits.join('; ');
}
// keep thinning dates up to date as germination is recorded and the weather comes in
export function syncThin() {
  for (const p of S.plantings) if (isLive(p) && p.method === 'seed') syncGermTask(p);   // the next look at seeds not up yet
  for (const p of S.plantings) {
    if (!isLive(p) || p.method !== 'seed' || p.thinned || p.thinFixed || !(+p.thinSp > 0) || !crop(p.cropId).daysThin) continue;
    const nd = thinEstimate(p);
    if (nd && nd !== p.thinDate) { p.thinDate = nd; syncTasks(p); }
  }
}
export function thinNote(p) {
  if (p.thinFixed) return 'date set by you';
  const e = emergeDate(p), L = lastLeaves(p), l = learnedText(p.cropId, 'thin');
  const anch = L && leafAnchored(p, p.cropId, e.d, leafTarget(p.thinStage || crop(p.cropId).thinStage), tempFor(p.containerId, p));
  if (anch) return `from your leaf count on ${shortDate(L.date)}`;
  if (e.notUp) { const k = germChecks(p).pop(); return `not up yet when you looked on ${shortDate(k.date)} — counted from tomorrow at the earliest, and moves on until they're up`; }
  return `from ${e.known ? 'when they came up (' + shortDate(e.d) + ')' : 'expected germination'} and the temperatures${l ? '; ' + l : ''}`;
}

// ---------- germination & pick-by ----------
function pickBy(p) {
  const cr = crop(p.cropId);
  if (!p.harvestDate || !cr.win) return null;
  const w = harvestWindow(p);
  return { date: w.keep, mature: w.mature, late: cr.late, cont: !!cr.cont };
}
export function syncCareTasks(p) {
  syncGermTask(p);
  const pb = pickBy(p);
  upsertAuto(p, 'pickby', !!pb && !pb.cont && !p.no_pickby, pb && pb.date, pb ? `Pick by now – after this ${pb.late}` : '');
}
// ---------- true-leaf counts ----------
// data version 7: thinning advice saved on plantings from when it was in Japanese, in English
const THIN_EN = {"芽かき – leave 2–3 stems at 10–15 cm tall": "Remove extra shoots: keep 2–3 stems when they're 10–15 cm tall", "本葉2–3枚 then 5–6枚": "At 2–3 true leaves, then again at 5–6", "本葉3–4枚": "At 3–4 true leaves", "初生葉が開いたら 2本立ち": "Down to 2 plants once the first leaves open", "本葉5–6枚で1本立ち": "Down to 1 plant at 5–6 true leaves", "本葉2–3枚": "At 2–3 true leaves", "本葉2–3枚 then 5枚": "At 2–3 true leaves, then again at 5", "本葉2–3枚で2本立ち": "Down to 2 plants at 2–3 true leaves", "本葉3–4枚で1本立ち": "Down to 1 plant at 3–4 true leaves", "本葉4–5枚": "At 4–5 true leaves", "本葉2枚で1本立ち": "Down to 1 plant at 2 true leaves"};
export function migrateThinningText() { for (const p of S.plantings || []) if (THIN_EN[p.thinStage]) p.thinStage = THIN_EN[p.thinStage]; }
// "at 2–3 true leaves" (or 本葉2–3枚, as older plantings say) → 2.5
function leafTarget(text) {
  const m = String(text || '').match(/(\d+)(?:\s*[–\-~〜]\s*(\d+))?\s*true leaves/i) || String(text || '').match(/本葉\s*(\d+)(?:\s*[–\-~〜]\s*(\d+))?\s*枚/);
  return m ? (m[2] ? (+m[1] + +m[2]) / 2 : +m[1]) : null;
}
export const lastLeaves = o => (o.leaves || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1)).pop() || null;
// milestone date from a leaf count: same pace as the plant has shown so far
function leafAnchored(o, id, emerge, target, tempFn) {
  const L = lastLeaves(o); if (!L || target == null) return null;
  if (L.n >= target) return L.date;
  if (emerge > addDays(L.date, -3)) emerge = addDays(L.date, -Math.max(3, Math.round(L.n * 4)));   // they were up well before leaves appeared
  const done = ddBetween(emerge, L.date, id, tempFn);
  if (L.n < 0.5 || done <= 0) return null;
  return ddUntil(L.date, (target - L.n) * done / L.n, id, tempFn);
}
export function leafDialog(o, label, after) {
  const td = todayStr(), list = (o.leaves || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  modal(`<h3>🌿 True leaves — ${esc(label)}</h3><p class="hint">Count the true leaves (本葉) on a typical plant — not the first seed leaves (子葉). The thinning / plant-out date then follows how fast they’re actually growing.</p>
    <form id="lvf" class="form"><div class="two"><label>True leaves<input name="n" type="number" inputmode="decimal" step="0.5" min="0" required></label><label>Date<input name="date" type="date" value="${td}" max="${td}"></label></div>
      <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary">Save</button></div></form>
    ${list.length ? `<ul class="plist">${list.map((l, i) => `<li><span class="grow">${shortDate(l.date)} · <b>${l.n}</b> true leaves</span><button class="link danger" data-del="${i}">remove</button></li>`).join('')}</ul>` : ''}`, (m, close) => {
    const f = m.querySelector('#lvf'); m.querySelector('[data-x=no]').onclick = close;
    m.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { const x = list[+b.dataset.del]; o.leaves = o.leaves.filter(l => l !== x); after && after(); await save(); close(); render(); });
    f.onsubmit = async e => { e.preventDefault(); (o.leaves = o.leaves || []).push({ date: f.date.value || td, n: +f.n.value }); after && after(); await save(); close(); render(); };
  });
}

function packetDays(p) {
  const cr = crop(p.cropId), a = +p.daysFrom || cr.daysHarvest || 0;
  const b = +p.daysTo || Math.round(a * 1.3);
  return [a, Math.max(a, b)];
}
// days the crop stays good once mature: catalogue days in mild weather; cold slows ageing (roots and brassicas hold for weeks), but ends tender crops
function keepsUntil(p, mature) {
  const cr = crop(p.cropId), tf = tempFor(p.containerId, p), daily = S.weather && S.weather.daily, T = tf || (x => dayTemp(x, daily));
  let units = cr.win || 14, d = mature;
  for (let i = 0; i < 240 && units > 0; i++) {
    d = addDays(d, 1); const t = T(d);
    units -= cr.tender ? (t >= 15 ? 1 : t >= 10 ? 1.5 : 4) : (t >= 15 ? 1 : t >= 10 ? 0.6 : t >= 5 ? 0.4 : 0.3);
  }
  return d;
}
export function harvestWindow(p) {
  if (!p.harvestDate) return null;
  const cr = crop(p.cropId), [a, b] = packetDays(p), m = harvestModel(p), g = growParams(p.cropId);
  const rate = m && m.days ? m.need / m.days : g.tref - g.tb;
  let mature = b > a ? ddUntil(p.harvestDate, (b - a) * rate, p.cropId, tempFor(p.containerId, p)) : p.harvestDate;
  const cap = addDays(p.harvestDate, Math.round((b - a) * 1.5));   // ready heads don't wait for spring: cap the spread in calendar days
  if (mature > cap) mature = cap;
  const fe = frostEnd(p);
  if (fe) {   // tops killed by frost: ready then, and dig within a few weeks before the ground freezes
    const m2 = mature > fe ? (p.harvestDate > fe ? p.harvestDate : fe) : mature, k2 = addDays(m2, 21);
    return { earliest: p.harvestDate, mature: m2, keep: p.keepUntil || k2, keepSet: !!p.keepUntil, a, b, late: 'frost gets into the tubers — dig before the ground freezes', cont: false, frost: fe };
  }
  return { earliest: p.harvestDate, mature, keep: p.keepUntil || keepsUntil(p, mature), keepSet: !!p.keepUntil, a, b, late: cr.late, cont: !!cr.cont };
}
export function harvestWindowText(p) {
  const w = harvestWindow(p); if (!w) return '';
  const td = todayStr();
  return `<p class="pickby${w.keep < td ? ' late' : ''}">${w.cont ? `Picking from <b>${shortDate(w.earliest)}</b>, in full swing by ~${shortDate(w.mature)}, season runs to about <b>${shortDate(w.keep)}</b>`
    : `Harvest window: from <b>${shortDate(w.earliest)}</b> · most ready by ~<b>${shortDate(w.mature)}</b> · keeps until about <b>${shortDate(w.keep)}</b>${w.keepSet ? ' (your date)' : ''}`}${w.late ? ` — after that ${esc(w.late)}` : ''}. <small class="muted">Packet: ${w.a}${w.b > w.a ? '–' + w.b : ''} days${w.b > w.a ? '' : ' (add the range in Edit)'}.</small></p>`;
}

// ---------- sprouting time from the soil temperature ----------
// days to come up: catalogue days, stretched by how cold the soil is — from the meter / forecast for sowings around now,
// otherwise by the time of year
export function germWindow(p) {
  const cr = crop(p.cropId);
  if (p.method !== 'seed' || !cr.germ || !p.sowDate) return null;
  const r = SOIL_T[kin(p.cropId)] || [5, 15], c = p.containerId && container(p.containerId);
  const slow = t => t >= r[1] ? 1 : t >= r[0] ? 1 + (r[1] - t) / Math.max(1, r[1] - r[0]) * 0.9 : 2.2;
  // the soil over the days they take to come up, not just the day they're sown: soil warming through spring brings
  // them up sooner (taro planted in mid-April sprouts in late May), cooling through autumn later
  const cov = coverWarmth(p);   // (a cover warms the soil too)
  const avgT = n => { let s = 0, k = 0; for (let i = 0; i <= n; i += 2) { const d = addDays(p.sowDate, i), T = normalT(d); s += T + (cov ? cov(d, T) : 0); k++; } return s / k; };
  let f = 1;
  if (!(c && c.indoor)) for (let i = 0; i < 3; i++) f = slow(avgT(Math.round(cr.germ[1] * f)) + 1);   // soil runs a little warmer than the air mean
  if (Math.abs(daysBetween(p.sowDate, todayStr())) <= 7 && !(c && c.indoor)) {
    const st = c ? soilTempFor(c, p.from, p.to) : soilTemps(), t = st && (st.week ?? st.now);
    // (a meter reading taken under the cover already has its warmth; the forecast doesn't)
    if (t != null) f = slow(t + (cov && st.src !== 'meter' ? cov(p.sowDate, t) : 0));
  }
  return [addDays(p.sowDate, Math.round(cr.germ[0] * f)), addDays(p.sowDate, Math.round(cr.germ[1] * f))];
}
export { GROW, HEADING };   // (from the crop records)
