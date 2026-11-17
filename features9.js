/* Re-use: pick seedlings you've already started when adding/planning a crop, and re-use packet photos across plantings. */
'use strict';

// ---------- photos can be shared between plantings: only delete when nothing uses it ----------
function photoUsed(id) {
  return S.plantings.some(p => Object.values(p.photos || {}).includes(id) || (p.diary || []).some(d => d.photo === id));
}
async function dropPhoto(id) {
  if (!id || photoUsed(id)) return;
  await DB.delPhoto(id); delete photoURLs[id];
}

// ---------- packet photos already taken ----------
function packets(excludeKey) {
  const seen = new Map();
  for (const p of S.plantings) {
    const ph = p.photos || {}; if (!ph.front && !ph.back) continue;
    const key = (ph.front || '') + '|' + (ph.back || ''); if (key === excludeKey) continue;
    const e = seen.get(key) || { key, front: ph.front || null, back: ph.back || null, cropId: p.cropId, variety: p.variety || '', uses: [] };
    e.uses.push(p); seen.set(key, e);
  }
  return [...seen.values()];
}
function packetPicker(d) {
  const cur = ((d.photos || {}).front || '') + '|' + ((d.photos || {}).back || '');
  const list = packets(cur).sort((a, b) => ((b.cropId === d.cropId) - (a.cropId === d.cropId)) || ((b.variety === d.variety) - (a.variety === d.variety)));
  if (!list.length) return '';
  const mine = list.filter(x => !d.cropId || x.cropId === d.cropId), rest = list.filter(x => d.cropId && x.cropId !== d.cropId);
  const chip = x => `<button type="button" class="pkt" data-act="usePacket" data-k="${esc(x.key)}"><img data-photo="${x.front || x.back}" alt=""><span>${esc(crop(x.cropId).en)}${x.variety ? `<small>${esc(x.variety)}</small>` : ''}</span></button>`;
  return `<details class="pktpick"${mine.length && !(d.photos || {}).front && !(d.photos || {}).back ? ' open' : ''}><summary>Use a packet you’ve already photographed${mine.length ? ` (${mine.length})` : ''}</summary>
    <div class="pkts">${mine.map(chip).join('')}${rest.length ? `${mine.length ? '<small class="muted pktsep">Other crops</small>' : ''}${rest.slice(0, 12).map(chip).join('')}` : ''}</div></details>`;
}
function usePacket(d, key, c) {
  const x = packets().find(e => e.key === key); if (!x) return;
  d.photos = Object.assign({}, d.photos, { front: x.front || undefined, back: x.back || undefined });
  for (const s of ['front', 'back']) { if (!d.photos[s]) delete d.photos[s]; delete d.newPhotos[s]; delete d.removePhotos[s]; }
  if (!d.cropId) { applyCrop(d, crop(x.cropId), c); }
  if (!d.variety && x.cropId === d.cropId) d.variety = x.variety;
}

// ---------- seedlings already started ----------
const freeStarts = exceptPid => startsGrowing().filter(s => { const pp = s.planId && planting(s.planId); return !pp || !isPlanned(pp) || pp.id === exceptPid; });
function startChooser(d) {
  const list = freeStarts(); if (!list.length) return '';
  const td = todayStr();
  return `<div class="usestart"><small>Use seedlings you’ve started</small><div class="sowchips">${list.map(s => { const ready = startReady(s);
    return `<button type="button" class="chip${d.useStart === s.id ? ' on' : ''}" data-act="useStart" data-id="${s.id}">${ic(s.cropId, 20)}${esc(crop(s.cropId).en)}${s.variety ? ' · ' + esc(s.variety) : ''} <small>×${startLeft(s)} · ${esc(startWhere(s))} · ${ready <= td ? 'ready' : 'ready ~' + shortDate(ready)}</small></button>`; }).join('')}</div></div>`;
}
function applyStart(d, s, c) {
  if (d.useStart === s.id) { d.useStart = null; d.startId = null; d.startN = null; return; }
  const keepSow = d.sowDate, cr = crop(s.cropId);
  if (d.cropId !== s.cropId) applyCrop(d, cr, c);
  d.sowDate = keepSow; d.variety = s.variety || d.variety; d.method = 'seedling'; d.useStart = s.id; d.raise = s.kind;
  if (cr.method === 'seed' && cr.thinSp) d.plantSp = Math.max(+cr.sowSp || 0, +cr.thinSp);
  d.seededOn = s.sowDate; d.harvestManual = false; recalc(d);
  if (!d.notes) d.notes = `Raised in ${startWhere(s).toLowerCase()}, sown ${shortDate(s.sowDate)}`;
}
// on save of a new planting that uses started seedlings
function linkStartOnSave(d, p) {
  const s = d.useStart && start(d.useStart); if (!s) return;
  if (p.status === 'planned') { s.planId = p.id; p.raise = s.kind; syncStartTasks(s); }
  else { d.startId = s.id; d.startN = d.startN || startLeft(s); }
}
function startReadyNote(d) {
  const s = d.useStart && start(d.useStart); if (!s) return '';
  const ready = startReady(s);
  return `<p class="hint">🌱 Using ${startLeft(s)} ${esc(crop(s.cropId).en)} seedlings from ${esc(startWhere(s).toLowerCase())}, ready about ${shortDate(ready)}${d.sowDate && ready > d.sowDate ? ` — <b>after</b> this date; they may need longer` : ''}.</p>`;
}
// planned crop page: link seedlings started separately
function planStartLinks(p) {
  if (!isPlanned(p) || linkedStart(p)) return '';
  const m = freeStarts().filter(s => s.cropId === p.cropId); if (!m.length) return '';
  A.linkStart = async el => { const s = start(el.dataset.id); s.planId = p.id; p.method = 'seedling'; p.raise = s.kind; if (!p.variety) p.variety = s.variety; syncStartTasks(s); syncTasks(p); await save(); render(); };
  return `<div class="btnrow">${m.map(s => `<button class="btn small" data-act="linkStart" data-id="${s.id}">🌱 Use my ${esc(crop(s.cropId).en)} seedlings (${esc(startWhere(s))}, ×${startLeft(s)})</button>`).join('')}</div>`;
}
// season plan gaps: offer started seedlings first
function gapStartChips(c, g) {
  const prevFam = g.prev ? crop(g.prev.cropId).family : null;
  return freeStarts().filter(s => !(prevFam && prevFam !== 'other' && crop(s.cropId).family === prevFam))
    .map(s => `<a class="chip mine" href="#/plant/new/${c.id}?plan=1&from=${g.a}&to=${g.b}&date=${g.s}&usestart=${s.id}">🌱 ${esc(crop(s.cropId).en)} <small>your seedlings ×${startLeft(s)}</small></a>`).join('');
}

// ---------- thinning: counted from when seedlings came up, at the speed the temperature allows ----------
// Catalogue "days to thin" assume good growing weather (~18 °C for cool-season crops, ~24 °C for warm-season).
// Growth is counted in degree-days above a base temperature, so cold weeks add very little.
const NORMAL_T = [5.2, 5.7, 8.7, 13.9, 18.2, 21.4, 25.0, 26.4, 22.8, 17.5, 12.1, 7.6];   // monthly mean, western Tokyo (approx.)
const WARM_LEAF = ['corn', 'edamame', 'ingen', 'kyuri', 'zucchini', 'nasu', 'piman', 'tomato', 'minitomato', 'shishito', 'chilli', 'satoimo', 'satsumaimo'];
function dayTemp(d, daily) {
  if (S.tempHist && S.tempHist[d] != null) return S.tempHist[d];
  const i = daily && daily.time ? daily.time.indexOf(d) : -1;
  if (i >= 0 && daily.temperature_2m_max[i] != null) return (daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2;
  return normalT(d);
}
function emergeDate(p) {
  if (p.germ && p.germ.date && p.germ.result !== 'none') return { d: p.germ.date, known: true };
  const gw = germWindow(Object.assign({}, p, { method: 'seed' }));
  const mid = gw ? daysBetween(p.sowDate, gw[0]) + daysBetween(gw[0], gw[1]) / 2 : 7;
  return { d: addDays(p.sowDate, Math.round(mid * (p.cropId ? learnedFactor(p.cropId, 'germ') : 1))), known: false };
}
// growth rate per day in "good-weather days": 0 below the base temperature, 1 at the reference temperature
// hardy winter crops (brassicas, spinach, peas & beans, alliums, shungiku) keep growing slowly just above freezing
const HARDY_FAM = ['brassica', 'allium', 'legume'], HARDY_IDS = ['spinach', 'shungiku', 'strawberry'];
// heading brassicas almost stop growing in midwinter (that's why autumn-planted cabbage heads in spring)
const HEADING = ['cabbage', 'hakusai', 'broccoli', 'cauliflower'];
const growParams = id => WARM_LEAF.includes(id) ? { tb: 10, tref: 24, tcap: 28 }
  : HARDY_IDS.includes(id) || HARDY_FAM.includes(crop(id).family) ? { tb: 0, tref: 16, tcap: 20 } : { tb: 3, tref: 18, tcap: 22 };
// growth units for one day at mean temperature T; heading brassicas pause in midwinter (days below ~6 °C add nothing)
function growUnits(id, T) { const { tb, tcap } = growParams(id); if (HEADING.includes(id) && T < 6) return 0; return Math.max(0, Math.min(T, tcap) - tb); }
function normalT(d) {   // smooth daily normal from monthly means
  const x = pd(d), m = x.getMonth(), f = (x.getDate() - 15) / 30, n = f >= 0 ? (m + 1) % 12 : (m + 11) % 12;
  return NORMAL_T[m] + (NORMAL_T[n] - NORMAL_T[m]) * Math.abs(f);
}
function ddUntil(from, need, id, tempFn) {
  const daily = S.weather && S.weather.daily, T = tempFn || (x => dayTemp(x, daily));
  let d = from, acc = 0;
  for (let i = 0; i < 400 && acc < need; i++) { d = addDays(d, 1); acc += growUnits(id, T(d)); }
  return d;
}
// leaf-stage milestones (thinning, ready to plant out): catalogue days are warm-weather numbers, so use a fixed reference temperature
function leafDate(id, emerge, leafDays, tempFn, factor) { const g = growParams(id); return ddUntil(emerge, Math.max(3, leafDays) * (g.tref - g.tb) * (factor || 1), id, tempFn); }
const germAvg = id => { const g = crop(id).germ || [5, 10]; return (g[0] + g[1]) / 2; };
function thinEstimate(p) {
  const cr = crop(p.cropId); if (!cr.daysThin || !p.sowDate) return p.thinDate || '';
  const tf = tempFor(p.containerId), e = emergeDate(p).d;
  return leafAnchored(p, p.cropId, e, leafTarget(p.thinStage || cr.thinStage), tf) || leafDate(p.cropId, e, Math.max(5, cr.daysThin - germAvg(p.cropId)), tf, learnedFactor(p.cropId, 'thin'));
}
// seedlings in trays/pots: ready to plant out
function startEmerge(s) { return s.upOn || emergeDate({ cropId: s.cropId, sowDate: s.sowDate, method: 'seed' }).d; }
const KEPT = [['out', 'Outside', 0], ['cover', 'Under cover / cold frame', 3], ['in', 'Indoors / heated', 8]];
const keptBoost = s => (KEPT.find(k => k[0] === (s.kept || 'out')) || KEPT[0])[2];
function startReady(s) {
  const boost = keptBoost(s), daily = S.weather && S.weather.daily, tf = boost ? (x => dayTemp(x, daily) + boost) : null, e = startEmerge(s);
  return leafAnchored(s, s.cropId, e, leafTarget((TRANSPLANT[s.cropId] || [])[1]), tf) || leafDate(s.cropId, e, Math.max(5, tpDays(s.cropId) - germAvg(s.cropId)), tf, learnedFactor(s.cropId, 'out'));
}
// when to sow in a tray to be ready by a planting date
function traySowFor(id, plantDate) {
  let sow = addDays(plantDate, -tpDays(id));
  const kept = ((S.starts || []).slice(-1)[0] || {}).kept || 'out';   // assume trays are kept where you usually keep them
  for (let i = 0; i < 8; i++) { const r = startReady({ cropId: id, sowDate: sow, kept }), diff = daysBetween(plantDate, r); if (Math.abs(diff) <= 1) break; sow = addDays(sow, -diff); }
  return sow;
}
// harvest: catalogue days hold for sowing at the crop's usual (best) time; colder sowings stretch out
const _need = {};
// growth the catalogue days represent: normal temperatures from the usual sowing month nearest to this sowing
function refMonth(id, effSow) {
  const months = crop(id).sow || [], m = pd(effSow).getMonth() + 1;
  if (!months.length || months.includes(m)) return m;
  const dist = x => { const a = Math.abs(x - m); return Math.min(a, 12 - a); };
  return months.slice().sort((a, b) => dist(a) - dist(b) || ((m - b + 12) % 12) - ((m - a + 12) % 12))[0];
}
function calibratedNeed(id, days, offset, month) {
  const k = [id, days, offset, month].join('|'); if (_need[k] != null) return _need[k];
  const from = addDays(`2026-${String(month).padStart(2, '0')}-15`, offset), end = addDays(from, days);
  let acc = 0; for (let d = from; d < end; d = addDays(d, 1)) acc += growUnits(id, normalT(d));
  return (_need[k] = acc || days * 8);
}
function trayDateOf(p) { if (p.seededOn) return { d: p.seededOn }; const s = p.id && (S.starts || []).find(x => x.planId === p.id); return s ? { d: s.sowDate, up: s.upOn } : null; }
function harvestModel(p, raw) {
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
function harvestEstimate(p) {
  const m = harvestModel(p); if (!m) return p.harvestDate || '';
  let d = ddUntil(m.from, m.need, p.cropId, tempFor(p.containerId));
  const fe = frostEnd(p); if (fe && d > fe) d = fe;   // autumn potatoes: the tops die back with the first frosts, so they're dug then
  return d < addDays(p.sowDate, 14) ? addDays(p.sowDate, 14) : d;
}
// for frost-tender crops planted for autumn: the date the first frosts usually finish the tops (normal mean temperature falls to ~8.5 °C)
function frostEnd(p) {
  const cr = crop(p.cropId); if (!cr.frostEnd || !p.sowDate) return null;
  const m = pd(p.sowDate).getMonth() + 1; if (m < 7 || m > 10) return null;   // spring crops are dug before summer, not stopped by frost
  const c = container(p.containerId); if (c && c.indoor) return null;
  for (let d = addDays(p.sowDate, 30), i = 0; i < 200; i++, d = addDays(d, 1)) if (normalT(d) < 8.5) return d;
  return null;
}
// keep harvest dates current unless set by hand or picking has started
function syncHarvest() {
  if (!S.hvMig) {   // older plantings: keep dates that were clearly typed in by hand
    for (const p of S.plantings) {
      if (p.status === 'harvested' || !p.harvestDate || !p.sowDate) continue;
      const cr = crop(p.cropId), dh = +cr.daysHarvest || 0, tp = raisable(p.cropId) ? tpDays(p.cropId) : 0;
      const old = [addDays(p.sowDate, dh), addDays(p.sowDate, Math.max(14, dh - tp)), p.seededOn ? addDays(p.seededOn, dh) : null].filter(Boolean);
      if (!old.some(o => Math.abs(daysBetween(o, p.harvestDate)) <= 1)) p.harvestFixed = true;
    }
    S.hvMig = true;
  }
  for (const p of S.plantings) {
    if (p.status === 'harvested' || p.harvestFixed || (p.harvests || []).length || !crop(p.cropId).daysHarvest) continue;
    if (S.tasks.some(t => t.plantingId === p.id && t.kind === 'harvest' && t.done)) continue;
    const nd = harvestEstimate(p);
    if (nd && nd !== p.harvestDate) { p.harvestDate = nd; syncTasks(p); }
  }
  for (const p of S.plantings) if (isPlanned(p)) syncPlanTasks(p);   // tray-sowing reminders follow the weather too
  for (const s of startsGrowing()) syncStartTasks(s);                 // and plant-out dates of seedlings in trays
}
function harvestNote(p) {
  if (p.harvestFixed) return 'date set by you';
  const c = container(p.containerId), m = harvestModel(p), cr = crop(p.cropId), t = trayDateOf(p);
  const base = m ? `${+p.daysFrom || cr.daysHarvest} days from ${p.method === 'seed' ? 'sowing' : t && cr.method === 'seed' ? 'tray sowing' : 'planting'} in usual weather, counted from ${shortDate(m.from)} at the pace the temperatures allow` : 'estimated from the catalogue and the temperatures';
  const bits = [base];
  if (c && (c.indoor || (c.sun || 'full') !== 'full')) bits.push(c.indoor ? 'indoors' : (c.sun === 'part' ? 'part sun' : 'shade'));
  const l = learnedText(p.cropId, 'harvest'); if (l) bits.push('your ' + crop(p.cropId).en.toLowerCase() + ' has been ' + l);
  return bits.join('; ');
}
// keep thinning dates up to date as germination is recorded and the weather comes in
function syncThin() {
  for (const p of S.plantings) {
    if (!isLive(p) || p.method !== 'seed' || p.thinned || p.thinFixed || !(+p.thinSp > 0) || !crop(p.cropId).daysThin) continue;
    const nd = thinEstimate(p);
    if (nd && nd !== p.thinDate) { p.thinDate = nd; syncTasks(p); }
  }
}
function thinNote(p) {
  if (p.thinFixed) return 'date set by you';
  const e = emergeDate(p), L = lastLeaves(p), l = learnedText(p.cropId, 'thin');
  const anch = L && leafAnchored(p, p.cropId, e.d, leafTarget(p.thinStage || crop(p.cropId).thinStage), tempFor(p.containerId));
  return anch ? `from your leaf count on ${shortDate(L.date)}` : `from ${e.known ? 'when they came up (' + shortDate(e.d) + ')' : 'expected germination'} and the temperatures${l ? '; ' + l : ''}`;
}
