/* Feeding balance (rough N-P-K given vs what the crop needs) and soil meter readings (pH, salinity, moisture). */
'use strict';

// =====================================================================
// Feeding balance
// =====================================================================
// % N-P-K (approx.) and the share of N plants can use this season. Composts release most N slowly.
const NPK = {
  bokashi: [4, 4, 2, 0.7], toshoAburakasu: [3, 3, 2, 0.75], aburakasu: [5, 2, 1, 0.7], chickenManure: [3, 5, 3, 0.6], neem: [4, 1, 1, 0.5],
  cowCompost: [0.7, 0.7, 0.7, 0.1], cowHuskCompost: [0.6, 0.7, 0.8, 0.1], barkCompost: [0.5, 0.3, 0.3, 0.05], oysterLime: [0, 0, 0, 0],
};
// typical nitrogen for the whole crop, g per m² (= kg/10a in Japanese 施肥基準), incl. side-dressing
const N_NEED = {
  hakusai: 25, cabbage: 25, broccoli: 22, cauliflower: 22, daikon: 12, carrot: 12, komatsuna: 12, chingensai: 12, mizuna: 12, kabu: 12, hatsuka: 6,
  spinach: 15, lettuce: 12, shungiku: 15, celery: 35, tomato: 22, minitomato: 22, nasu: 30, piman: 28, shishito: 28, chilli: 25, kyuri: 28, zucchini: 20,
  potato: 10, satsumaimo: 3, satoimo: 20, edamame: 3, ingen: 8, snappea: 8, sayaendo: 8, soramame: 10, onion: 22, naganegi: 25, hatamanegi: 15, garlic: 20,
  corn: 22, strawberry: 20, nanohana: 18,
};
function npkOf(name) {
  const pr = productByName(name || ''); if (pr && NPK[pr.id]) return NPK[pr.id];
  const m = String(name || '').match(/(\d{1,2})\s*[-‐–・]\s*(\d{1,2})\s*[-‐–・]\s*(\d{1,2})/);   // e.g. 化成肥料 8-8-8
  return m ? [+m[1], +m[2], +m[3], 1] : null;
}
function gramsOf(amount, unit, name) {
  const a = +amount; if (!(a > 0)) return 0;
  if (unit === 'kg') return a * 1000;
  if (unit === 'handful') return a * HANDFUL_G;
  if (unit === 'L') { const pr = productByName(name || ''); return pr && pr.kind === 'compost' ? a * 500 : 0; }   // compost ~0.5 kg per litre
  if (unit === 'mL') return 0;   // liquid feeds: too dilute to matter here
  return a;
}
const areaOf = (c, p) => c.type === 'bed' ? (p ? Draw.dims(c).W * (p.to - p.from) / 1e4 : Draw.dims(c).W * Draw.dims(c).L / 1e4) : (c.type === 'round' ? Math.PI * (c.diameter / 200) ** 2 : c.width * c.length / 1e4);
// everything fed to this planting since 30 days before sowing
function feedingOf(p) {
  const c = container(p.containerId); if (!c || !p.sowDate) return null;
  const from = addDays(p.sowDate, -30), secA = areaOf(c, p), bedA = areaOf(c), items = [];
  const add = (name, g, a, date) => { if (!(g > 0) || !(a > 0)) return; const npk = npkOf(name); items.push({ name, g, perM2: g / a, npk, date }); };
  for (const f of p.fert || []) add(f.product, gramsOf(f.amount, f.unit, f.product), secA, p.sowDate);
  for (const e of S.log || []) {
    if (!['fert', 'soil'].includes(e.kind) || !e.product || e.date < from || e.date > todayStr()) continue;
    const pids = e.pids || [], cids = e.cids || [], n = pids.length + cids.length || 1, g = gramsOf(e.amount, e.unit, e.product) / (e.per === 'total' ? n : 1);
    if (pids.includes(p.id)) add(e.product, g, secA, e.date);
    else if (cids.includes(c.id)) add(e.product, g, bedA, e.date);
  }
  for (const s of p.series || []) {
    if (!s.product || s.amount == null) continue;
    for (const t of S.tasks) if (t.seriesId === s.id && t.done && t.doneOn) add(s.product, gramsOf(s.amount, s.unit, s.product), secA, t.doneOn);
  }
  const tot = [0, 0, 0], unknown = [];
  for (const it of items) { if (!it.npk) { unknown.push(it.name); continue; } tot[0] += it.perM2 * it.npk[0] / 100 * it.npk[3]; tot[1] += it.perM2 * it.npk[1] / 100; tot[2] += it.perM2 * it.npk[2] / 100; }
  return { items, n: tot[0], p: tot[1], k: tot[2], unknown: [...new Set(unknown)], need: N_NEED[p.cropId] || null, bag: c.type !== 'bed' };
}
function feedingRow(p) {
  const f = feedingOf(p); if (!f || !f.items.length) return null;
  const r = f.need ? f.n / f.need : null, c = container(p.containerId), sr = soilReadingAdvice(c, p.from, p.to, p.cropId);
  const verdict = sr && sr.feed < 1 ? ' — but your meter shows <b>high salinity</b>, so hold off feeding and water through' : r == null ? '' : r < 0.4 ? ' — <b>well short</b>; plan side-dressing' : r < 0.75 ? ' — on the light side; side-dress as it grows' : r <= 1.3 ? ' — about right' : r <= 1.8 ? ' — generous; skip the next side-dressing' : ' — <b>a lot</b>; hold off feeding (risk of soft, pest-prone growth)';
  return ['Fed so far', `~${f.n.toFixed(1)} g usable nitrogen per m²${f.need ? ` of ~${f.need} typical for the season` : ''}${verdict} <small class="muted">(rough: from your products’ analyses; compost N mostly releases over later seasons${f.unknown.length ? `; not counted: ${esc(f.unknown.join(', '))}` : ''})</small>`];
}

// =====================================================================
// Soil meter readings
// =====================================================================
const PH_RANGE = {
  spinach: [6.5, 7.2], snappea: [6.2, 7.0], sayaendo: [6.2, 7.0], onion: [6.0, 6.8], naganegi: [6.0, 6.8], hatamanegi: [6.0, 6.8], garlic: [6.0, 6.8],
  potato: [5.0, 6.0], satsumaimo: [5.5, 6.2], daikon: [5.5, 6.5], carrot: [5.5, 6.5], kyuri: [5.5, 6.5], ingen: [5.5, 6.5], corn: [5.5, 6.5], strawberry: [5.5, 6.5], satoimo: [5.5, 6.5],
};
const phRange = id => PH_RANGE[id] || [6.0, 6.5];
const SAL_UNITS = [['us', 'µS/cm'], ['ms', 'mS/cm'], ['ppm', 'ppm'], ['lvl', 'meter scale']];
const MOIST_UNITS = [['pct', '%'], ['lvl', '1–10 scale']];
const salToUS = (v, u) => v == null || v === '' ? null : u === 'ms' ? v * 1000 : u === 'ppm' ? v * 2 : u === 'lvl' ? null : +v;
function readingsOf(c, from, to) {
  return (c.soil || []).filter(r => from == null || (r.from < to - 0.5 && r.to > from + 0.5)).sort((a, b) => (a.date < b.date ? 1 : -1));
}
function latestReading(c, from, to, maxAge = 150) { const r = readingsOf(c, from, to)[0]; return r && daysBetween(r.date, todayStr()) <= maxAge ? r : null; }
function readingDialog(c, r) {
  const isNew = !r, td = todayStr(), L = Draw.dims(c).L, mu = S.meter || { sal: 'us', moist: 'pct' };
  r = r || { id: uid(), date: td, from: 0, to: L, ph: '', sal: '', moist: '', note: '' };
  const secs = activeIn(c.id).map(p => [p.from, p.to, crop(p.cropId).en]);
  modal(`<h3>${isNew ? 'Soil reading' : 'Edit reading'} — ${esc(c.name)}</h3><form id="srf" class="form">
      ${c.type !== 'round' && secs.length ? `<div class="sowchips">${[[0, L, 'Whole bed'], ...secs].map(([a, b, l]) => `<button type="button" class="chip${r.from === a && r.to === b ? ' on' : ''}" data-sec="${a},${b}">${esc(l)}</button>`).join('')}</div>` : ''}
      <div class="two"><label>pH<input name="ph" type="number" inputmode="decimal" step="0.1" min="3" max="9" value="${r.ph ?? ''}"></label><label>Date<input name="date" type="date" value="${r.date}" max="${td}"></label></div>
      <div class="two"><label>Salinity<input name="sal" type="number" inputmode="decimal" step="any" value="${r.sal ?? ''}"></label><label>Unit<select name="salu">${SAL_UNITS.map(([k, l]) => `<option value="${k}"${(r.salu || mu.sal) === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <div class="two"><label>Moisture<input name="moist" type="number" inputmode="decimal" step="any" value="${r.moist ?? ''}"></label><label>Unit<select name="moistu">${MOIST_UNITS.map(([k, l]) => `<option value="${k}"${(r.moistu || mu.moist) === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <label>Note<input name="note" value="${esc(r.note || '')}"></label>
      <p class="hint">Push the probe 5–10 cm into moist (not bone-dry) soil and wait for it to settle; take 2–3 readings and use the middle one. Cheap meters drift — trends matter more than exact numbers.</p>
      <div class="btns">${isNew ? '<button type="button" class="btn" data-x="no">Cancel</button>' : '<button type="button" class="btn danger" data-x="del">Delete</button>'}<button class="btn primary">Save</button></div></form>`, (m, close) => {
    const f = m.querySelector('#srf');
    m.querySelectorAll('[data-sec]').forEach(b => b.onclick = () => { const [a, z] = b.dataset.sec.split(',').map(Number); r.from = a; r.to = z; m.querySelectorAll('[data-sec]').forEach(x => x.classList.toggle('on', x === b)); });
    const no = m.querySelector('[data-x=no]'); if (no) no.onclick = close;
    const del = m.querySelector('[data-x=del]'); if (del) del.onclick = async () => { c.soil = c.soil.filter(x => x.id !== r.id); await save(); close(); render(); };
    f.onsubmit = async e => {
      e.preventDefault();
      Object.assign(r, { date: f.date.value || td, ph: num(f.ph.value), sal: num(f.sal.value), salu: f.salu.value, moist: num(f.moist.value), moistu: f.moistu.value, note: f.note.value.trim() });
      if (c.type === 'round') { r.from = 0; r.to = L; }
      S.meter = { sal: f.salu.value, moist: f.moistu.value };
      if (isNew) (c.soil = c.soil || []).push(r);
      await save(); close(); render();
    };
  });
}
function readingText(r) {
  const su = (SAL_UNITS.find(x => x[0] === r.salu) || SAL_UNITS[0])[1], mu = r.moistu === 'lvl' ? '/10' : '%';
  return [r.ph != null ? `pH ${r.ph}` : '', r.sal != null ? `salinity ${r.sal} ${su}` : '', r.moist != null ? `moisture ${r.moist}${mu}` : ''].filter(Boolean).join(' · ');
}
// advice from the latest reading for a crop
function soilReadingAdvice(c, from, to, cropId) {
  const r = latestReading(c, from, to); if (!r) return null;
  const out = { r, lime: 1, feed: 1, bits: [] };
  if (r.ph != null && cropId) {
    const [lo, hi] = phRange(cropId), n = crop(cropId).en;
    if (r.ph < lo - 0.05) { const g = Math.round(Math.min(300, (lo + 0.2 - r.ph) * 200) / 10) * 10; out.lime = 1 + (lo - r.ph) * 1.5; out.bits.push(`pH ${r.ph} is acid for ${n} (best ${lo}–${hi}): mix in about ${g} g/m² oyster shell lime${cropId === 'hakusai' || crop(cropId).family === 'brassica' ? ' — acid soil also encourages clubroot' : ''}.`); }
    else if (r.ph > hi + 0.05) { out.lime = 0; out.bits.push(`pH ${r.ph} is already above ${n}’s range (${lo}–${hi}): skip the lime${r.ph > 7.2 ? '; compost and sulphur-free organic feeds will bring it down slowly' : ''}.`); }
    else out.bits.push(`pH ${r.ph} suits ${n} (${lo}–${hi}).`);
  }
  const us = salToUS(r.sal, r.salu);
  if (us != null) {
    if (us > 1500) { out.feed = 0.5; out.bits.push(`Salinity is high (${r.sal} ${(SAL_UNITS.find(x => x[0] === r.salu) || SAL_UNITS[0])[1]}): too much fertiliser in the soil — halve the base feed and water through well. Roots and seedlings scorch in salty soil.`); }
    else if (us > 900) { out.feed = 0.8; out.bits.push('Salinity is on the high side — go a bit lighter on fertiliser.'); }
    else if (us < 150) out.bits.push('Salinity is very low — the soil may be short of nutrients.');
  }
  return out.bits.length ? out : null;
}
function soilSection(c) {
  const rs = readingsOf(c).slice(0, 8);
  A.addReading = () => readingDialog(c);
  A.editReading = el => readingDialog(c, (c.soil || []).find(r => r.id === el.dataset.id));
  const L = Draw.dims(c).L;
  return `<section><h3>Soil readings</h3>
    ${rs.length ? `<ul class="plist">${rs.map(r => `<li data-act="editReading" data-id="${r.id}"><span class="lic">🧪</span><span class="grow"><b>${esc(readingText(r)) || 'Reading'}</b><small>${shortDate(r.date)}${r.from > 0 || r.to < L ? ` · ${r.from}–${r.to} cm` : ''}${r.note ? ' · ' + esc(r.note) : ''}</small></span><span class="muted">✎</span></li>`).join('')}</ul>` : '<p class="muted">No readings yet — pH, salinity and moisture from your meter.</p>'}
    <button class="btn small" data-act="addReading">＋ Add reading</button></section>`;
}
// today's moisture readings for the watering dialog
function moistureToday() {
  const td = todayStr(), out = [];
  for (const c of S.containers) { const r = (c.soil || []).find(x => x.date === td && x.moist != null); if (r) out.push(`${c.name} ${r.moist}${r.moistu === 'lvl' ? '/10' : '%'}`); }
  return out;
}
