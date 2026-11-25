// Soil: meter readings (pH, salt, moisture, temperature) and everything they change, lime amounts, soil temperature for
// sowing, and fertility left by the last crop.

import { potVolume } from '../climate/climate.js';
import { A, render } from '../core/router.js';
import { S, save } from '../core/state.js';
import { modal } from '../core/ui.js';
import { addDays, daysBetween, esc, num, shortDate, todayStr, uid } from '../core/util.js';
import { Draw } from '../draw.js';
import { areaOf } from '../feeding/nutrients.js';
import { crop, kin } from '../plants/crops.js';
import { pickRole } from '../products/library.js';
import { activeIn } from './garden.js';
import { lastCropIn } from './rotation.js';
import { FEED, LIME_M2, NO_FRESH_COMPOST, PH_RANGE, SOIL_T } from '../data/catalog.js';

// ---------- meter readings ----------
export const phRange = id => PH_RANGE[kin(id)] || [6.0, 6.5];
// the space as m² of bed: a bed section's area; for a pot, its soil volume (about 150 L of mix ≈ 1 m² of dug bed)
export function soilM2(c, from, to) {
  if (c.type === 'bed') { const L = Draw.dims(c).L; return Draw.dims(c).W * ((to ?? L) - (from ?? 0)) / 1e4; }
  return Math.max(areaOf(c), (potVolume(c) || 40) / 150);
}
export const gramsFor = (perM2, c, from, to) => { if (!(perM2 > 0)) return 0; const g = perM2 * soilM2(c, from, to); return g >= 20 ? Math.round(g / 5) * 5 : Math.max(1, Math.round(g)); };
const spaceName = c => c.type === 'bed' ? 'this section' : `this ${c.type === 'round' ? 'pot' : 'container'} (~${Math.round(potVolume(c) || 40)} L)`;
// lime for a crop in this space, in g/m²: the crop's usual rate, more if a reading shows the soil too acid, none if it's already high
export function limeRate(cropId, ph) {
  const usual = cropId ? (LIME_M2[kin(cropId)] ?? (['brassica', 'legume'].includes(crop(cropId).family) ? 150 : 100)) : 100;
  if (ph == null) return usual;
  const [lo, hi] = cropId ? phRange(cropId) : [6.0, 6.5];
  if (ph >= hi - 0.1) return 0;                                                        // at the top of its range or above: no lime
  if (ph < lo - 0.25) return Math.max(usual, Math.min(300, Math.round((lo + 0.2 - ph) * 200 / 10) * 10));   // too acid: enough to correct it
  return Math.round(usual / 2 / 10) * 10;                                               // in range: a light top-up only
}
const salToUS = (v, u) => v == null || v === '' ? null : u === 'ms' ? v * 1000 : u === 'ppm' ? v * 2 : u === 'lvl' ? null : +v;
function readingsOf(c, from, to) {
  return (c.soil || []).filter(r => from == null || (r.from < to - 0.5 && r.to > from + 0.5)).sort((a, b) => (a.date < b.date ? 1 : -1));
}
export function latestReading(c, from, to, maxAge = 150) { const r = readingsOf(c, from, to)[0]; return r && daysBetween(r.date, todayStr()) <= maxAge ? r : null; }
const MOIST = ['DRY+', 'DRY', 'NOR', 'WET', 'WET+'];
export function readingDialog(c, r) {
  const isNew = !r, td = todayStr(), L = Draw.dims(c).L;
  r = r || { id: uid(), date: td, from: 0, to: L, ph: null, temp: null, salt: '', moistLvl: '', note: '' };
  const secs = activeIn(c.id).map(p => [p.from, p.to, crop(p.cropId).en]);
  const phs = []; for (let v = 4; v <= 8.01; v += 0.5) phs.push(v.toFixed(1));
  const seg = (name, opts, cur) => `<div class="seg wrap" data-seg="${name}">${opts.map(o => `<button type="button" data-v="${o}" class="${cur === o ? 'on' : ''}">${o}</button>`).join('')}</div>`;
  modal(`<h3>${isNew ? 'Soil reading' : 'Edit reading'} — ${esc(c.name)}</h3><form id="srf" class="form">
      ${c.type !== 'round' && secs.length ? `<div class="sowchips">${[[0, L, 'Whole bed'], ...secs].map(([a, b, l]) => `<button type="button" class="chip${r.from === a && r.to === b ? ' on' : ''}" data-sec="${a},${b}">${esc(l)}</button>`).join('')}</div>` : ''}
      <label>pH</label>${seg('ph', phs, r.ph != null ? (+r.ph).toFixed(1) : '')}
      <label>Moisture</label>${seg('moistLvl', MOIST, r.moistLvl || '')}
      <label>Salt</label>${seg('salt', ['NOR', 'DANGER'], r.salt || '')}
      <div class="two"><label>Soil temperature (°C)<input name="temp" type="number" inputmode="decimal" min="0" max="45" value="${r.temp ?? ''}"></label><label>Date<input name="date" type="date" value="${r.date}" max="${td}"></label></div>
      <label>Note<input name="note" value="${esc(r.note || '')}"></label>
      <p class="hint">Push the probe 5–10 cm into the soil and let it settle; take 2–3 readings and use the middle one. Tap a value again to clear it. (Light isn’t worth recording — it changes minute to minute.)</p>
      <div class="btns">${isNew ? '<button type="button" class="btn" data-x="no">Cancel</button>' : '<button type="button" class="btn danger" data-x="del">Delete</button>'}<button class="btn primary">Save</button></div></form>`, (m, close) => {
    const f = m.querySelector('#srf'), v = { ph: r.ph != null ? (+r.ph).toFixed(1) : '', moistLvl: r.moistLvl || '', salt: r.salt || '' };
    m.querySelectorAll('[data-seg]').forEach(g => g.querySelectorAll('button').forEach(b => b.onclick = () => { const k = g.dataset.seg; v[k] = v[k] === b.dataset.v ? '' : b.dataset.v; g.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.v === v[k])); }));
    m.querySelectorAll('[data-sec]').forEach(b => b.onclick = () => { const [a, z] = b.dataset.sec.split(',').map(Number); r.from = a; r.to = z; m.querySelectorAll('[data-sec]').forEach(x => x.classList.toggle('on', x === b)); });
    const no = m.querySelector('[data-x=no]'); if (no) no.onclick = close;
    const del = m.querySelector('[data-x=del]'); if (del) del.onclick = async () => { c.soil = c.soil.filter(x => x.id !== r.id); await save(); close(); render(); };
    f.onsubmit = async e => {
      e.preventDefault();
      Object.assign(r, { date: f.date.value || td, ph: v.ph ? +v.ph : null, moistLvl: v.moistLvl, salt: v.salt, temp: num(f.temp.value), note: f.note.value.trim() });
      delete r.sal; delete r.moist;
      if (c.type === 'round') { r.from = 0; r.to = L; }
      if (isNew) (c.soil = c.soil || []).push(r);
      await save(); close(); render();
    };
  });
}
export function readingText(r) {
  return [r.ph != null ? `pH ${(+r.ph).toFixed(1)}` : '', r.moistLvl ? `moisture ${r.moistLvl}` : r.moist != null ? `moisture ${r.moist}` : '', r.salt ? `salt ${r.salt}` : r.sal != null ? `salinity ${r.sal}` : '', r.temp != null ? `${r.temp}°C` : ''].filter(Boolean).join(' · ');
}
// advice from the latest reading for a crop
export function soilReadingAdvice(c, from, to, cropId) {
  const r = latestReading(c, from, to); if (!r) return null;
  const out = { r, lime: 1, feed: 1, bits: [] };
  if (r.ph != null && cropId) {
    const [lo, hi] = phRange(cropId), n = crop(cropId).en;
    if (r.ph < lo - 0.25) { const rate = limeRate(cropId, r.ph), g = gramsFor(rate, c, from, to); out.lime = rate / limeRate(cropId, null); out.bits.push(`pH ${r.ph} is acid for ${n} (best ${lo}–${hi}): mix about ${g} g of oyster shell lime into ${spaceName(c)}${c.type === 'bed' ? ` (${rate} g/m²)` : ''}${cropId === 'hakusai' || crop(cropId).family === 'brassica' ? ' — acid soil also encourages clubroot' : ''}.`); }
    else if (r.ph >= hi - 0.1) { out.lime = 0; if (r.ph <= hi + 0.25) { out.bits.push(`pH ${r.ph} is at the top of ${n}’s range (${lo}–${hi}): no lime needed.`); return out; } out.bits.push(`pH ${r.ph} is already above ${n}’s range (${lo}–${hi}): skip the lime${r.ph > 7.2 ? '; compost and sulphur-free organic feeds will bring it down slowly' : ''}.`); }
    else out.bits.push(`pH ${r.ph} suits ${n} (${lo}–${hi}).`);
  }
  if (r.salt === 'DANGER') { out.feed = 0.5; out.bits.push('Salt reads DANGER: there’s too much fertiliser in the soil — hold off feeding, halve any base fertiliser, and water through well. Salty soil scorches roots and seedlings.'); }
  else if (r.salt == null && r.sal != null) { const us = salToUS(r.sal, r.salu); if (us != null && us > 1500) { out.feed = 0.5; out.bits.push('Salinity is high — hold off feeding and water through.'); } }
  return out.bits.length ? out : null;
}
export function soilSection(c) {
  const rs = readingsOf(c).slice(0, 8);
  A.addReading = () => readingDialog(c);
  A.editReading = el => readingDialog(c, (c.soil || []).find(r => r.id === el.dataset.id));
  const L = Draw.dims(c).L;
  return `<section><h3>Soil readings</h3>
    ${rs.length ? `<ul class="plist">${rs.map(r => `<li data-act="editReading" data-id="${r.id}"><span class="lic">🧪</span><span class="grow"><b>${esc(readingText(r)) || 'Reading'}</b><small>${shortDate(r.date)}${r.from > 0 || r.to < L ? ` · ${r.from}–${r.to} cm` : ''}${r.note ? ' · ' + esc(r.note) : ''}</small></span><span class="muted">✎</span></li>`).join('')}</ul>` : '<p class="muted">No readings yet — pH, salinity and moisture from your meter.</p>'}
    <button class="btn small" data-act="addReading">＋ Add reading</button></section>`;
}
// today's moisture readings for the watering dialog
export function moistureToday() {
  const td = todayStr(), out = [];
  for (const c of S.containers) { const r = (c.soil || []).find(x => x.date === td && (x.moistLvl || x.moist != null)); if (r) out.push(`${c.name} ${r.moistLvl || r.moist}`); }
  return out;
}
// today's meter moisture for the bags (used by the watering reminder)
export function bagMoistureToday(pots) {
  const td = todayStr(), lv = pots.map(c => { const r = (c.soil || []).filter(x => x.date === td && x.moistLvl).pop(); return r ? r.moistLvl : null; }).filter(Boolean);
  return { any: lv.length, dry: lv.filter(x => x.startsWith('DRY')).length, wet: lv.filter(x => x.startsWith('WET')).length, all: lv.length === pots.length };
}

// ---------- soil fertility from the last crop ----------
export const FEED_LABEL = { heavy: 'heavy feeder', medium: 'medium feeder', light: 'light feeder', legume: 'legume (adds nitrogen)' };
export const feedOf = (cropId, h) => (h && h.feed) || FEED[kin(cropId)] || (crop(cropId).family === 'legume' ? 'legume' : crop(cropId).feed) || '';
// returns { level: 'warn'|'note', text, base: multiplier for base fertiliser, compost: multiplier } or null
export function soilAdvice(c, from, to, nextCropId, beforeDate, excludeId) {
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

// ---------- soil temperature for sowing ----------
// soil °C at ~6 cm for coming up: [minimum, comfortable from, too warm above] — each crop's soilT, in its record (data/crops.js)
export function soilTemps() {
  const h = S.weather && S.weather.hourly; if (!h || !h.soil_temperature_6cm) return null;
  const td = todayStr(), by = {};
  h.time.forEach((t, i) => { const d = t.slice(0, 10), v = h.soil_temperature_6cm[i]; if (v == null || d < addDays(td, -3) || d > addDays(td, 6)) return; (by[d] = by[d] || []).push(v); });
  const days = Object.keys(by).sort().map(d => ({ d, mean: by[d].reduce((a, b) => a + b, 0) / by[d].length }));
  const week = days.filter(x => x.d >= td);
  return days.length ? { days, now: (days.find(x => x.d === td) || days[days.length - 1]).mean, week: week.length ? week.reduce((a, b) => a + b.mean, 0) / week.length : null } : null;
}
export function soilVerdict(cropId, t) {
  const r = SOIL_T[kin(cropId)]; if (!r || t == null) return null;
  const v = Math.round(t);
  if (t < r[0]) return { ok: 0, txt: `too cold to sow (soil ~${v}°, needs ${r[0]}°+)` };
  if (r[2] && t > r[2]) return { ok: 1, txt: `soil warm (~${v}°) — germination can be patchy above ${r[2]}°; sow in the cool of evening and keep moist` };
  if (t < r[1]) return { ok: 1, txt: `soil cool (~${v}°) — slow to come up (best ${r[1]}°+)` };
  return { ok: 2, txt: `soil ~${v}° — good for sowing` };
}
export function soilBadge(cropId) {
  const st = soilTemps(); if (!st) return '';
  const v = soilVerdict(cropId, st.week ?? st.now); if (!v) return '';
  return `<small class="soilb s${v.ok}">${v.ok === 0 ? '❄' : v.ok === 1 ? '◐' : '✓'}</small>`;
}

// ---------- soil temperature for one bed / pot ----------
// The forecast gives the garden's soil at 6 cm; your meter shows how this bed or pot differs (sun, shade, a black bag…).
// Readings in the last 30 days give that difference; a reading from the last 3 days also sets "now".
export function soilTempFor(c, from, to) {
  const st = soilTemps(), td = todayStr();
  const rs = c ? readingsOf(c, from, to).filter(r => r.temp != null && daysBetween(r.date, td) <= 30) : [];
  if (!rs.length) return st ? { now: st.now, week: st.week, src: 'forecast' } : null;
  const fc = d => { const x = st && st.days.find(y => y.d === d); return x ? x.mean : null; };
  const offs = rs.map(r => { const f = fc(r.date); return f == null ? null : r.temp - f; }).filter(v => v != null);
  const off = offs.length ? offs.reduce((a, b) => a + b, 0) / offs.length : 0;
  const latest = rs[0], fresh = daysBetween(latest.date, td) <= 3;
  if (!st) return fresh ? { now: latest.temp, week: latest.temp, src: 'meter', date: latest.date } : null;
  const week = st.week != null ? st.week + off : null;
  return { now: fresh ? latest.temp : st.now + off, week, src: 'meter', date: latest.date, off };
}
// the planting form's sowing line, for this bed / pot
export function soilLine(cropId, method, c, from, to) {
  if (method && method !== 'seed') return '';
  const st = c ? soilTempFor(c, from, to) : soilTemps(); if (!st) return '';
  const v = soilVerdict(cropId, st.week ?? st.now); if (!v) return '';
  const src = st.src === 'meter' ? ` <small>(your meter, ${shortDate(st.date)}${st.off != null && Math.abs(st.off) >= 1 ? ` — ${st.off > 0 ? 'warmer' : 'cooler'} than the forecast by ~${Math.abs(Math.round(st.off))}°` : ''})</small>` : '';
  return `<p class="hint soil s${v.ok}">🌡 This week: ${esc(v.txt)}.${src}</p>`;
}

// ---------- bed prep and lime ----------
export function prepDialog(c) {
  const a = soilM2(c), g = r => gramsFor(r, c), rd = latestReading(c);
  const sa = soilAdvice(c, 0, Draw.dims(c).L, null), bm = sa ? sa.base : 1, cm = sa ? sa.compost : 1;
  const comp = pickRole('compost'), lime = pickRole('lime'), base = pickRole('base', c.type === 'bed' ? 'slow' : 'quick');
  const items = [
    ['compost', `Dig in ${comp ? comp.en : 'compost'} ~${Math.max(1, Math.round(a * 2 * cm * 2) / 2)} kg`, comp ? -Math.max(comp.wait, 7) : -14, true],
    ...(g(limeRate(null, rd ? rd.ph : null)) > 0 ? [['lime', `Spread ${lime ? lime.en : 'garden lime'} ~${g(limeRate(null, rd ? rd.ph : null))} g${rd && rd.ph != null ? ` (your pH reading: ${rd.ph})` : ''}`, lime ? 0 : -14, true]] : []),
    ['base', `Base fertiliser: ${base ? base.en : 'a base fertiliser'} ~${g(150 * bm)} g`, base ? -base.wait : -7, true],
    ['ridge', 'Dig & shape the bed', -1, c.type === 'bed'],
    ['mulch', 'Lay mulch film', -1, false],
  ];
  modal(`<h3>Prepare ${esc(c.name)}</h3><p class="muted small">${c.type === 'bed' ? `${a.toFixed(2)} m²` : `~${Math.round(potVolume(c) || 40)} L of soil`} · amounts are typical rates for this much soil — adjust to your products.</p>${sa ? `<p class="msg small">🪱 ${sa.text}${bm !== 1 || cm !== 1 ? ' Amounts below are adjusted.' : ''}</p>` : ''}
    <form id="pf2" class="form"><label>Planting date<input type="date" name="plant" value="${addDays(todayStr(), 14)}"></label>
      ${items.map(([k, l, off, on]) => `<label class="inl chkline"><input type="checkbox" name="${k}" ${on ? 'checked' : ''}> <span>${l} <small>(${off === 0 ? 'on planting day — can go in straight away' : -off === 1 ? 'the day before' : -off + ' days before'})</small></span></label>`).join('')}
      <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary">Add jobs</button></div></form>`, (m, close) => {
    m.querySelector('[data-x=no]').onclick = close;
    m.querySelector('#pf2').onsubmit = async e => {
      e.preventDefault(); const f = e.target, pl = f.plant.value || todayStr();
      for (const [k, l, off] of items) if (f[k].checked) S.tasks.push({ id: uid(), containerId: c.id, plantingId: null, kind: 'bed', title: l, due: addDays(pl, off) < todayStr() ? todayStr() : addDays(pl, off), done: false });
      await save(); close(); render();
    };
  });
}
export { SOIL_T };   // (from the crop records)
