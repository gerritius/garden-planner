/* Product totals, spray waiting periods (収穫前日数), frost jobs, soil / fertility notes. */
'use strict';

// ---------- soil fertility from the last crop ----------
const FEED = {
  nasu: 'heavy', tomato: 'heavy', minitomato: 'heavy', piman: 'heavy', chilli: 'heavy', shishito: 'heavy', kyuri: 'heavy', zucchini: 'heavy', corn: 'heavy',
  hakusai: 'heavy', cabbage: 'heavy', broccoli: 'heavy', cauliflower: 'heavy', celery: 'heavy', naganegi: 'heavy', onion: 'heavy', satoimo: 'heavy',
  potato: 'medium', daikon: 'medium', kabu: 'medium', komatsuna: 'medium', spinach: 'medium', lettuce: 'medium', chingensai: 'medium', mizuna: 'medium',
  shungiku: 'medium', garlic: 'medium', hatamanegi: 'medium', nanohana: 'medium', strawberry: 'medium',
  carrot: 'light', hatsuka: 'light', satsumaimo: 'light',
  edamame: 'legume', snappea: 'legume', ingen: 'legume', sayaendo: 'legume', soramame: 'legume',
};
const FEED_LABEL = { heavy: 'heavy feeder', medium: 'medium feeder', light: 'light feeder', legume: 'legume (adds nitrogen)' };
const feedOf = (cropId, h) => (h && h.feed) || FEED[cropId] || (crop(cropId).family === 'legume' ? 'legume' : crop(cropId).feed) || '';
const NO_FRESH_COMPOST = ['carrot', 'daikon', 'hatsuka', 'kabu', 'satsumaimo'];

// returns { level: 'warn'|'note', text, base: multiplier for base fertiliser, compost: multiplier } or null
function soilAdvice(c, from, to, nextCropId, beforeDate, excludeId) {
  const prev = lastCropIn(c, from, to, beforeDate, excludeId);
  if (!prev) return null;
  const pf = feedOf(prev.cropId, prev), nf = nextCropId ? feedOf(nextCropId) : '';
  const pn = esc(crop(prev.cropId).en), nn = nextCropId ? esc(crop(nextCropId).en) : '';
  const out = { prev, pf, base: 1, compost: 1, level: 'note', text: '' };
  if (pf === 'legume') {
    out.base = 0.67;
    out.text = `<b>${pn}</b> was a legume, so the soil has extra nitrogen. Cut the base fertiliser by about a third.`;
    if (nf === 'light' || nextCropId === 'satsumaimo') { out.base = 0.4; out.level = 'warn'; out.text += ` ${nn} especially dislikes rich soil (leafy growth, forked or small roots) — go very light on fertiliser.`; }
    else if (nf === 'heavy') out.text += ` Good spot for ${nn}.`;
  } else if (pf === 'heavy') {
    out.compost = 1.5;
    out.text = `<b>${pn}</b> is a heavy feeder, so the soil is likely run down. Dig in extra compost and use the full base fertiliser.`;
    if (nf === 'heavy') { out.level = 'warn'; out.text += ` ${nn} is hungry too — consider adding 50% more compost, or plant a legume or light feeder here instead.`; }
  } else if (pf === 'light') {
    out.text = `<b>${pn}</b> is a light feeder, so the soil shouldn’t be too depleted. Normal compost and base fertiliser.`;
  } else if (pf === 'medium') {
    out.text = `<b>${pn}</b> was a medium feeder. Normal compost and base fertiliser.`;
  } else return null;
  if (nextCropId && NO_FRESH_COMPOST.includes(nextCropId)) out.text += ` For ${nn}, dig compost in at least 3 weeks before sowing — fresh compost or manure causes forked roots.`;
  return out;
}

// ---------- spray waiting period (pre-harvest interval) ----------
function sprayHolds(p, today = todayStr()) {
  if (!p || p.status === 'harvested') return [];
  return (S.log || []).filter(e => e.kind === 'spray' && +e.phi > 0 && addDays(e.date, +e.phi) > today && e.date <= today &&
    (!p.sowDate || p.sowDate <= e.date) &&
    ((e.pids || []).includes(p.id) || (e.cids || []).includes(p.containerId) || (!(e.pids || []).length && !(e.cids || []).length)))
    .map(e => ({ until: addDays(e.date, +e.phi), e })).sort((a, b) => (a.until < b.until ? 1 : -1));
}
function sprayBanner(p) {
  const h = sprayHolds(p)[0]; if (!h) return '';
  return `<div class="banner warn">💦 Sprayed <b>${esc(h.e.product || 'pesticide')}</b> on ${shortDate(h.e.date)} — <b>don’t pick until ${shortDate(h.until)}</b> (${h.e.phi}-day wait).</div>`;
}
function sprayAlerts() {
  const act = S.plantings.filter(p => p.status !== 'harvested'), by = {};
  for (const p of act) { const h = sprayHolds(p)[0]; if (h) (by[h.until] = by[h.until] || []).push([p, h]); }
  const ks = Object.keys(by).sort(); if (!ks.length) return '';
  return `<div class="banner warn">💦 <b>Spray waiting period</b> — don’t pick ${ks.map(u => `${by[u].map(([p]) => `<a href="#/plant/${p.id}">${esc(crop(p.cropId).en)}</a>`).join(', ')} until <b>${shortDate(u)}</b>`).join('; ')}.</div>`;
}

// ---------- frost ----------
const HALF_HARDY = ['lettuce', 'celery', 'shungiku', 'strawberry'];
function frostRisk() {
  const days = Weather.days().slice(0, 5);
  const act = S.plantings.filter(p => p.status !== 'harvested' && (!p.sowDate || p.sowDate <= addDays(todayStr(), 4)));
  const out = [];
  for (const d of days) {
    if (d.min > 2) continue;
    const hit = act.filter(p => crop(p.cropId).tender || (d.min <= -1 && HALF_HARDY.includes(p.cropId)));
    out.push({ d, hit, hard: d.min <= -2 });
  }
  return out;
}
function syncFrost() {
  const td = todayStr();
  S.tasks = S.tasks.filter(t => !(t.kind === 'frost' && t.done && daysBetween(t.doneOn, td) > 60));
  const open = S.tasks.find(t => t.kind === 'frost' && !t.done);
  const r = (S.weather && S.weather.lat != null) ? frostRisk().find(x => x.hit.length) : null;
  if (!r) { if (open && open.due <= td) S.tasks = S.tasks.filter(x => x !== open); return; }
  if (S.tasks.some(t => t.kind === 'frost' && t.done && t.frostDate === r.d.date)) return;
  const names = [...new Set(r.hit.map(p => crop(p.cropId).en))];
  const due = addDays(r.d.date, -1) < td ? td : addDays(r.d.date, -1);
  const title = `Cover before frost ${dayName(r.d.date)} (${Math.round(r.d.min)}°): ${names.join(', ')}`;
  const cids = [...new Set(r.hit.map(p => p.containerId))];
  if (open) Object.assign(open, { title, due, frostDate: r.d.date, cids });
  else S.tasks.push({ id: uid(), kind: 'frost', title, due, frostDate: r.d.date, cids, done: false });
}

// ---------- product totals ----------
const unitBase = u => u === 'handful' ? ['g', HANDFUL_G] : u === 'L' ? ['mL', 1000] : u === 'mL' ? ['mL', 1] : ['g', 1];
const fmtTot = (v, b) => b === 'g' ? (v >= 1000 ? `${+(v / 1000).toFixed(2)} kg` : `${Math.round(v)} g`) : (v >= 1000 ? `${+(v / 1000).toFixed(2)} L` : `${Math.round(v)} mL`);
function productUses(year) {
  const uses = [];
  for (const e of S.log || []) {
    if (!e.product || e.amount == null || !['fert', 'spray', 'soil', 'pest', 'other', 'water'].includes(e.kind) || (year && e.date.slice(0, 4) !== year)) continue;
    const targets = [...new Set([...(e.cids || []), ...(e.pids || []).map(id => (planting(id) || {}).containerId).filter(Boolean)])];
    const [b, mul] = unitBase(e.unit), amt = +e.amount * mul;
    if (!targets.length) uses.push({ product: e.product, kind: e.kind, date: e.date, base: b, amt, cid: '' });
    else targets.forEach(cid => uses.push({ product: e.product, kind: e.kind, date: e.date, base: b, amt: e.per === 'total' ? amt / targets.length : amt, cid }));
  }
  for (const p of S.plantings) for (const s of p.series || []) {
    if (!s.product || s.amount == null) continue;
    for (const t of S.tasks) if (t.seriesId === s.id && t.done && t.doneOn && (!year || t.doneOn.slice(0, 4) === year)) {
      const [b, mul] = unitBase(s.unit); uses.push({ product: s.product, kind: 'fert', date: t.doneOn, base: b, amt: +s.amount * mul, cid: p.containerId });
    }
  }
  return uses;
}
function pageTotals(q) {
  const years = [...new Set([...(S.log || []).map(e => e.date.slice(0, 4)), ...S.tasks.filter(t => t.doneOn).map(t => t.doneOn.slice(0, 4)), todayStr().slice(0, 4)])].sort().reverse();
  const y = q.get('y') || years[0], kf = q.get('k') || 'all', cid = q.get('c') || '';
  setChrome('Product totals', { back: true, kicker: y === 'all' ? 'All years' : y });
  let uses = productUses(y === 'all' ? '' : y);
  if (kf !== 'all') uses = uses.filter(u => (kf === 'fert' ? ['fert', 'soil'].includes(u.kind) : u.kind === kf));
  if (cid) uses = uses.filter(u => u.cid === cid || !u.cid);
  const by = {};
  for (const u of uses) { const k = u.product.trim().toLowerCase() + '|' + u.base; (by[k] = by[k] || { name: u.product.trim(), base: u.base, kind: u.kind, total: 0, n: 0, last: '', beds: {} }); const r = by[k]; r.total += u.amt; r.n++; if (u.date > r.last) r.last = u.date; r.beds[u.cid] = (r.beds[u.cid] || 0) + u.amt; }
  const rows = Object.values(by).sort((a, b) => b.n - a.n);
  const url = o => { const u = new URLSearchParams({ y, k: kf, c: cid }); for (const k in o) u.set(k, o[k]); [...u.keys()].forEach(k => { if (!u.get(k) || u.get(k) === 'all' && k !== 'y') u.delete(k); }); return '#/totals?' + u; };
  const chip = (k, l, cur, key) => `<a class="chip big${k === cur ? ' on' : ''}" href="${url({ [key]: k })}" onclick="location.replace(this.href);return false;">${l}</a>`;
  const html = `<div class="sowchips filt">${years.map(v => chip(v, v, y, 'y')).join('')}${chip('all', 'All years', y, 'y')}</div>
    <div class="sowchips filt">${[['all', 'Everything'], ['fert', 'Fertiliser & soil'], ['spray', 'Sprays']].map(([k, l]) => chip(k, l, kf, 'k')).join('')}</div>
    <label class="inline">Bed / pot <select id="totc"><option value="">All</option>${S.containers.map(c => `<option value="${c.id}"${c.id === cid ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    ${rows.length ? rows.map(r => `<section class="tot"><h3>${KIND_ICON[r.kind] || '•'} ${esc(r.name)}</h3>
      <p class="big">${fmtTot(cid ? (r.beds[cid] || 0) : r.total, r.base)}<small> · used ${r.n}× · last ${shortDate(r.last)}</small></p>
      ${!cid ? `<ul class="plist tight">${Object.entries(r.beds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<li><span class="grow">${k ? esc((container(k) || {}).name || '?') : 'Whole garden'}</span><b>${fmtTot(v, r.base)}</b></li>`).join('')}</ul>` : ''}
      ${cid && r.beds[''] ? `<p class="hint">Plus ${fmtTot(r.beds[''], r.base)} logged for the whole garden.</p>` : ''}</section>`).join('')
      : '<div class="empty-state">No amounts logged yet.<br><small>Log fertiliser or sprays with an amount (Log tab → Log something), or add a product and amount to a repeating fertiliser job.</small></div>'}
    <p class="hint">Handfuls count as ~${HANDFUL_G} g. When one entry covers several beds, the amount is counted per bed unless you chose “in total”.</p>`;
  return { html, after: () => { $('#totc').onchange = e => location.replace(url({ c: e.target.value })); } };
}
