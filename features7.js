/* Season planning (planned crops, prep counted back from planting day, gaps & suggestions),
   spray-day forecast from hourly weather, and weather alert jobs (wind, heavy rain, heat). */
'use strict';

const isLive = p => p.status !== 'harvested' && p.status !== 'planned';
const isPlanned = p => p.status === 'planned';

// ---------- when a crop occupies its space ----------
function endOf(p) {
  if (p.status === 'harvested') return p.harvestedOn || p.harvestDate || p.sowDate;
  const cr = crop(p.cropId);
  let e = p.harvestDate ? addDays(p.harvestDate, cr.cont ? Math.min(cr.win || 45, 90) : Math.min(cr.win || 14, 21)) : addDays(p.sowDate || todayStr(), 120);
  if (isLive(p) && e < todayStr()) e = todayStr();
  return e;
}
const sectionOf = p => { const c = container(p.containerId); return c && (c.type === 'bed' || p.from > 0 || p.to < Draw.dims(c).L) ? `${p.from}–${p.to} cm` : ''; };
// plantings (growing or planned) that share this space at some point in [d1, d2]
function occupants(cid, from, to, d1, d2, excludeId) {
  return S.plantings.filter(p => p.containerId === cid && p.id !== excludeId && (isLive(p) || isPlanned(p)) && p.from < to - 0.5 && p.to > from + 0.5 &&
    (p.sowDate || todayStr()) <= d2 && endOf(p) >= d1);
}
// previous crop in this space before a planned date — includes crops still growing or planned
function planRotation(c, from, to, cropId, date, excludeId) {
  const cands = [];
  for (const h of c.history || []) if (h.plantingId !== excludeId && h.from < to - 0.5 && h.to > from + 0.5 && (h.harvestedOn || '') <= date) cands.push({ cropId: h.cropId, end: h.harvestedOn || '' });
  for (const p of S.plantings) if (p.containerId === c.id && p.id !== excludeId && (isLive(p) || isPlanned(p)) && p.from < to - 0.5 && p.to > from + 0.5 && (p.sowDate || '') < date) cands.push({ cropId: p.cropId, end: endOf(p), p });
  if (!cands.length) return null;
  const prev = cands.sort((a, b) => (a.end < b.end ? -1 : 1)).pop(), a = crop(prev.cropId), b = cropId ? crop(cropId) : null;
  const same = !!(b && a.family && a.family !== 'other' && a.family === b.family), fam = same ? FAMILIES[a.family] : null;
  return { prev, same, html: same ? `<b>Same family as the crop before it.</b> ${esc(a.en)} ${prev.p ? `will be here until about ${shortDate(prev.end)}` : `was here (${shortDate(prev.end)})`} — both are ${esc(fam[0])} ${esc(fam[1])}. Consider a different spot or extra compost.`
    : `Follows ${esc(cropName(prev.cropId))}${prev.p ? ` (here until about ${shortDate(prev.end)})` : ''}.` };
}

// ---------- planned plantings → jobs counted back from planting day ----------
const productByName = n => PRODUCTS.find(x => x.en === n || x.ja === n);
const raisable = id => !!(TRANSPLANT[id] && TRANSPLANT[id][0] > 0);
const linkedStart = p => (S.starts || []).find(s => s.planId === p.id && s.status === 'growing');
function planItems(p) {
  const c = container(p.containerId), cr = crop(p.cropId), sd = p.sowDate, td = todayStr(), items = [], dayOf = [];
  const where = c ? c.name + (sectionOf(p) ? ' ' + sectionOf(p) : '') : '';
  for (const f of p.fert || []) {
    if (!f.product) continue;
    const pr = productByName(f.product), wait = pr ? +pr.wait || 0 : 14, amt = fmtAmt(f.amount, f.unit), due = addDays(sd, -wait);
    if (wait > 0) items.push({ key: 'prep:' + f.product, kind: 'plan_prep', due, title: `Dig in ${f.product}${amt ? ' ' + amt : ''} — for ${cr.en} (${where})${due < td ? ` · short notice: best ${wait} days before planting` : ''}` });
    else dayOf.push(`${f.product}${amt ? ' ' + amt : ''}`);
  }
  if ((p.raise === 'tray' || p.raise === 'pot') && raisable(p.cropId) && !linkedStart(p))
    items.push({ key: 'tray', kind: 'plan_tray', due: traySowFor(p.cropId, sd), title: `Sow ${cr.en}${p.variety ? ' · ' + p.variety : ''} in ${p.raise === 'tray' ? 'a cell tray' : '9 cm pots'} (to plant out ${shortDate(sd)})` });
  items.push({ key: 'sow', kind: 'plan_sow', due: sd, title: `${p.method === 'seed' ? 'Sow' : 'Plant out'} ${cr.en}${p.variety ? ' · ' + p.variety : ''}${dayOf.length ? ` — mix in ${dayOf.join(' + ')} first` : ''}` });
  return items;
}
function syncPlanTasks(p) {
  const td = todayStr(), skip = p.planSkip || [], items = planItems(p).filter(i => !skip.includes(i.key));
  S.tasks = S.tasks.filter(t => !(t.plantingId === p.id && t.plan && !t.done && !items.some(i => i.key === t.key)));
  for (const i of items) {
    const ex = S.tasks.find(t => t.plantingId === p.id && t.plan && t.key === i.key);
    const due = i.kind !== 'plan_sow' && i.due < td ? td : i.due;
    if (ex) { if (ex.done) continue; ex.title = i.title; ex.kind = i.kind; if (!ex.manualDue) ex.due = due; }
    else S.tasks.push({ id: uid(), plantingId: p.id, plan: true, kind: i.kind, key: i.key, title: i.title, due, done: false });
  }
}
// the planned crop goes in: becomes a normal planting, dates shift to the real day
function activatePlan(p, date, n) {
  const delta = daysBetween(p.sowDate, date);
  p.status = 'active'; p.plannedFor = p.sowDate;
  if (delta) {
    p.sowDate = date;
    if (p.harvestDate) p.harvestDate = p.harvestFixed ? addDays(p.harvestDate, delta) : harvestEstimate(p);
    if (p.thinDate) p.thinDate = addDays(p.thinDate, delta);
    for (const s of p.series || []) if (s.start) s.start = addDays(s.start, delta);
  }
  const s = linkedStart(p);
  if (s && startLeft(s) > 0) startPlanted({ startId: s.id, startN: Math.min(startLeft(s), n || startLeft(s)) }, p);
  syncTasks(p);
}
function undoActivate(p) {
  p.status = 'planned';
  if (p.plannedFor && p.plannedFor !== p.sowDate) { const back = daysBetween(p.sowDate, p.plannedFor); p.sowDate = p.plannedFor; if (p.harvestDate) p.harvestDate = addDays(p.harvestDate, back); if (p.thinDate) p.thinDate = addDays(p.thinDate, back); for (const s of p.series || []) if (s.start) s.start = addDays(s.start, back); }
  for (const s of S.starts || []) { const i = (s.events || []).findIndex(e => e.pid === p.id); if (i >= 0) { s.events.splice(i, 1); s.status = 'growing'; s.planId = p.id; syncStartTasks(s); } }
  S.tasks = S.tasks.filter(t => !(t.plantingId === p.id && !t.done && !t.plan));
  syncPlanTasks(p);
}
function planTrayPreset(p) {
  const c = container(p.containerId); let n = 0;
  try { n = c ? Draw.layout(c, p).pts.length : 0; } catch (e) { /* ignore */ }
  return { cropId: p.cropId, variety: p.variety || '', kind: p.raise === 'pot' ? 'pot' : 'tray', count: n ? Math.ceil(n * 1.25) : '', planId: p.id };
}

// ---------- planning bits on the planting form ----------
function planFormBits(d, c) {
  if (!d.sowDate || d.sowDate <= todayStr()) return '';
  const cr = d.cropId ? crop(d.cropId) : null;
  const raise = cr && d.method === 'seedling' && raisable(cr.id) && !d.useStart;
  return `<div class="plannote">📅 <b>Planned</b> — saved as a plan. Prep jobs are counted back from this date${raise ? ', plus a reminder to sow seedlings' : ''}; it goes into the bed when you tick “${d.method === 'seed' ? 'Sow' : 'Plant out'}”.</div>
    ${raise ? `<label>Seedlings<div class="seg">${[['buy', 'Buy them'], ['tray', 'Raise in tray'], ['pot', 'Raise in 9 cm pots']].map(([v, l]) => `<button type="button" data-act="raise" data-v="${v}" class="${(d.raise || 'buy') === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${d.raise === 'tray' || d.raise === 'pot' ? `<small class="hint">Sow them around ${shortDate(traySowFor(cr.id, d.sowDate))} (about ${daysBetween(traySowFor(cr.id, d.sowDate), d.sowDate)} days before at that time of year).</small>` : ''}</label>` : ''}`;
}

// ---------- gaps & suggestions ----------
function freeGaps(c, horizon = 300) {
  const td = todayStr(), end = addDays(td, horizon), L = Draw.dims(c).L;
  const ps = S.plantings.filter(p => p.containerId === c.id && (isLive(p) || isPlanned(p)));
  const cuts = [...new Set([0, L, ...ps.flatMap(p => [p.from, p.to])])].filter(x => x >= 0 && x <= L).sort((a, b) => a - b);
  const raw = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i], b = cuts[i + 1]; if (b - a < 5) continue;
    const occ = ps.filter(p => p.from < b - 0.5 && p.to > a + 0.5).map(p => ({ p, s: isLive(p) ? td : p.sowDate, e: endOf(p) })).sort((x, y) => (x.s < y.s ? -1 : 1));
    let cur = td, prev = null;
    for (const o of occ) {
      if (o.e < cur) { prev = o.p; continue; }
      if (daysBetween(cur, o.s) >= 21) raw.push({ a, b, s: cur, e: addDays(o.s, -1), prev, next: o.p });
      if (o.e >= cur) { cur = addDays(o.e, 1); prev = o.p; }
    }
    if (daysBetween(cur, end) >= 21) raw.push({ a, b, s: cur, e: null, prev, next: null });
  }
  const out = [];
  for (const g of raw.sort((x, y) => (x.s < y.s ? -1 : x.s > y.s ? 1 : x.a - y.a))) {
    const m = out.find(o => o.s === g.s && o.e === g.e && o.b === g.a);
    if (m) { m.b = g.b; m.prev = m.prev || g.prev; m.next = m.next || g.next; } else out.push(Object.assign({}, g));
  }
  return out.sort((x, y) => (x.s < y.s ? -1 : 1));
}
// crops that can go in this gap: sowable in the gap's month or the next two (then they start on the 1st of that month)
function gapCrops(c, g, n = 6) {
  const prevFam = g.prev ? crop(g.prev.cropId).family : null, s0 = pd(g.s);
  const grown = new Set(S.plantings.map(p => p.cropId).concat(...S.containers.map(x => (x.history || []).map(h => h.cropId))));
  const out = [];
  for (let k = 0; k < 3; k++) {
    const md = new Date(s0.getFullYear(), s0.getMonth() + k, 1), m = md.getMonth() + 1, from = k ? ymd(md) : g.s;
    if (g.e && from >= g.e) break;
    const days = g.e ? daysBetween(from, g.e) : 9999;
    for (const cr of allCrops()) {
      if (out.some(o => o.cr.id === cr.id) || !(cr.sow || []).includes(m) || !cr.daysHarvest || cr.daysHarvest + 7 > days) continue;
      if (prevFam && prevFam !== 'other' && cr.family === prevFam) continue;
      if ((cr.spread || 20) > Math.max(g.b - g.a, 30) + 20) continue;
      out.push({ cr, from, k });
    }
  }
  return out.sort((a, b) => a.k - b.k || (grown.has(b.cr.id) - grown.has(a.cr.id)) || a.cr.daysHarvest - b.cr.daysHarvest).slice(0, n);
}
function gapLi(c, g) {
  const L = Draw.dims(c).L, part = g.a > 0 || g.b < L ? `${g.a}–${g.b} cm` : c.type === 'bed' ? 'Whole bed' : 'Whole pot';
  const days = g.e ? daysBetween(g.s, g.e) + 1 : null, sugg = gapCrops(c, g);
  const url = (id, from) => `#/plant/new/${c.id}?plan=1&from=${g.a}&to=${g.b}&date=${from || g.s}${id ? '&crop=' + id : ''}`;
  return `<li class="gap"><div><b>${part}</b> free ${g.s <= todayStr() ? 'now' : 'from ' + shortDate(g.s)}${g.e ? ` until ${shortDate(g.e)} <small>(${days} days, before ${esc(crop(g.next.cropId).en)})</small>` : ''}${g.prev ? ` <small>· after ${esc(crop(g.prev.cropId).en)}</small>` : ''}</div>
    <div class="sowchips">${gapStartChips(c, g)}${sugg.map(({ cr, from, k }) => `<a class="chip" href="${url(cr.id, from)}">${ic(cr.id, 18)}${esc(cr.en)} <small>${k ? pd(from).toLocaleDateString('en-AU', { month: 'short' }) + ' · ' : ''}${cr.daysHarvest}d</small></a>`).join('')}<a class="chip muted" href="${url('')}">＋ Other…</a></div></li>`;
}

// ---------- timeline ----------
function planTimeline(c, t0, t1) {
  const span = daysBetween(t0, t1), pct = d => Math.max(0, Math.min(100, daysBetween(t0, d) / span * 100));
  const ps = S.plantings.filter(p => p.containerId === c.id && (isLive(p) || isPlanned(p) || (p.status === 'harvested' && (p.harvestedOn || '') >= t0)));
  const rows = [];
  for (const p of ps.sort((a, b) => a.from - b.from || (a.sowDate < b.sowDate ? -1 : 1))) {
    const k = sectionOf(p) || 'all', r = rows.find(x => x.k === k) || (rows.push({ k, ps: [] }), rows[rows.length - 1]); r.ps.push(p);
  }
  const td = todayStr();
  return `<div class="tl">${rows.map(r => `<div class="tlrow"><span class="tll">${r.k === 'all' ? '' : esc(r.k)}</span><div class="tlbar">${r.ps.map(p => {
    const s = p.sowDate || td, e = endOf(p); if (e < t0 || s > t1) return '';
    const l = pct(s), w = Math.max(2, pct(e) - l);
    return `<a href="#/plant/${p.id}" class="tlb${isPlanned(p) ? ' planned' : ''}${p.status === 'harvested' ? ' done' : ''}" style="left:${l}%;width:${w}%;--c:${crop(p.cropId).color}" title="${esc(crop(p.cropId).en)}">${esc(crop(p.cropId).en)}</a>`; }).join('')}<i class="tlnow" style="left:${pct(td)}%"></i></div></div>`).join('') || '<p class="muted small">Nothing growing or planned.</p>'}</div>`;
}
function monthTicks(t0, t1) {
  const span = daysBetween(t0, t1), out = [];
  for (let d = pd(t0); d < pd(t1); d.setMonth(d.getMonth() + 1)) { const s = d.toISOString().slice(0, 10); out.push(`<span style="left:${daysBetween(t0, ymd(d)) / span * 100}%">${d.toLocaleDateString('en-AU', { month: 'short' })}</span>`); }
  return `<div class="tlmonths"><span class="tll"></span><div class="tlbar">${out.join('')}</div></div>`;
}
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function planRange() { const now = new Date(); const t0 = ymd(new Date(now.getFullYear(), now.getMonth(), 1)), t1 = ymd(new Date(now.getFullYear(), now.getMonth() + 9, 1)); return [t0, t1]; }
function pagePlan() {
  setChrome('Season plan', { back: true, kicker: 'What’s growing when — and what could go in the gaps' });
  const [t0, t1] = planRange(), cs = S.containers.filter(c => c.type !== 'nursery').sort((a, b) => (a.type === 'bed') === (b.type === 'bed') ? 0 : a.type === 'bed' ? -1 : 1);
  const html = `<p class="hint">Bars run from sowing/planting to the end of picking. <span class="tlkey planned">Striped</span> = planned. Tap a free gap’s crop to plan it — prep jobs are added counting back from the planting date.</p>
    ${cs.map(c => { const gs = freeGaps(c).slice(0, 4); return `<section class="plan"><h3><a href="#/container/${c.id}">${esc(c.name)}</a> <small class="muted">${esc(sizeLabel(c))}</small></h3>
      ${monthTicks(t0, t1)}${planTimeline(c, t0, t1)}
      ${gs.length ? `<ul class="gaps">${gs.map(g => gapLi(c, g)).join('')}</ul>` : '<p class="muted small">No gaps longer than 3 weeks.</p>'}</section>`; }).join('') || '<div class="empty-state">Add a bed or pot first.</div>'}`;
  return { html };
}
// on the bed page
function planSection(c) {
  const planned = S.plantings.filter(p => p.containerId === c.id && isPlanned(p)).sort((a, b) => (a.sowDate < b.sowDate ? -1 : 1));
  const gs = freeGaps(c).filter(g => g.s > todayStr()).slice(0, 3);
  return `<section><h3>Planned</h3>
    ${planned.length ? `<ul class="plist">${planned.map(p => `<li><a href="#/plant/${p.id}">${ic(p.cropId)}<span class="grow"><b>${esc(cropName(p.cropId))}</b>${p.variety ? ` · ${esc(p.variety)}` : ''}<small>${sectionOf(p) ? sectionOf(p) + ' · ' : ''}${p.method === 'seed' ? 'sow' : 'plant'} ${shortDate(p.sowDate)}${p.raise === 'tray' || p.raise === 'pot' ? ` · raise seedlings from ${shortDate(traySowFor(p.cropId, p.sowDate))}` : ''}</small></span>›</a></li>`).join('')}</ul>` : '<p class="muted">Nothing planned yet.</p>'}
    ${gs.length ? `<ul class="gaps">${gs.map(g => gapLi(c, g)).join('')}</ul>` : ''}
    <div class="btnrow"><a class="btn small" href="#/plant/new/${c.id}?plan=1">📅 Plan a crop</a><a class="btn small" href="#/plan">Season plan →</a></div></section>`;
}
// on the plant page
function planBanner(p) {
  const c = container(p.containerId);
  if (isPlanned(p)) {
    A.doPlant = () => { const t = S.tasks.find(t => t.plantingId === p.id && t.kind === 'plan_sow' && !t.done); if (t) toggleTask(t.id, true); else { activatePlan(p, todayStr()); save().then(render); } };
    const ls = linkedStart(p);
    return `<div class="banner plan">📅 Planned for <b>${niceDate(p.sowDate)}</b>${p.raise === 'tray' || p.raise === 'pot' ? ` · seedlings ${ls ? `growing in ${esc(startWhere(ls).toLowerCase())} (sown ${shortDate(ls.sowDate)})` : `to sow ${shortDate(traySowFor(p.cropId, p.sowDate))}`}` : ''}
      ${planStartLinks(p)}<div class="btnrow"><button class="btn small primary" data-act="doPlant">${p.method === 'seed' ? '🌱 Sown it' : '🌱 Planted it'}</button></div></div>`;
  }
  if (!isLive(p) || !c) return '';
  return '';
}
function planNextButton(p) {
  const c = container(p.containerId); if (!c || !isLive(p)) return '';
  const next = S.plantings.find(x => isPlanned(x) && x.containerId === c.id && x.from < p.to - 0.5 && x.to > p.from + 0.5);
  return next ? `<a class="btn small" href="#/plant/${next.id}">📅 Next here: ${esc(crop(next.cropId).en)} (${shortDate(next.sowDate)})</a>`
    : `<a class="btn small" href="#/plant/new/${c.id}?plan=1&from=${p.from}&to=${p.to}&date=${addDays(endOf(p), 1)}">📅 Plan what’s next here</a>`;
}

// ---------- spray-day forecast ----------
function sprayDays() {
  const h = S.weather && S.weather.hourly; if (!h || !h.time) return [];
  const td = todayStr(), now = new Date(), nowH = now.getHours();
  const T = h.time.map((t, i) => ({ d: t.slice(0, 10), hr: +t.slice(11, 13), temp: h.temperature_2m[i], rain: h.precipitation[i] || 0, pop: (h.precipitation_probability || [])[i] ?? 0, wind: h.wind_speed_10m[i] || 0, gust: (h.wind_gusts_10m || [])[i] ?? (h.wind_speed_10m[i] || 0) * 1.6 }));
  const wet = x => !x || x.rain >= 0.2 || x.pop >= 40;
  const why = i => { const x = T[i]; if (wet(x) || [1, 2].some(k => T[i - k] && T[i - k].rain >= 0.2)) return 'rain'; for (let k = 1; k <= 6; k++) if (wet(T[i + k])) return 'rain'; if (x.wind > 11 || x.gust > 25) return 'wind'; if (x.temp > 28) return 'heat'; if (x.temp < 5) return 'cold'; return ''; };
  const days = [];
  for (let k = 0; k < 6; k++) {
    const d = addDays(td, k), idx = T.map((x, i) => i).filter(i => T[i].d === d && T[i].hr >= 6 && T[i].hr <= 17 && !(d === td && T[i].hr <= nowH));
    if (!idx.length) continue;
    const res = idx.map(i => [T[i].hr, why(i)]), wins = [];
    for (const [hr, r] of res) { if (r) continue; const w = wins[wins.length - 1]; if (w && w[1] === hr) w[1] = hr + 1; else wins.push([hr, hr + 1]); }
    const reasons = {}; res.forEach(([, r]) => { if (r) reasons[r] = (reasons[r] || 0) + 1; });
    const main = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
    days.push({ d, wins: wins.filter(w => w[1] - w[0] >= 2), why: main ? main[0] : '' });
  }
  return days;
}
const hh = h => `${h}:00`;
const WHY = { rain: '🌧 rain', wind: '💨 wind', heat: '🥵 too hot', cold: '🥶 too cold' };
function sprayDaysHTML(compact) {
  const ds = sprayDays();
  if (!ds.length) return compact ? `<div class="wxspray">💦 <b>Spray days:</b> ${navigator.onLine ? 'getting the hourly forecast…' : 'appear when you’re online'} <a href="#/sprayday">details ›</a></div>` : '';
  const best = ds.find(x => x.wins.length);
  const row = x => `<span class="spd${x.wins.length ? ' ok' : ''}"><b>${dayName(x.d)}</b>${x.wins.length ? x.wins.map(w => `${hh(w[0])}–${hh(w[1])}`).join(', ') : `✗ ${WHY[x.why] || ''}`}</span>`;
  if (compact) return `<div class="wxspray">💦 <b>Spray:</b> ${best ? `best ${dayName(best.d) === 'Today' ? 'today' : dayName(best.d)} ${best.wins.map(w => `${hh(w[0])}–${hh(w[1])}`).join(', ')}` : 'no good window in the next few days'} <a href="#/sprayday">details ›</a></div>`;
  return `<div class="spdays">${ds.map(row).join('')}</div>`;
}
function sprayDayInfo() {
  return `<ul class="bul small"><li>A good window is dry for the hour and the <b>6 hours after</b> (and wasn’t raining just before), wind under 3 m/s (gusts under ~7 m/s), and 5–28 °C.</li>
    <li>Most sprays need a few dry hours to stick; rain soon after washes them off. Benica Natural works by contact, so it also needs to hit the pests directly.</li>
    <li>Pyrethrin (Pai Benica V), spinosad (Spino Ace) and Benica X Next are harmful to bees while wet — spray early morning or late afternoon, not onto open flowers.</li>
    <li>Spray in the cool of the day: oily sprays and hot sun can scorch leaves.</li></ul>`;
}
function pageSprayDay() {
  setChrome('Spray days', { back: true, kicker: 'From the hourly forecast' });
  if (!S.weather || S.weather.lat == null) return { html: `<div class="empty-state">Set your garden’s location in Tools to see spray days.<br><a class="btn" href="#/settings">Tools</a></div>` };
  const html = `${sprayDaysHTML(false) || '<p class="muted">Hourly weather will appear when you’re online.</p>'}${sprayDayInfo()}
    ${sprayAlerts()}<div class="btnrow"><a class="btn" href="#/products">🧴 Products &amp; sprays</a><a class="btn" href="#/log">📝 Log a spray</a></div>`;
  return { html, after: () => Weather.refresh().then(ch => { if (ch && route().parts[0] === 'sprayday') render(); }) };
}

// ---------- weather alert jobs ----------
const TALL = ['tomato', 'minitomato', 'nasu', 'piman', 'shishito', 'chilli', 'kyuri', 'corn', 'snappea', 'sayaendo', 'ingen', 'soramame', 'zucchini', 'edamame'];
const NETTED = ['cabbage', 'hakusai', 'broccoli', 'cauliflower', 'komatsuna', 'chingensai', 'mizuna', 'kabu', 'daikon', 'hatsuka', 'nanohana'];
const gustOf = d => d.gust != null ? d.gust : (d.wind || 0) * 1.6;
const WX = {
  wind: { icon: '💨', test: d => gustOf(d) >= 50, val: d => `gusts ${Math.round(gustOf(d))} km/h`, severe: d => gustOf(d) >= 75,
    title: s => s ? 'Prepare for storm-force wind' : 'Secure supports & nets before strong wind' },
  rain: { icon: '🌧️', test: d => d.rain >= 40 && (d.pop == null || d.pop >= 50), val: d => `${Math.round(d.rain)} mm`, severe: d => d.rain >= 80,
    title: s => s ? 'Prepare for very heavy rain' : 'Prepare for heavy rain' },
  heat: { icon: '🥵', test: d => d.max >= 33, val: d => `${Math.round(d.max)}°`, severe: d => d.max >= 36,
    title: s => s ? 'Protect crops from extreme heat' : 'Hot day coming — water early' },
};
function syncWx() {
  const td = todayStr(), days = Weather.days().slice(0, 6);
  S.tasks = S.tasks.filter(t => !(t.kind === 'wx' && t.done && daysBetween(t.doneOn, td) > 60));
  const anything = S.plantings.some(isLive) || startsGrowing().length;
  for (const k of Object.keys(WX)) {
    const open = S.tasks.find(t => t.kind === 'wx' && t.wx === k && !t.done);
    const hit = S.weather && S.weather.lat != null && anything ? days.find(d => WX[k].test(d) && !(S.wxDismissed || []).includes(k + d.date) && !S.tasks.some(t => t.kind === 'wx' && t.wx === k && t.done && t.wxDate === d.date)) : null;
    if (!hit) { if (open) S.tasks = S.tasks.filter(x => x !== open); continue; }
    const sev = WX[k].severe(hit), due = addDays(hit.date, -1) < td ? td : addDays(hit.date, -1);
    const title = `${WX[k].title(sev)} ${dayName(hit.date) === 'Today' ? 'today' : dayName(hit.date) === 'Tmrw' ? 'tomorrow' : 'on ' + dayName(hit.date)} (${WX[k].val(hit)})`;
    if (open) Object.assign(open, { title, due, wxDate: hit.date, severe: sev });
    else S.tasks.push({ id: uid(), kind: 'wx', wx: k, title, due, wxDate: hit.date, severe: sev, done: false });
  }
}
function wxAdvice(t) {
  const live = S.plantings.filter(p => isLive(p) && !(container(p.containerId) || {}).indoor), td = todayStr();
  const names = f => [...new Set(live.filter(f).map(p => crop(p.cropId).en))].join(', ');
  const tall = names(p => TALL.includes(p.cropId)), net = names(p => NETTED.includes(p.cropId)), young = names(p => p.sowDate && daysBetween(p.sowDate, td) <= 21);
  const ready = names(p => p.harvestDate && p.harvestDate <= addDays(td, 7)), trays = startsGrowing().length > 0;
  const L = {
    wind: [tall && `Tie in stems and check stakes are firm: ${tall}`, coveredText() ? `Re-peg and weigh down covers: ${coveredText()}` : net && `Netted crops — check pegs and edges: ${net}`, `Move light pots${trays ? ', seedling trays' : ''} and anything loose somewhere sheltered`, ready && `Pick what’s ready first: ${ready}`,
      t.severe && 'Storm-force (typhoon): take off covers that act as sails, lay down supports you can’t secure, and push fabric bags together against a wall', 'Afterwards: check for snapped stems and earth up anything rocked loose (土寄せ)'],
    rain: ['Clear drainage around the beds and make sure bags aren’t standing in water', trays && 'Move seedling trays under cover', young && `Young plants can be flattened or splashed with soil — mulch or cover: ${young}`,
      'Hold off fertiliser and sprays until it’s passed — they’ll wash off', ready && `Pick what’s ready — heavy rain can split or rot it: ${ready}`, 'Afterwards: earth up anything washed out and watch for slugs and rot'],
    heat: ['Water pots & bags deeply in the early morning', young && `Shade young plants and new transplants: ${young}`, trays && 'Keep seedling trays in the shade and check them twice', 'Mulch bare soil; don’t spray or fertilise in the heat of the day'],
  };
  return (L[t.wx] || []).filter(Boolean);
}
function wxTaskDialog(t) {
  const W = WX[t.wx] || { icon: '⚠️' };
  modal(`<h3>${W.icon} ${esc(t.title)}</h3><ul class="bul">${wxAdvice(t).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <p class="hint">From the forecast for ${niceDate(t.wxDate)}. Tick the job when it’s done — it goes in the log.</p>
    <div class="btns"><button class="btn danger" data-x="del">Delete</button><button class="btn primary" data-x="ok">Close</button></div>`, (m, close) => {
    m.querySelector('[data-x=ok]').onclick = close;
    m.querySelector('[data-x=del]').onclick = async () => {
      if (!t.done) S.wxDismissed = [...(S.wxDismissed || []).filter(x => x.slice(-10) >= addDays(todayStr(), -7)), t.wx + t.wxDate];
      S.tasks = S.tasks.filter(x => x !== t); await save(); close(); render();
    };
  });
}
