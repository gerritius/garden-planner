/* Day-by-day food model: each feed releases over its own time, the crop takes up what it needs as it grows
   (little in midwinter), and pots lose what isn't taken up as water drains through. Gives "fed until about …",
   flags too much in the soil at once, and drives the feeding plan's suggestions. */
'use strict';

// [days before it starts releasing, days it releases over]
function relOf(name) {
  if (name === 'mix:starter') return [0, 30];
  if (name === 'mix:reused' || name === 'prev') return [0, 60];
  if (isLiquid(name)) return [0, 7];
  const pr = productByName(name || '');
  if (pr) {
    if (pr.id === 'kasei888') return [0, 30];
    if (pr.id === 'bokashi' || pr.id === 'toshoAburakasu') return [3, 40];
    if (pr.id === 'chickenManure') return [7, 55];
    if (pr.id === 'aburakasu' || pr.id === 'neem') return [14, 70];
    if (pr.kind === 'compost') return [0, 180];
  }
  const npk = npkOf(name); return npk && npk[3] >= 1 ? [0, 30] : [7, 55];
}
// unused nitrogen washes out with water passing through: pots with each watering (and rain if outdoors), beds mostly with rain
const RAIN_MONTH = [52, 56, 117, 125, 138, 168, 154, 168, 210, 198, 93, 51];   // normal mm per month, western Tokyo (approx.)
const normalRain = d => { const x = pd(d); return RAIN_MONTH[x.getMonth()] / new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); };
const LEACH_PER_WATERING = 0.06;
function leachFn(L) {
  const c = L.c, td = todayStr(), rain = rainByDay(), indoor = !!c.indoor;
  if (!L.bag) return d => Math.min(0.2, 0.002 + (d < td ? (S.rainHist && S.rainHist[d] != null ? S.rainHist[d] : normalRain(d)) : (rain[d] != null ? rain[d] : normalRain(d))) * 0.0015);
  const fullMM = potWater([c]).fullMM;
  const done = new Set(S.tasks.filter(t => t.kind === 'water' && t.done && t.doneOn).map(t => t.doneOn).concat(S.water && S.water.lastDone ? [S.water.lastDone] : []));
  const since = [...done].sort()[0] || td;   // before the oldest watering on record, assume the usual interval
  const pace = waterPace(done, td);   // if you water more often than the default (e.g. every 3 days through winter), assume you keep doing so
  return d => {
    const mm = indoor ? 0 : d < td ? (S.rainHist && S.rainHist[d] != null ? S.rainHist[d] : normalRain(d)) : (rain[d] != null ? rain[d] : normalRain(d));
    const fromRain = mm / fullMM;
    const watered = d >= since && d < td ? (done.has(d) ? 1 : 0) : Math.max(0, 1 / (pace ? Math.min(pace, waterInterval(pd(d))) : waterInterval(pd(d))) - fromRain);   // rain stands in for some watering
    return Math.min(0.25, 0.002 + LEACH_PER_WATERING * (watered + fromRain));
  };
}
// your own watering habit over the last 4 weeks (days between waterings), if you've been ticking it off
function waterPace(done, td) {
  const from = addDays(td, -28), n = [...done].filter(d => d >= from && d < td).length;
  return n >= 3 ? 28 / n : null;
}
const maxPoolOf = L => L.need ? L.need * (L.bag ? 0.4 : 0.35) : Infinity;   // more than this sitting in the soil at once = overfeeding

function feedSim(p, L, extra = [], skip) {
  if (!L || !L.need) return null;
  const td = todayStr(), start = p.sowDate, end = feedEnd(p);
  const inputs = [];
  const add = (from, len, n, src) => { if (n > 0) inputs.push({ from, to: addDays(from, Math.max(1, len) - 1), rate: n / Math.max(1, len), src }); };
  for (const l of L.lines) {
    if (!(l.n > 0)) continue;
    if (l.name === 'soil' || l.name === 'compost-old') add(start, daysBetween(start, end) + 1, l.n, l);
    else if (l.name === 'mix:slow') add(l.from, daysBetween(l.from, l.to) + 1, l.n, l);
    else { const r = relOf(l.name); add(addDays(l.date || start, r[0]), r[1], l.n, l); }
  }
  for (const x of L.planned) { if (!(x.n > 0) || (skip && skip(x))) continue; const r = relOf(x.name); add(addDays(x.t.due, r[0]), r[1], x.n, x); }
  for (const x of extra) { const r = relOf(x.name); add(addDays(x.date, r[0]), r[1], x.n, x); }
  // demand follows growth: more in warm weather, almost none in midwinter
  const tf = tempFor(p.containerId), daily = S.weather && S.weather.daily, T = tf || (d => dayTemp(d, daily));
  const days = []; for (let d = start; d <= end; d = addDays(d, 1)) days.push([d, Math.max(0.05, growUnits(p.cropId, T(d)))]);
  const W = days.reduce((a, x) => a + x[1], 0) || 1, wOf = {}; days.forEach(([d, w]) => { wOf[d] = w / W * L.need; });
  const stop = lastFeedDate(p), shortTo = stop ? addDays(stop, 45) : end, lean = feedSeason(p);   // garlic / onion: after the last feed the bulbs finish on what's in the soil
  const first = inputs.reduce((a, x) => (x.from < a ? x.from : a), start), leachOn = leachFn(L), avgDem = L.need / Math.max(1, days.length);
  let pool = 0, taken = 0, unmetAll = 0, unmetFuture = 0, shortFrom = null, peak = 0, peakDate = null, lost = 0;
  const poolAt = {};
  for (let d = first; d <= end; d = addDays(d, 1)) {
    for (const x of inputs) if (d >= x.from && d <= x.to) pool += x.rate;
    if (pool > peak) { peak = pool; peakDate = d; }
    poolAt[d] = pool;
    const dem = wOf[d] || 0, take = Math.min(pool, dem);
    pool -= take; taken += take; unmetAll += dem - take;
    if (d >= td) { unmetFuture += dem - take; if (!shortFrom && d <= shortTo && !(lean && lean.bolt && d >= lean.leanFrom && d < addDays(lean.we, 14)) && dem > avgDem * 0.3 && take < dem * 0.6) shortFrom = d; }   // a shortfall only matters while it's growing
    const l = pool * leachOn(d); pool -= l; lost += l;
  }
  return { start, end, stop, lean, shortFrom, unmetFuture, unmetAll, taken, peak, peakDate, lost, poolAt, maxPool: maxPoolOf(L), left: pool };
}
// pool on a day (before that day's own releases are fully used) — for "is there room for another dose?"
const poolOn = (sim, d) => sim && sim.poolAt[d] != null ? sim.poolAt[d] : 0;

// timeline bar for the Feeding card: fed (green) vs running short (red), with today
function coverBar(sim) {
  if (!sim) return '';
  const span = Math.max(1, daysBetween(sim.start, sim.end)), pc = d => Math.max(0, Math.min(100, daysBetween(sim.start, d) / span * 100)), td = todayStr();
  const sf = sim.shortFrom ? pc(sim.shortFrom) : 100;
  return `<div class="cover"><div class="cbar2"><i class="ok" style="width:${sf}%"></i>${sim.shortFrom ? `<i class="short" style="left:${sf}%;width:${100 - sf}%"></i>` : ''}<b class="now" style="left:${pc(td)}%"></b></div>
    <div class="cdates"><span>${shortDate(sim.start)}</span><span>${shortDate(sim.end)}</span></div></div>`;
}
function simVerdict(sim, L, p) {
  if (!sim) return '';
  const td = todayStr(), bits = [];
  if (sim.peakDate && sim.peak > sim.maxPool * 1.3 && sim.peakDate >= addDays(td, -30) && sim.peakDate <= addDays(td, 30))
    bits.push(`A lot of nitrogen is in the soil at once around ${shortDate(sim.peakDate)} (~${gN(sim.peak)}) — water through well and watch for scorched leaf edges; ${L.bag ? 'in a pot much of it will drain away over the next few weeks.' : 'skip feeding until it’s used up.'}`);
  const se = sim.lean;
  if (se && se.bolt && td >= addDays(se.leanFrom, -7) && td < se.we)
    bits.push(`<b>Keep it lean until about ${shortDate(se.we)}</b> — ${esc(leanWhy(p, se))}. Only feed now if leaves turn pale yellow, and then lightly. The main feed is around ${shortDate(se.we)}.`);
  if (bits.length && se && se.bolt && td < se.we && sim.shortFrom && Math.abs(daysBetween(sim.shortFrom, se.we)) <= 21) return bits.join(' ');   // the lean note already says when to feed
  if (!sim.shortFrom) bits.push(sim.stop ? `<b>Fed for the season</b> — the last feed (止め肥) is around ${shortDate(sim.stop)}; after that the bulbs finish on what’s in the soil.` : `<b>Fed through to ${shortDate(sim.end)}</b> with what’s in and planned.`);
  else {
    const slow = normalT(sim.shortFrom) < restartTemp(p.cropId), back = slow ? nextGrowing(p.cropId, sim.shortFrom) : null;
    const when = sim.shortFrom <= addDays(td, 5) ? '<b>Running short now</b>' : `<b>Fed until about ${shortDate(sim.shortFrom)}</b>`;
    bits.push(slow ? `${when} — but it’s the slow winter stretch: it only needs a little until growth picks up around ${shortDate(back)}. A light feed ${sim.shortFrom <= addDays(td, 5) ? 'now' : 'around ' + shortDate(sim.shortFrom)}, or a proper one around ${shortDate(back)}.` : `${when} — plan a feed ${sim.shortFrom <= addDays(td, 5) ? 'soon' : 'before then'}.`);
  }
  return bits.join(' ');
}
// where the counted nitrogen goes over the season: into the crop, out with drainage, or still there at the end
function fateLine(sim, L, p) {
  const nm = esc(crop(p.cropId).en.toLowerCase()), got = Math.min(L.need, sim.taken);
  return `Where it goes: the ${nm} should take up about <b>${gN(got)}</b> of its ${gN(L.need)}; about <b>${gN(sim.lost)}</b> washes out with ${L.bag ? 'watering and rain' : 'rain'}${sim.left > 0.3 ? `, and ~${gN(sim.left)} is still in the soil at the end` : ''}. ${sim.taken < L.need * 0.9 ? 'So even with more counted than it needs, it runs short once the early feed has been used or washed out.' : ''}`;
}
// crops with a last feed (止め肥): feeding later gives split bulbs and poor keeping
function lastFeedDate(p) {
  const s = (SIDE_STAGES[p.cropId] || []).find(x => x.last); if (!s) return null;
  const se = feedSeason(p); if (!se || !s.w) return null;   // no winter → no fixed last feed; the harvest date limits it as usual
  return addDays(stageAnchor(se, s.w), s.off || 0);
}
