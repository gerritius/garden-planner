/* Soil meter readings put to work: soil temperature per bed/pot (meter beats forecast), sprouting times,
   bed watering from DRY readings, pH and salt in the crop ideas, salt on the Feeding card. */
'use strict';

// ---------- soil temperature for one bed / pot ----------
// The forecast gives the garden's soil at 6 cm; your meter shows how this bed or pot differs (sun, shade, a black bag…).
// Readings in the last 30 days give that difference; a reading from the last 3 days also sets "now".
function soilTempFor(c, from, to) {
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
function soilLine(cropId, method, c, from, to) {
  if (method && method !== 'seed') return '';
  const st = c ? soilTempFor(c, from, to) : soilTemps(); if (!st) return '';
  const v = soilVerdict(cropId, st.week ?? st.now); if (!v) return '';
  const src = st.src === 'meter' ? ` <small>(your meter, ${shortDate(st.date)}${st.off != null && Math.abs(st.off) >= 1 ? ` — ${st.off > 0 ? 'warmer' : 'cooler'} than the forecast by ~${Math.abs(Math.round(st.off))}°` : ''})</small>` : '';
  return `<p class="hint soil s${v.ok}">🌡 This week: ${esc(v.txt)}.${src}</p>`;
}
// days to come up: catalogue days, stretched by how cold the soil is — from the meter / forecast for sowings around now,
// otherwise by the time of year as before
function germWindow(p) {
  const cr = crop(p.cropId);
  if (p.method !== 'seed' || !cr.germ || !p.sowDate) return null;
  const r = SOIL_T[p.cropId] || [5, 15], c = p.containerId && container(p.containerId);
  const slow = t => t >= r[1] ? 1 : t >= r[0] ? 1 + (r[1] - t) / Math.max(1, r[1] - r[0]) * 0.9 : 2.2;
  let f = c && c.indoor ? 1 : slow(normalT(p.sowDate) + 1);   // soil runs a little warmer than the air mean
  if (Math.abs(daysBetween(p.sowDate, todayStr())) <= 7 && !(c && c.indoor)) {
    const st = c ? soilTempFor(c, p.from, p.to) : soilTemps(), t = st && (st.week ?? st.now);
    if (t != null) f = slow(t);
  }
  return [addDays(p.sowDate, Math.round(cr.germ[0] * f)), addDays(p.sowDate, Math.round(cr.germ[1] * f))];
}

// ---------- beds: a DRY reading becomes a watering job (unless good rain is due) ----------
function syncMeterJobs() {
  const td = todayStr(), rain = typeof rainByDay === 'function' ? rainByDay() : {};
  const rainSoon = (rain[td] || 0) + (rain[addDays(td, 1)] || 0) >= 5;
  for (const c of S.containers) {
    if (c.type !== 'bed' || c.indoor) continue;
    const r = (c.soil || []).filter(x => x.date === td && x.moistLvl).pop();
    const open = S.tasks.find(t => t.meterWater && t.containerId === c.id && !t.done);
    const want = r && /^DRY/.test(r.moistLvl) && !rainSoon;
    if (want && !open) S.tasks.push({ id: uid(), kind: 'bed', containerId: c.id, plantingId: null, title: `Water ${c.name} — meter reads ${r.moistLvl}`, due: td, done: false, meterWater: true });
    else if (!want && open && open.due <= td) S.tasks = S.tasks.filter(t => t !== open);   // rain coming, or a newer reading says it's fine
  }
}

// ---------- pH and salt in the crop ideas ----------
function ideaSoilNotes(c, a, b, cropId) {
  const sr = soilReadingAdvice(c, a, b, cropId); if (!sr || sr.r.ph == null) return '';
  const [lo, hi] = phRange(cropId), ph = sr.r.ph;
  if (ph < lo - 0.25) return `<small>🧪 pH ${ph} is acid for it (best ${lo}–${hi}) — lime first</small>`;
  if (ph > hi + 0.25) return `<small>🧪 pH ${ph} is high for it (best ${lo}–${hi})</small>`;
  return '';
}
function ideaSoilBanner(c, a, b) {
  const r = latestReading(c, a, b); if (!r) return '';
  const bits = [];
  if (r.salt === 'DANGER') bits.push('⚠ Salt read <b>DANGER</b> — water through well (and skip base fertiliser) before planting.');
  const st = soilTempFor(c, a, b);
  if (st && st.src === 'meter') bits.push(`🌡 Soil here ~${Math.round(st.week ?? st.now)}° this week (from your meter).`);
  return bits.length ? `<p class="hint">${bits.join(' ')}</p>` : '';
}
// a direct sowing "now" when the soil is too cold to come up
function ideaColdSoil(c, a, b, cropId, o) {
  if (o.kind !== 'sow' || o.P > addDays(todayStr(), 7)) return '';
  const st = soilTempFor(c, a, b), v = st && soilVerdict(cropId, st.week ?? st.now);
  return v && v.ok === 0 ? `<small class="warn">❄ ${esc(v.txt)}${o.cover ? ' — the cover helps' : ''}</small>` : '';
}
