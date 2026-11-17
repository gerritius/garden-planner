/* Harvest windows: packet days (e.g. 55–80), main harvest, and how long the crop keeps in the ground at the temperatures it will get. */
'use strict';

function packetDays(p) {
  const cr = crop(p.cropId), a = +p.daysFrom || cr.daysHarvest || 0;
  const b = +p.daysTo || Math.round(a * 1.3);
  return [a, Math.max(a, b)];
}
// days the crop stays good once mature: catalogue days in mild weather; cold slows ageing (roots and brassicas hold for weeks), but ends tender crops
function keepsUntil(p, mature) {
  const cr = crop(p.cropId), tf = tempFor(p.containerId), daily = S.weather && S.weather.daily, T = tf || (x => dayTemp(x, daily));
  let units = cr.win || 14, d = mature;
  for (let i = 0; i < 240 && units > 0; i++) {
    d = addDays(d, 1); const t = T(d);
    units -= cr.tender ? (t >= 15 ? 1 : t >= 10 ? 1.5 : 4) : (t >= 15 ? 1 : t >= 10 ? 0.6 : t >= 5 ? 0.4 : 0.3);
  }
  return d;
}
function harvestWindow(p) {
  if (!p.harvestDate) return null;
  const cr = crop(p.cropId), [a, b] = packetDays(p), m = harvestModel(p), g = growParams(p.cropId);
  const rate = m && m.days ? m.need / m.days : g.tref - g.tb;
  const mature = b > a ? ddUntil(p.harvestDate, (b - a) * rate, p.cropId, tempFor(p.containerId)) : p.harvestDate;
  return { earliest: p.harvestDate, mature, keep: p.keepUntil || keepsUntil(p, mature), keepSet: !!p.keepUntil, a, b, late: cr.late, cont: !!cr.cont };
}
function harvestWindowText(p) {
  const w = harvestWindow(p); if (!w) return '';
  const td = todayStr();
  return `<p class="pickby${w.keep < td ? ' late' : ''}">${w.cont ? `Picking from <b>${shortDate(w.earliest)}</b>, in full swing by ~${shortDate(w.mature)}, season runs to about <b>${shortDate(w.keep)}</b>`
    : `Harvest window: from <b>${shortDate(w.earliest)}</b> · most ready by ~<b>${shortDate(w.mature)}</b> · keeps until about <b>${shortDate(w.keep)}</b>${w.keepSet ? ' (your date)' : ''}`}${w.late ? ` — after that ${esc(w.late)}` : ''}. <small class="muted">Packet: ${w.a}${w.b > w.a ? '–' + w.b : ''} days${w.b > w.a ? '' : ' (add the range in Edit)'}.</small></p>`;
}
