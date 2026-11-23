// The feeding card: one ledger per crop — starting soil, what the previous crop left, base fertiliser, and every feeding
// since. Every feeding is stored once in the log (kind 'fert').

import { potVolume } from '../climate/climate.js';
import { A } from '../core/router.js';
import { S } from '../core/state.js';
import { addDays, daysBetween, esc, shortDate, todayStr } from '../core/util.js';
import { container, isLive, planting } from '../garden/garden.js';
import { lastCropIn } from '../garden/rotation.js';
import { feedOf, soilReadingAdvice } from '../garden/soil.js';
import { crop, kin } from '../plants/crops.js';
import { productByName } from '../products/library.js';
import { mixFert, mixRow, mixSort, mixState } from './mix.js';
import { amtFor, feedArea, feedGrams, gN, K_NEED, N_NEED, NAME_N, P_NEED, usable3 } from './nutrients.js';
import { feedPlanner } from './planner.js';
import { feedDialog, feedEnd, schedPlanned } from './plans.js';
import { coverBar, fateLine, feedSim, simVerdict } from './sim.js';
import { actsOn, feedSeason, inLean, leanWhy } from './stages.js';

export function feedLedger(p) {
  const c = container(p.containerId); if (!c || !p.sowDate) return null;
  const td = todayStr(), bag = c.type !== 'bed', A2 = feedArea(c, p), bedA = feedArea(c), lines = [];
  const need = N_NEED[kin(p.cropId)] ? N_NEED[kin(p.cropId)] * A2 : null, needP = P_NEED[kin(p.cropId)] ? P_NEED[kin(p.cropId)] * A2 : null, needK = K_NEED[kin(p.cropId)] ? K_NEED[kin(p.cropId)] * A2 : null;
  const L3 = (o, u) => Object.assign(o, u ? { n: u.n, p: u.p, k: u.k } : { n: null, p: null, k: null });
  // 1. starting soil
  if (bag) {
    const ms = mixState(c, p.sowDate), v = potVolume(c) || 40;
    // the fertiliser in fresh mix releases from the fill date for its own period; this crop gets the part that overlaps its season
    // fertiliser built into the last FRESH fill keeps releasing for its period — sieving out roots and re-using the mix doesn't remove it
    const fresh = (c.mixLog || []).filter(e => e.fresh && e.date <= p.sowDate).sort(mixSort).pop();
    const mf = fresh ? mixFert(fresh.kind) : null, fmix = fresh ? mixRow(fresh.kind) : null;
    const reworked = ms && !ms.fresh && fresh && ms.date > fresh.date;
    let mixed = false;
    if (mf) {
      const endD = feedEnd(p), a = p.sowDate > fresh.date ? p.sowDate : fresh.date, rEnd = addDays(fresh.date, mf.days), z = rEnd < endD ? rEnd : endD;
      const share = Math.max(0, daysBetween(a, z)) / mf.days * (reworked ? 0.85 : 1), g = mf.gPerL * v;
      if (share > 0.02) { mixed = true; lines.push({ g: 'soil', name: 'mix:slow', from: a, to: z, label: `Fertiliser in the potting mix (${fmix[1]}, filled fresh ${shortDate(fresh.date)}${reworked ? `, re-used ${shortDate(ms.date)}` : ''})`,
        n: g * mf.npk[0] / 100 * share, p: g * mf.npk[1] / 100 * share, k: g * mf.npk[2] / 100 * share, note: `${mf.what} — ${Math.round(share * 100)}% of it falls in this crop’s time${reworked ? ' (a little lost when the mix was reworked)' : ''} (amount estimated)` }); }
    }
    if (!mixed) lines.push({ g: 'soil', name: 'mix:reused', label: ms ? (ms.fresh ? `Potting mix (${ms.mix[1]}) — its built-in fertiliser is used up` : `Re-used potting mix (${ms.mix[1]})`) : 'Potting mix (no fill date recorded)', n: 0.3, p: 0.3, k: 0.3, note: ms ? 'little left' : 'tap “Set potting mix” on the Feeding card' });
  } else lines.push({ g: 'soil', name: 'soil', label: 'The bed’s own soil', n: 6 * A2, p: 4 * A2, k: 8 * A2, note: 'slow release from the soil’s reserves over a season (rough)' });
  // 2. what the previous crop left
  const prev = lastCropIn(c, p.from, p.to, p.sowDate, p.id);
  if (prev) {
    const pf = feedOf(prev.cropId, prev), pp = prev.plantingId && planting(String(prev.plantingId).split(':')[0]);
    const o = { g: 'prev', name: 'prev', label: `Previous crop: ${crop(prev.cropId).en}`, n: 0, p: 0, k: 0, note: '' };
    if (pf === 'legume') { o.n = 2 * A2; o.note = 'legumes leave nitrogen in their roots'; }
    else if (pp && pp.id !== p.id) {
      const L = feedLedger(Object.assign({}, pp, { status: 'active' })), sh = A2 / feedArea(c, pp);
      if (L) { o.n = L.need && L.applied > L.need ? (L.applied - L.need) * 0.3 * sh : 0; o.p = L.needP && L.appliedP > L.needP ? (L.appliedP - L.needP) * 0.5 * sh : 0; o.k = L.needK && L.appliedK > L.needK ? (L.appliedK - L.needK) * 0.3 * sh : 0; }
      o.note = o.n + o.p + o.k > 0.05 ? 'some of what it was fed but didn’t use' : pf === 'heavy' ? 'a heavy feeder — little left' : 'used what it was given';
    } else o.note = pf === 'heavy' ? 'a heavy feeder — little left' : pf === 'light' ? 'a light feeder' : 'no feeding records for it';
    lines.push(o);
  }
  // compost from earlier crops in the same space (keeps releasing for a couple of years)
  const oc = { n: 0, p: 0, k: 0 };
  for (const q of S.plantings) if (q.id !== p.id && q.containerId === c.id && q.sowDate && q.sowDate < p.sowDate && q.sowDate >= addDays(p.sowDate, -730) && q.from < p.to - 0.5 && q.to > p.from + 0.5)
    for (const f of q.fert || []) { const pr = productByName(f.product); if (pr && pr.kind === 'compost') { const u = usable3(feedGrams(f.amount, f.unit, f.product), f.product, 1); if (u) { const sh = A2 / feedArea(c, q); oc.n += u.n * sh; oc.p += u.p * sh; oc.k += u.k * sh; } } }
  if (oc.n + oc.p + oc.k > 0.05) lines.push(Object.assign({ g: 'prev', name: 'compost-old', label: 'Compost dug in for earlier crops', note: 'still releasing slowly' }, oc));
  // 3. base fertiliser at planting
  for (const f of p.fert || []) {
    if (!f.product) continue; const pr = productByName(f.product), u = usable3(feedGrams(f.amount, f.unit, f.product, c), f.product);
    lines.push(L3({ g: 'base', name: f.product, label: `${f.product} ${amtFor(f.product, f.amount, f.unit)}`, date: p.sowDate, note: !u ? 'unknown analysis — not counted' : pr && pr.kind === 'compost' ? 'compost: only ~10% of its nitrogen this season' : '' }, u));
  }
  // 4. every feeding since (log), shared feedings split by area
  const from = addDays(p.sowDate, -21), end = p.status === 'harvested' ? (p.harvestedOn || td) : td;
  for (const e of S.log || []) {
    if (!['fert', 'soil'].includes(e.kind) || !e.product || e.date < from || e.date > end) continue;
    const pids = e.pids || [], cids = e.cids || [], n = pids.length + cids.length || 1, g = feedGrams(e.amount, e.unit, e.product, c) / (e.per === 'total' ? n : 1);
    let share = 0;
    if (pids.includes(p.id)) share = 1; else if (cids.includes(c.id)) share = A2 / bedA; else if (!pids.length && !cids.length) share = A2 / bedA;
    if (!share) continue;
    const u = usable3(g * share, e.product);
    lines.push(L3({ g: 'fed', name: e.product, label: `${e.product} ${amtFor(e.product, e.amount, e.unit)}${share < 0.999 ? ` (whole ${bag ? 'pot' : 'bed'} — ${Math.round(share * 100)}% here)` : ''}`, date: e.date, logId: e.id, note: u ? '' : 'unknown analysis — not counted' }, u));
  }
  // older records: ticked fertiliser jobs that weren't logged separately
  for (const s of p.series || []) {
    if (!s.product || s.amount == null) continue;
    for (const t of S.tasks) if (t.seriesId === s.id && t.done && t.doneOn && !t.logId) lines.push(L3({ g: 'fed', name: s.product, label: `${s.product} ${amtFor(s.product, s.amount, s.unit)}`, date: t.doneOn }, usable3(feedGrams(s.amount, s.unit, s.product, c), s.product)));
  }
  const sum = (gs, k) => lines.filter(l => gs.includes(l.g)).reduce((a, l) => a + (l[k] || 0), 0), ALL = ['soil', 'prev', 'base', 'fed'];
  // planned feedings still to come
  const planned = S.tasks.filter(t => t.plantingId === p.id && !t.done && (t.product || (t.seriesId && ((p.series || []).find(s => s.id === t.seriesId) || {}).product))).map(t => {
    const s = (p.series || []).find(x => x.id === t.seriesId) || t, u = usable3(feedGrams(s.amount, s.unit, s.product, c), s.product) || { n: 0, p: 0, k: 0 };
    return { t, n: u.n, p: u.p, k: u.k, name: s.product, text: `${s.product} ${amtFor(s.product, s.amount, s.unit)}` };
  });
  planned.push(...schedPlanned(p));
  return { c, bag, area: A2, need, needP, needK, lines, planned,
    applied: sum(['base', 'fed'], 'n'), appliedP: sum(['base', 'fed'], 'p'), appliedK: sum(['base', 'fed'], 'k'),
    total: sum(ALL, 'n'), totalP: sum(ALL, 'p'), totalK: sum(ALL, 'k'),
    plannedN: planned.reduce((a, x) => a + x.n, 0), plannedP: planned.reduce((a, x) => a + x.p, 0), plannedK: planned.reduce((a, x) => a + x.k, 0) };
}
function pkNote(L, p) {
  const late = p.harvestDate && p.sowDate && todayStr() > addDays(p.sowDate, Math.round(daysBetween(p.sowDate, p.harvestDate) * 0.75));
  const bits = [], chk = (have, plan, need, nm, why) => { if (!need) return; const r = (have + plan) / need; if (r < 0.6 && !late) bits.push(`Low on ${nm} — ${why}.`); else if (r > 2.5) bits.push(`Plenty of ${nm}.`); };
  chk(L.totalP, L.plannedP, L.needP, 'phosphate (P)', 'a fertiliser like bokashi, chicken manure or 8-8-8 adds some');
  chk(L.totalK, L.plannedK, L.needK, 'potash (K)', 'wood ash, chicken manure or 8-8-8 add some');
  return bits.join(' ');
}
function feedVerdict(L, p) {
  if (!L.need) return '';
  const sr = soilReadingAdvice(L.c, p.from, p.to, p.cropId);
  if (sr && sr.feed < 1) return 'Your meter shows <b>salt DANGER</b> — hold off feeding and water through well.';
  const r = L.total / L.need, rp = (L.total + L.plannedN) / L.need;
  if (r > 1.6) return 'That’s <b>plenty</b> — skip further feeding (too much gives soft, pest-prone growth).';
  if (r >= 0.9) return 'About right for the whole season.';
  if (rp >= 0.9) return 'Short for now, but your planned side-dressings should cover it.';
  const late = p.harvestDate && p.sowDate && todayStr() > addDays(p.sowDate, Math.round(daysBetween(p.sowDate, p.harvestDate) * 0.75));
  if (late) return `On the light side (about ${gN(L.need - L.total - L.plannedN)} short), but it’s late in the season — extra feeding now won’t change much. Worth feeding the next crop here a bit more.`;
  return `<b>Short</b> by about ${gN(L.need - L.total - L.plannedN)} ${NAME_N} over the season — plan a side-dressing.`;
}
function feedBar(L, k = 'n') {
  const need = { n: L.need, p: L.needP, k: L.needK }[k], have = { n: L.total, p: L.totalP, k: L.totalK }[k], plan = { n: L.plannedN, p: L.plannedP, k: L.plannedK }[k];
  if (!need) return '';
  const pc = x => Math.min(100, x / need * 100);
  return `<div class="fbar"><i class="have${k === 'n' ? '' : ' ' + k}" style="width:${pc(have)}%"></i><i class="plan" style="left:${pc(have)}%;width:${Math.max(0, pc(have + plan) - pc(have))}%"></i></div>`;
}
function npkBars(L) {
  const row = (k, l, have, need, plan) => need ? `<div class="npkrow"><span class="nl">${l}</span>${feedBar(L, k)}<span class="nv">${gN(have)}${plan ? `+${gN(plan)}` : ''} / ${gN(need)}</span></div>` : '';
  return `<div class="npk">${row('n', 'N', L.total, L.need, L.plannedN)}${row('p', 'P', L.totalP, L.needP, L.plannedP)}${row('k', 'K', L.totalK, L.needK, L.plannedK)}</div>`;
}
export function feedingSection(p) {
  const L = feedLedger(p); if (!L) return '';
  A.feedNow = () => feedDialog({ pids: [p.id] });
  A.editFeed = el => feedDialog((S.log || []).find(e => e.id === el.dataset.id));
  A.addSideDress = () => feedPlanner(p);
  const grp = { soil: 'Starting soil', prev: 'Left from before', base: 'At planting', fed: 'Fed since' };
  const cell = v => `<td>${v == null ? '—' : v < 0.05 ? '·' : gN(v)}</td>`;
  const rows = `<tr class="hd"><th></th><th>N</th><th>P</th><th>K</th></tr>` + Object.keys(grp).map(k => { const ls = L.lines.filter(l => l.g === k); return ls.length ? `<tr class="fg"><th colspan="4">${grp[k]}</th></tr>${ls.map(l => `<tr${l.logId ? ` data-act="editFeed" data-id="${l.logId}"` : ''}><td>${l.date ? `<small>${shortDate(l.date)}</small> ` : ''}${esc(l.label)}${l.note ? `<small>${esc(l.note)}</small>` : ''}</td>${cell(l.n)}${cell(l.p)}${cell(l.k)}</tr>`).join('')}` : ''; }).join('');
  const nextUp = L.planned.slice().sort((a, b) => (a.t.due < b.t.due ? -1 : 1))[0];
  const scheds = (p.feedPlan || []).filter(s => !s.stopped && !s.done).map(s => `🔁 Every ${s.every} days: ${esc(s.product)} ${amtFor(s.product, s.amount, s.unit)}${s.paused ? ` — <b>paused</b>: ${s.paused === 'salt' ? 'meter shows salt DANGER' : 'enough nitrogen for the season'}` : ''}`).join('<br>');
  const sim = feedSim(p, L);
  const salt = L.c && soilReadingAdvice(L.c, p.from, p.to, p.cropId);
  return `<section class="feeding"><h3>Feeding</h3>
    ${salt && salt.feed < 1 ? `<div class="banner warn">🧪 Your meter read salt <b>DANGER</b> on ${shortDate(salt.r.date)} — too much fertiliser in the soil. Hold off feeding (repeating feeds are paused) and water through well; take another reading in a week or so.</div>` : ''}
    ${sim ? `${coverBar(sim)}<p class="small">${simVerdict(sim, L, p)}</p>` : `<p class="small">${feedVerdict(L, p)}</p>`}
    ${(() => { const se = feedSeason(p), bad = se && se.bolt ? L.planned.filter(x => !x.t.schedId && inLean(se, actsOn(x.name, x.t.due))) : []; return bad.length ? `<div class="banner warn">📅 ${bad.map(x => `${esc(x.text)} (${shortDate(x.t.due)})`).join(', ')} ${bad.length > 1 ? 'are' : 'is'} planned in the lean stretch before winter — ${esc(leanWhy(p, se))}. Better to skip ${bad.length > 1 ? 'them' : 'it'} (tap the job → Delete) and feed around ${shortDate(se.we)}; open 📅 Feeding plan to re-plan.</div>` : ''; })()}
    ${nextUp || scheds ? `<p class="small">${nextUp ? `Next: <b>${esc(nextUp.text)}</b> ${shortDate(nextUp.t.due)}.` : ''}${scheds ? `<br>${scheds}` : ''}</p>` : ''}
    ${L.bag && !mixState(L.c) ? `<div class="banner warn">🪴 This pot’s potting mix isn’t recorded, so the fertiliser in the mix isn’t counted. <a class="btn small" href="#/plant/${p.id}/edit">Set it in Edit planting</a></div>` : ''}
    <div class="btnrow"><button class="btn small primary" data-act="feedNow">🌿 Record feeding</button>${isLive(p) ? '<button class="btn small" data-act="addSideDress">📅 Feeding plan…</button>' : ''}</div>
    <details class="fold inner"><summary>What’s been counted</summary>
      ${L.need ? `<p class="small">${esc(crop(p.cropId).en)} needs about <b>${gN(L.need)}</b> of ${NAME_N} over the season ${L.bag ? 'in this pot' : `in this ${L.area.toFixed(1)} m² section`}. Counted: <b>${gN(L.total)}</b>${L.plannedN ? ` + ${gN(L.plannedN)} planned` : ''}.</p>` : ''}
      ${sim && L.need ? `<p class="small">${fateLine(sim, L, p)}</p>` : ''}
      ${npkBars(L)}${pkNote(L, p) ? `<p class="small">${pkNote(L, p)}</p>` : ''}
      <table class="ledger">${rows}</table>
      <p class="hint"><b>N</b> nitrogen — leaves and growth, the one that most often runs short. <b>P</b> phosphate — roots, flowering and fruit set. <b>K</b> potash — fruit, roots and toughness. Grams plants can use, worked out from each product’s N-P-K analysis (as on Japanese labels: N, P₂O₅, K₂O). “Fed until” follows when each feed releases, what the crop takes as it grows, and what washes out with watering and rain. All rough — trust how the plants look.</p></details></section>`;
}
