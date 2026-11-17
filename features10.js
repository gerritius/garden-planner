/* Microclimate per bed/pot, learning from your own records, and true-leaf counts. */
'use strict';

// =====================================================================
// Microclimate: indoors/outdoors, sun, container size
// =====================================================================
const SUN = [['full', '☀️ Full sun'], ['part', '⛅ Part sun'], ['shade', '☁️ Shade']];
function potVolume(c) {
  if (!c || c.type === 'bed') return null;
  const dep = +c.depth || 30;
  return c.type === 'round' ? Math.PI * (c.diameter / 2) ** 2 * dep / 1000 : (c.width * c.length * dep) / 1000;
}
// how a spot shifts the daily mean temperature the plants feel (catalogue dates assume an ordinary full-sun garden)
function climateOffset(c) {
  if (!c) return T => T;
  if (c.indoor) return T => Math.min(26, Math.max(14, T + 5));
  const sun = c.sun || 'full', vol = potVolume(c);
  let off = sun === 'part' ? -0.7 : sun === 'shade' ? -1.5 : 0;
  if (vol != null && vol < 15) off += sun === 'full' ? 0.6 : sun === 'part' ? 0.3 : 0;
  else if (vol != null && vol < 60 && sun === 'full') off += 0.3;
  return T => T + off - (vol != null && vol < 15 && T < 5 ? 0.8 : 0);
}
function tempFor(cid) {
  const c = container(cid); if (!c || (!c.indoor && (c.sun || 'full') === 'full' && potVolume(c) == null)) return null;
  const adj = climateOffset(c), daily = S.weather && S.weather.daily;
  return d => adj(dayTemp(d, daily));
}
function climateLabel(c) {
  if (c.indoor) return '🏠 Indoors';
  return (SUN.find(s => s[0] === (c.sun || 'full')) || SUN[0])[1] + ' · outdoors';
}
function climateDialog(c) {
  modal(`<h3>Where is ${esc(c.name)}?</h3>
    <div class="btns col">${[['out', '🌳 Outdoors'], ['in', '🏠 Indoors']].map(([k, l]) => `<button class="btn${(c.indoor ? 'in' : 'out') === k ? ' primary' : ''}" data-io="${k}">${l}</button>`).join('')}</div>
    ${c.indoor ? '' : `<p class="small">Sun</p><div class="seg">${SUN.map(([k, l]) => `<button type="button" data-sun="${k}" class="${(c.sun || 'full') === k ? 'on' : ''}">${l}</button>`).join('')}</div>`}
    <p class="hint">Changes the growth estimates for everything in it straight away. Indoors: no rain, frost or wind alerts, and it’s left out of the rain-based watering (water it yourself). ${potVolume(c) != null ? `Pot size (~${Math.round(potVolume(c))} L) is taken into account — small pots warm up faster in sun and get colder in frost.` : ''}</p>
    <div class="btns"><button class="btn primary" data-x="ok">Done</button></div>`, (m, close) => {
    m.querySelector('[data-x=ok]').onclick = close;
    m.querySelectorAll('[data-io]').forEach(b => b.onclick = async () => { c.indoor = b.dataset.io === 'in'; await save(); close(); render(); climateDialog(c); });
    m.querySelectorAll('[data-sun]').forEach(b => b.onclick = async () => { c.sun = b.dataset.sun; await save(); close(); render(); });
  });
}

// =====================================================================
// True-leaf counts
// =====================================================================
function leafTarget(text) {
  const m = String(text || '').match(/本葉\s*(\d+)(?:\s*[–\-~〜]\s*(\d+))?\s*枚/);
  return m ? (m[2] ? (+m[1] + +m[2]) / 2 : +m[1]) : null;
}
const lastLeaves = o => (o.leaves || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1)).pop() || null;
// milestone date from a leaf count: same pace as the plant has shown so far
function leafAnchored(o, id, emerge, target, tempFn) {
  const L = lastLeaves(o); if (!L || target == null) return null;
  if (L.n >= target) return L.date;
  if (emerge > addDays(L.date, -3)) emerge = addDays(L.date, -Math.max(3, Math.round(L.n * 4)));   // they were up well before leaves appeared
  const done = ddBetween(emerge, L.date, id, tempFn);
  if (L.n < 0.5 || done <= 0) return null;
  return ddUntil(L.date, (target - L.n) * done / L.n, id, tempFn);
}
function leafDialog(o, label, after) {
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

// =====================================================================
// Learning from your records
// =====================================================================
function ddBetween(from, to, id, tempFn) {
  const daily = S.weather && S.weather.daily, f = tempFn || (x => dayTemp(x, daily));
  let acc = 0; for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) acc += growUnits(id, f(d));
  return acc;
}
let _learn = null, _learnKey = '', _learnBusy = false;
// actual ÷ predicted, per crop and stage: germ (days), thin, out (plant-out), harvest (degree-days)
function learnSamples() {
  if (_learnBusy) return {};   // estimates used while learning are the plain model
  const key = JSON.stringify([S.plantings.map(p => [p.cropId, p.sowDate, p.germ && p.germ.date, p.thinDoneOn, (p.harvests || []).length, p.containerId]), (S.starts || []).map(s => [s.sowDate, (s.events || []).length, s.kept]),
    S.tasks.filter(t => t.kind === 'harvest' && t.done).length, Object.keys(S.tempHist || {}).length, S.containers.map(c => [c.sun, c.indoor])]);
  if (_learn && _learnKey === key) return _learn;
  _learnBusy = true;
  try { _learn = learnCompute(); _learnKey = key; } finally { _learnBusy = false; }
  return _learn;
}
function learnCompute() {
  const out = {}, add = (id, k, r, what) => { if (!(r > 0.2 && r < 5)) return; ((out[id] = out[id] || {})[k] = out[id][k] || []).push({ r, what }); };
  for (const p of S.plantings) {
    if (!p.sowDate) continue;
    const cr = crop(p.cropId), tf = tempFor(p.containerId), lbl = `${shortDate(p.sowDate)}${container(p.containerId) ? ' · ' + container(p.containerId).name : ''}`;
    if (p.method === 'seed' && p.germ && p.germ.date && p.germ.result !== 'none') {
      const gw = germWindow(Object.assign({}, p, { method: 'seed' }));
      if (gw) { const exp = daysBetween(p.sowDate, gw[0]) + daysBetween(gw[0], gw[1]) / 2, act = daysBetween(p.sowDate, p.germ.date); if (exp > 0) add(p.cropId, 'germ', act / exp, lbl); }
    }
    if (p.method === 'seed' && p.thinned && p.thinDoneOn && cr.daysThin) {
      const e = emergeDate(p).d, g = growParams(p.cropId), need = Math.max(5, cr.daysThin - germAvg(p.cropId)) * (g.tref - g.tb);
      add(p.cropId, 'thin', ddBetween(e, p.thinDoneOn, p.cropId, tf) / need, lbl);
    }
    const firstPick = [...(p.harvests || []).map(h => h.date), ...S.tasks.filter(t => t.plantingId === p.id && t.kind === 'harvest' && t.done).map(t => t.doneOn)].filter(Boolean).sort()[0];
    if (firstPick && cr.daysHarvest) { const h = harvestModel(p, true); if (h && h.need > 0) add(p.cropId, 'harvest', ddBetween(h.from, firstPick, p.cropId, tf) / h.need, lbl); }
  }
  for (const s of S.starts || []) {
    const outEv = (s.events || []).filter(e => e.type === 'out').map(e => e.date).sort()[0];
    if (!outEv) continue;
    const g = growParams(s.cropId), need = Math.max(5, tpDays(s.cropId) - germAvg(s.cropId)) * (g.tref - g.tb), boost = keptBoost(s), daily = S.weather && S.weather.daily;
    add(s.cropId, 'out', ddBetween(startEmerge(s), outEv, s.cropId, x => dayTemp(x, daily) + boost) / need, `tray sown ${shortDate(s.sowDate)}`);
  }
  return out;
}
function learnedFactor(id, kind) {
  const xs = ((learnSamples()[id] || {})[kind] || []).map(x => x.r).sort((a, b) => a - b);
  if (!xs.length) return 1;
  const med = xs.length % 2 ? xs[(xs.length - 1) / 2] : (xs[xs.length / 2 - 1] + xs[xs.length / 2]) / 2;
  return Math.max(0.6, Math.min(1.8, 1 + (med - 1) * xs.length / (xs.length + 2)));   // one record only nudges it
}
const KIND_EN = { germ: 'coming up', thin: 'thinning', out: 'plant-out', harvest: 'first harvest' };
function learnedText(id, kind) {
  const n = ((learnSamples()[id] || {})[kind] || []).length, f = learnedFactor(id, kind);
  if (!n || Math.abs(f - 1) < 0.03) return '';
  return `${Math.round(Math.abs(f - 1) * 100)}% ${f > 1 ? 'slower' : 'faster'} than the model (${n} record${n > 1 ? 's' : ''})`;
}
function learnSection() {
  const L = learnSamples(), rows = [];
  for (const id of Object.keys(L)) for (const k of Object.keys(L[id])) { const t = learnedText(id, k); if (t) rows.push(`<li>${ic(id)}<span class="grow"><b>${esc(crop(id).en)}</b> · ${KIND_EN[k]}<small>${t}</small></span></li>`); }
  return `<section><h3>Learned from your garden</h3>${rows.length ? `<ul class="plist">${rows.join('')}</ul>` : ''}
    <p class="hint">Each time you record germination, thinning, planting out or a first harvest, the app compares it with its estimate and adjusts future dates for that crop. One record only nudges it; several move it properly.${rows.length ? '' : ' Nothing to adjust yet.'}</p></section>`;
}
