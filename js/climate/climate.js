// Climate from your location: the usual temperature and rainfall of each month and the frost dates there, from the
// app's own climate tiles (ERA5, 2016–2025). Until it's fetched (or with no location) the built-in western Tokyo values
// are used. Also growth speed from temperature, and the microclimate of each bed or pot (indoors, sun, size).

import { A, render } from '../core/router.js';
import { S, save } from '../core/state.js';
import { modal } from '../core/ui.js';
import { ui } from '../data/ui-icons.js';
import { $, addDays, daysBetween, esc, pd, shortDate, todayStr } from '../core/util.js';
import { _season } from '../feeding/stages.js';
import { container } from '../garden/garden.js';
import { _ideaCache } from '../garden/ideas.js';
import { _need, growParams, HEADING } from '../plants/growth.js';
import { climateTypePicker } from './presets.js';
import { applySowWindows, MONTHS } from './sowing.js';
import { kin } from '../plants/crops.js';

// ---------- usual temperature and rain for each month ----------
// Catalogue "days to thin" assume good growing weather (~18 °C for cool-season crops, ~24 °C for warm-season).
// Growth is counted in degree-days above a base temperature, so cold weeks add very little.
export const NORMAL_T = [5.2, 5.7, 8.7, 13.9, 18.2, 21.4, 25.0, 26.4, 22.8, 17.5, 12.1, 7.6];   // monthly mean, western Tokyo (approx.)
export function dayTemp(d, daily) {
  if (S.tempHist && S.tempHist[d] != null) return S.tempHist[d];
  const i = daily && daily.time ? daily.time.indexOf(d) : -1;
  if (i >= 0 && daily.temperature_2m_max[i] != null) return (daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2;
  return normalT(d);
}
export const warming = d => normalT(addDays(d, 30)) > normalT(d) + 1;   // spring-like: getting warmer over the next month
export function normalT(d) {   // smooth daily normal from monthly means
  const x = pd(d), m = x.getMonth(), f = (x.getDate() - 15) / 30, n = f >= 0 ? (m + 1) % 12 : (m + 11) % 12;
  return NORMAL_T[m] + (NORMAL_T[n] - NORMAL_T[m]) * Math.abs(f);
}
// unused nitrogen washes out with water passing through: pots with each watering (and rain if outdoors), beds mostly with rain
const RAIN_MONTH = [52, 56, 117, 125, 138, 168, 154, 168, 210, 198, 93, 51];   // normal mm per month, western Tokyo (approx.)
export const normalRain = d => { const x = pd(d); return RAIN_MONTH[x.getMonth()] / new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); };
// Tools → Weather location: what the climate is based on
export function climateSection() {
  A.climRefresh = async () => { const el = $('#climst'); if (el) el.textContent = 'Fetching…'; const ok = await ensureClimate(true); if (!ok && el) el.textContent = 'Couldn’t fetch it — are you online?'; };
  const c = climateHere(), t = NORMAL_T, rows = MONTHS.map((m, i) => `<span><i>${m[0]}</i>${Math.round(t[i])}°</span>`).join('');
  return `<section><h3>Climate</h3><p>Sowing months, growth and harvest estimates, frost and watering use the usual weather for <b>${esc(climateName())}</b>.</p>
    <div class="climrow">${rows}</div>${frostText() ? `<p class="small">❄ ${frostText()}</p>` : ''}
    ${!S.weather || S.weather.lat == null || climatePending() ? climateTypePicker() : ''}
    ${S.weather && S.weather.lat != null ? `<div class="btnrow"><button class="btn small" data-act="climRefresh">↻ ${c ? 'Refresh' : 'Get'} climate for ${esc(S.weather.name || 'my location')}</button></div><p class="small muted" id="climst"></p>` : '<p class="hint">Set your location above and the app looks up the usual temperatures, rainfall and frost dates there (records from 2016–2025).</p>'}</section>`;
}

// ---------- climate from your location ----------
export const TOKYO_T = NORMAL_T.slice(), TOKYO_RAIN = RAIN_MONTH.slice();
// the climate packet days are written for (central Japan, 中間地): what a crop's catalogue days are worth in growth
export function refNormalT(d) {
  const x = pd(d), m = x.getMonth(), f = (x.getDate() - 15) / 30, n = f >= 0 ? (m + 1) % 12 : (m + 11) % 12;
  return TOKYO_T[m] + (TOKYO_T[n] - TOKYO_T[m]) * Math.abs(f);
}
let _climKey = '', _climBusy = false, _climFailed = '';   // (a place whose fetch failed this visit is tried again with ↻, or next visit)
export function clearSeasonCaches() {
  for (const k in _need) delete _need[k];
  for (const k in _season) delete _season[k];
  _ideaCache.clear();
}
// South of the equator the seasons run six months apart: a southern garden's November is a northern May. For things
// written by month for Japan (pest seasons) and growing seasons that cross the new year there (the rotation plan).
export const southern = () => gardenLat() < 0;
export const tropical = () => Math.abs(gardenLat()) < 15;
export const seasonMonth = (m) => southern() ? (m + 5) % 12 + 1 : m;   // the month it's like up north
// the fetched climate, if it's for where the garden is now (after moving the location, the old place's doesn't count)
export function climateHere() {
  const c = S.climate, w = S.weather;
  if (!c || !Array.isArray(c.t) || c.t.length !== 12) return null;
  if (c.preset) return c;   // a climate type you picked: until your location's own weather is in
  return !w || w.lat == null || (Math.abs(c.lat - w.lat) < 0.15 && Math.abs(c.lon - w.lon) < 0.15) ? c : null;
}
// a location is set but its climate isn't in yet: everything still runs on the built-in Tokyo values — say so
export const climatePending = () => { const c = climateHere(); return !!(S.weather && S.weather.lat != null && (!c || c.preset)); };
export function climateNotice() {
  if (!climatePending()) return '';
  A.climRetry = async () => { const ok = await ensureClimate(true); if (!ok) alert('Couldn’t fetch it — are you online?'); };
  return `<p class="banner warn small clim">${_climBusy ? '⏳ Getting the usual weather for' : '⚠️ Not yet fetched: the usual weather for'} <b>${esc(S.weather.name || 'your location')}</b>. Until it is, sowing months, growth, harvest and feeding times use ${S.climate && S.climate.preset ? `the climate type you picked (${esc(S.climate.name)})` : 'the built-in western Tokyo climate'}. ${_climBusy ? '' : '<button class="btn small" data-act="climRetry">↻ Get it now</button>'}</p>`;
}
export function applyClimate(force) {
  const c = climateHere();
  const t = c ? c.t : TOKYO_T, r = c ? c.rain : TOKYO_RAIN, key = t.join(',') + '|' + JSON.stringify(S.sowOverride || {}) + '|' + JSON.stringify(c ? c.frost || null : null);
  if (!force && key === _climKey) return;
  _climKey = key;
  for (let i = 0; i < 12; i++) { NORMAL_T[i] = t[i]; RAIN_MONTH[i] = r[i]; }
  clearSeasonCaches();
  applySowWindows();
}
export async function ensureClimate(force) {
  const w = S.weather; if (!w || w.lat == null || _climBusy || !navigator.onLine) return false;
  const c = climateHere(), where = `${w.lat},${w.lon}`;
  if (!force && (where === _climFailed || (c && !c.preset && c.src === CLIM_SRC))) return false;   // (from a weather service, before the app had its own climate tiles: again, once)
  _climBusy = true; applyClimate(); if (climatePending()) render();   // (the notice says it's on its way)
  try {
    const base = await climateAt(w.lat, w.lon);
    S.climate = Object.assign({ lat: w.lat, lon: w.lon, name: w.name || '', src: CLIM_SRC, years: CLIM_YEARS, fetched: todayStr(), base }, forHeight(base, w.elev));
    applyClimate(); await save(); render();
    return true;
  } catch (e) { console.warn('climate', e); _climFailed = where; return false; } finally { _climBusy = false; if (climatePending()) render(); }
}
// ---------- the usual weather anywhere: the app's own climate tiles ----------
// Made by tools/era5/build.py from ERA5 (hourly records 2016–2025, on a 0.25° grid — points about 28 km apart): for
// each grid point the usual mean temperature and rainfall of each month, and frost dates from the daily lows worked out
// as frostStats does, for lows of −2 to +4 °C. The app downloads the one 5° tile its garden is in (about
// 20 kB), once — nothing is asked of a weather service — and blends the 4 grid points around the garden (land counts
// for more than sea, so a garden on the coast isn't given the sea's weather).
export const CLIM_SRC = 'era5-2016-2025', CLIM_YEARS = '2016–2025';
const NV = 48, TH = [-2, -1, 0, 1, 2, 3, 4], LAPSE = 6.5;   // values per point (see LAYOUT in the build script); °C per km up
// A grid point's low is an average over ~28 km: on clear, still, frosty nights a garden gets colder than that. Against
// station frost dates (Denver, Chicago, Calgary, Munich, Sapporo, Winnipeg, Canberra…) the grid's lows ran about 1 °C
// warm, so a grid low of +1 °C counts as a frost.
const FROST_MARGIN = 1;
export async function climateAt(lat, lon) {
  if (!(lat >= -60 && lat <= 90)) throw new Error('no climate tile here');
  const L = ((lon % 360) + 360) % 360, ty = Math.min(29, Math.floor((90 - lat) / 5)), tx = Math.floor(L / 5) % 72;
  const r = await fetch(new URL(`climate/${ty}_${tx}.bin`, document.baseURI));
  if (!r.ok) throw new Error(r.status === 404 ? 'open sea: no climate tile' : 'HTTP ' + r.status);
  let buf = await r.arrayBuffer(); const u8 = new Uint8Array(buf, 0, 2);
  if (u8[0] === 0x1f && u8[1] === 0x8b) buf = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();   // (gzipped — unless a server already unpacked it)
  const dv = new DataView(buf);
  if (dv.byteLength !== 21 * 21 * NV * 2) throw new Error('bad tile');
  // the 4 grid points around the garden (rows from the tile's north edge, columns from its west edge)
  const row = Math.min(19.999, (90 - 5 * ty - lat) / 0.25), col = Math.min(19.999, (L - 5 * tx) / 0.25), i0 = Math.floor(row), j0 = Math.floor(col);
  const pts = [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => {
    const at = ((i0 + a) * 21 + j0 + b) * NV, v = k => dv.getInt16((at + k) * 2, true);
    const w = (a ? row - i0 : 1 - row + i0) * (b ? col - j0 : 1 - col + j0) * (v(25) / 100 + 0.02);
    return { w, v };
  }).filter(p => p.w > 0);
  const W = pts.reduce((s, p) => s + p.w, 0), avg = (k, of = pts) => { const ws = of.reduce((s, p) => s + p.w, 0); return ws ? of.reduce((s, p) => s + p.w * p.v(k), 0) / ws : null; };
  const frost = TH.map((th, j) => { const k = 27 + 3 * j, hit = pts.filter(p => p.v(k) > 0);
    return [pts.reduce((s, p) => s + p.w * p.v(k), 0) / W, avg(k + 1, hit), avg(k + 2, hit)]; });
  return { t: Array.from({ length: 12 }, (_, m) => avg(m) / 10), rain: Array.from({ length: 12 }, (_, m) => Math.round(avg(12 + m))),
    elev: Math.round(avg(24)), winters: pts[0].v(26), frost, south: lat < 0 };
}
// A garden higher than the grid points' average ground is colder — about 6.5 °C a km — and gets frost on nights the grid
// points' low is that much warmer; lower down, the other way (frost dates as far as 3 °C each way: about 450 m).
export function forHeight(base, elev) {
  const dT = elev != null && base.elev != null ? -LAPSE * (elev - base.elev) / 1000 : 0;
  const top = TH.length - 1, k = Math.max(0, Math.min(top, FROST_MARGIN - dT - TH[0])), a = Math.min(top - 1, Math.floor(k)), f = k - a, lo = base.frost[a], hi = base.frost[a + 1];
  const mix = i => lo[i] != null && hi[i] != null ? lo[i] + (hi[i] - lo[i]) * f : (f < 0.5 ? lo : hi)[i];
  const first = mix(1), last = mix(2), frosty = Math.round(mix(0));
  return { t: base.t.map(v => Math.round((v + dT) * 10) / 10), rain: base.rain.slice(), elev: elev ?? null,
    frost: { winters: base.winters, frosty, first: frosty && first != null ? Math.round(first) : null, last: frosty && last != null ? Math.round(last) : null, south: base.south } };
}
// the garden's height came with the forecast (or changed): its climate follows
export function climateForHeight(elev) {
  const c = climateHere(); if (!c || !c.base || elev == null || c.elev === elev) return false;
  Object.assign(c, forHeight(c.base, elev)); applyClimate(); return true;
}
// ---------- day length ----------
// Hours from sunrise to sunset, worked out from the latitude and date (no fetching): what sets off bolting in long-day
// crops (spinach, coriander, daikon…) and bulbing in onions. Without a location, western Tokyo's latitude.
export const gardenLat = () => S.weather && S.weather.lat != null ? S.weather.lat : S.climate && S.climate.preset ? S.climate.lat : 35.75;
export function dayLength(d, lat = gardenLat()) {
  const x = pd(d), n = Math.round((x - new Date(x.getFullYear(), 0, 1)) / 864e5) + 1;
  const decl = 23.44 * Math.sin((2 * Math.PI / 365) * (n - 81)) * Math.PI / 180, phi = lat * Math.PI / 180;
  const c = (Math.sin(-0.833 * Math.PI / 180) - Math.sin(phi) * Math.sin(decl)) / (Math.cos(phi) * Math.cos(decl));
  return c <= -1 ? 24 : c >= 1 ? 0 : 2 * Math.acos(c) * 12 / Math.PI;
}
export const lengthening = d => dayLength(addDays(d, 7)) > dayLength(d);
// The onion type that bulbs here: onions start bulbing once days pass a length their type is bred for — short-day types
// ~11–12 h, intermediate ~12–14 h, long-day 14 h and more. Japan's autumn-planted onions are short- and intermediate-day
// types; far from the equator spring-planted long-day types are the ones that bulb in time.
export function onionType(lat = gardenLat()) {
  const a = Math.abs(lat);
  return a < 28 ? ['short-day', 'Short-day onions (they bulb from ~11–12 h days)'] : a < 38 ? ['intermediate', 'Short- or intermediate-day onions (they bulb from ~12–14 h days)'] : ['long-day', 'Long-day onions for spring planting (they bulb from ~14–16 h days); short-day types only for autumn planting']
}
// ---------- frost dates from the daily lows ----------
// For each winter in the records (July to June up north, January to December down south): the first and last night the
// low went to 0 °C or below. Kept as the usual (median) dates, days from the winter's start, and how many winters had any.
// null: no daily lows in the records (then the usual mean temperature stands in: frost about when it's below 8.5 °C).
export function frostStats(time, tmin, south) {
  if (!Array.isArray(tmin) || !tmin.some(v => v != null)) return null;
  const startOf = ds => { const y = +ds.slice(0, 4), m = +ds.slice(5, 7); return south ? `${y}-01-01` : m >= 7 ? `${y}-07-01` : `${y - 1}-07-01`; };
  const wins = {};
  time.forEach((ds, i) => { const v = tmin[i]; if (v == null) return; const k = startOf(ds), w = wins[k] = wins[k] || { n: 0, first: null, last: null };
    w.n++; if (v <= 0) { const o = daysBetween(k, ds); if (w.first == null) w.first = o; w.last = o; } });
  const full = Object.values(wins).filter(w => w.n >= 330), hit = full.filter(w => w.first != null);
  if (!full.length) return null;
  const med = a => { const x = a.slice().sort((p, q) => p - q); return x.length ? x[Math.floor(x.length / 2)] : null; };
  return { winters: full.length, frosty: hit.length, first: med(hit.map(w => w.first)), last: med(hit.map(w => w.last)), south: !!south };
}
// frost only counts where it comes most winters (in a frost-free place a rare cold night doesn't set the seasons)
const frostOf = () => { const c = climateHere(), f = c && c.frost; return f && f.frosty >= Math.ceil(f.winters * 0.4) && f.first != null ? f : null; };
export const hasFrostDates = () => !!frostOf();
const winterStart = (y, f) => f.south ? `${y}-01-01` : `${y}-07-01`;
// the usual first autumn frost after a date (null where frost is rare, or no daily lows were fetched)
export function firstFrostAfter(d) {
  const f = frostOf(); if (!f) return null;
  for (let y = +d.slice(0, 4) - 1; y <= +d.slice(0, 4) + 1; y++) { const x = addDays(winterStart(y, f), f.first); if (x > d) return x; }
  return null;
}
// is this day usually past the last spring frost and before the first autumn one?
export function frostFree(d) {
  const f = frostOf(); if (!f) return true;
  for (let y = +d.slice(0, 4) - 1; y <= +d.slice(0, 4); y++) { const a = addDays(winterStart(y, f), f.first), b = addDays(winterStart(y, f), f.last); if (d >= a && d <= b) return false; }
  return true;
}
export function frostText() {
  const c = climateHere(), f = c && c.frost; if (!f) return '';
  if (!frostOf()) return f.frosty ? `Frost is rare here: ${f.frosty} of the last ${f.winters} winters.` : `No frost in the last ${f.winters} winters.`;
  const on = o => shortDate(addDays(winterStart(2026, f), o));
  return `Frosts usually from about <b>${on(f.first)}</b> to <b>${on(f.last)}</b> (${f.frosty} of the last ${f.winters} winters had frost — in half of them it came earlier, or lasted later).`;
}
const climateName = () => { const c = climateHere(); return c && c.preset ? `${c.name} — a typical year for that climate type` : c ? `${c.name || 'your location'} (${c.years} averages)` : climatePending() ? 'western Tokyo (built-in) — not yet fetched for your location' : 'western Tokyo (built-in — set your location for your own)'; };

// ---------- growth speed ----------
// Warm-season crops (tomatoes, peppers, cucurbits, beans, corn…) don't speed up in a straight line with temperature: they
// barely grow below ~8 °C, then pick up quickly and are close to full speed from a ~21 °C daily average (days in the mid-20s).
// A straight line up to 24 °C made cool-summer places (London, Hokkaido) look far too slow. Cool-season crops keep the
// straight line, which fits them. Units stay on the same scale (full speed = tref − tb a day), so 'days × (tref − tb)' still holds.
// Each crop has its own [lo, opt] for that curve (see GROW in growth.js).
export function growUnits(id, T) {
  const { tb, tref, tcap, warm, plain } = growParams(id);
  if (plain) return 1;   // a crop of your own without its temperatures: plain days
  if (HEADING.includes(kin(id)) && T < 6) return 0;
  if (warm) { const [lo, opt] = warm; return T <= lo ? 0 : (tref - tb) * (T >= opt ? 1 : Math.pow((T - lo) / (opt - lo), 0.6)); }
  return Math.max(0, Math.min(T, tcap) - tb);
}

// ---------- microclimate: indoors/outdoors, sun, container size ----------
const SUN = [['full', `${ui('sun', 18)} Full sun`], ['part', `${ui('partsun', 18)} Part sun`], ['shade', `${ui('shade', 18)} Shade`]];
export function potVolume(c) {
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
// Covers over a planting keep it warmer on the days they're on: fushokufu about 2.5 °C on the daily mean, an insect net a
// little, shade cloth not at all — less as the weather warms (no help in heat, and they usually come off), none from 22 °C.
const COVER_WARMTH = { fushokufu: 2.5, insect: 0.5, shade: 0 };
export function coverWarmth(p, c = p && container(p.containerId)) {
  if (!p || !c || c.indoor || (p.from == null && !p.assumeCover)) return null;
  // (an idea "under a tunnel or fushokufu" counts the cover it suggests)
  const xs = p.assumeCover ? [{ type: p.assumeCover }] : (c.covers || []).filter(x => (COVER_WARMTH[x.type] || 0) > 0 && x.from < p.to - 0.5 && x.to > p.from + 0.5);
  if (!xs.length) return null;
  return (d, T) => {
    let b = 0; for (const x of xs) if ((!x.on || d >= x.on) && (!x.off || d < x.off)) b = Math.max(b, COVER_WARMTH[x.type]);
    return b * (T <= 15 ? 1 : T >= 22 ? 0 : (22 - T) / 7);
  };
}
// the temperature a planting (or, without one, anything in that bed or pot) grows at each day — null: just the weather
export function tempFor(cid, p) {
  const c = container(cid); if (!c) return null;
  const cov = coverWarmth(p, c);
  if (!cov && !c.indoor && (c.sun || 'full') === 'full' && potVolume(c) == null) return null;
  const adj = climateOffset(c), daily = S.weather && S.weather.daily;
  return d => { const T = adj(dayTemp(d, daily)); return cov ? T + cov(d, T) : T; };
}
export function climateLabel(c) {
  if (c.indoor) return `${ui('home', 18)} Indoors`;
  return (SUN.find(s => s[0] === (c.sun || 'full')) || SUN[0])[1] + ' · outdoors';
}
export function climateDialog(c) {
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
