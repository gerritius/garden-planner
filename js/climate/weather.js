// Weather (Open-Meteo forecast, free, no key): the forecast, frost jobs and covers, good spraying days, and wind / rain / heat alerts.

import { A, render, route, setChrome } from '../core/router.js';
import { S, save } from '../core/state.js';
import { modal } from '../core/ui.js';
import { $, addDays, daysBetween, esc, niceDate, pd, todayStr, uid } from '../core/util.js';
import { Icons } from '../data/icons.js';
import { container, isLive } from '../garden/garden.js';
import { coveredText, plantingCover } from '../plants/covers.js';
import { crop } from '../plants/crops.js';
import { startsGrowing } from '../plants/seedlings.js';
import { beeNote, sprayAlerts } from '../products/sprays.js';

// ---------- weather (Open-Meteo, free, no key) ----------
export const dayName = d => { const n = daysBetween(todayStr(), d); return n === 0 ? 'Today' : n === 1 ? 'Tmrw' : pd(d).toLocaleDateString('en-GB', { weekday: 'short' }); };
// Keep the forecast fresh wherever you are in the app — at start, whenever the app comes back to the front, and every
// hour — so watering, frost and spray advice always follow the latest forecast. The page is redrawn with it, except
// while you're filling something in (it's used next time the page is drawn).
export async function freshenWeather() {
  if (!(await Weather.refresh())) return false;
  const [, b, c] = route().parts, busy = b === 'new' || c === 'edit' || c === 'arrange' || c === 'sections' || !$('#modal').hidden;
  if (!busy) render();
  return true;
}
export const Weather = {
  busy: false,
  async refresh(force) {
    const w = S.weather;
    if (!w || w.lat == null || this.busy) return false;
    if (!force && w.fetched && w.hourly && w.hourly.soil_temperature_6cm && Date.now() - w.fetched < 3600e3) return false;
    if (!navigator.onLine) return false;
    this.busy = true;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${w.lat}&longitude=${w.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max&hourly=temperature_2m,precipitation,precipitation_probability,wind_speed_10m,wind_gusts_10m,soil_temperature_6cm&timezone=auto&forecast_days=7&past_days=7`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json(); w.daily = j.daily; w.hourly = j.hourly; w.fetched = Date.now();
      const td = todayStr(), keep = addDays(td, -45);
      S.tempHist = Object.fromEntries(Object.entries(S.tempHist || {}).filter(([k]) => k >= addDays(td, -120)));
      w.daily.time.forEach((t, i) => { if (t < td && w.daily.temperature_2m_max[i] != null) S.tempHist[t] = (w.daily.temperature_2m_max[i] + w.daily.temperature_2m_min[i]) / 2; }); S.rainHist = Object.fromEntries(Object.entries(S.rainHist || {}).filter(([k]) => k >= keep));
      w.daily.time.forEach((t, i) => { if (t < td) S.rainHist[t] = w.daily.precipitation_sum[i] || 0; });
      await save(); return true;
    } catch (e) { console.warn('weather', e); return false; } finally { this.busy = false; }
  },
  days() {
    const d = S.weather && S.weather.daily; if (!d) return [];
    return d.time.map((t, i) => ({ date: t, code: d.weather_code[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], rain: d.precipitation_sum[i] || 0, pop: (d.precipitation_probability_max || [])[i], wind: d.wind_speed_10m_max[i], gust: (d.wind_gusts_10m_max || [])[i] }))
      .filter(x => x.date >= todayStr());
  },
  alerts() {
    const days = this.days().slice(0, 5), out = [];
    const active = S.plantings.filter(isLive);
    if (!active.length) return out;
    const list = (arr, f) => arr.map(d => `${dayName(d.date)} ${f(d)}`).join(', ');
    const fr = frostRisk();
    if (fr.length) { const names = [...new Set(fr.flatMap(x => x.hit.map(p => crop(p.cropId).en)))]; out.push(['frost', `<b>${fr.some(x => x.hard) ? 'Hard frost' : 'Frost risk'}</b> ${list(fr.map(x => x.d), d => Math.round(d.min) + '°')}${names.length ? ` — cover ${esc(names.join(', '))}` : ' — nothing tender planted'}`]); }
    const rain = days.filter(d => d.rain >= 30);
    if (rain.length) out.push(['rain', `<b>Heavy rain</b> ${list(rain, d => Math.round(d.rain) + ' mm')} — check drainage`]);
    const wind = days.filter(d => (d.gust != null ? d.gust : d.wind * 1.6) >= 50);
    if (wind.length) out.push(['wind', `<b>Strong wind</b> ${list(wind, d => 'gusts ' + Math.round(d.gust != null ? d.gust : d.wind * 1.6) + ' km/h')} — check supports & covers`]);
    const heat = days.filter(d => d.max >= 33);
    if (heat.length) out.push(['heat', `<b>Hot</b> ${list(heat, d => Math.round(d.max) + '°')} — water pots & bags well`]);
    return out;
  },
  section() {
    const w = S.weather;
    if (!w || w.lat == null) return `<a class="wxsetup" href="#/settings">${Icons.weather(2, 30)}<span><b>Add weather &amp; frost alerts</b><small>Set your garden’s location in Tools</small></span>›</a>`;
    const days = this.days();
    if (!days.length) return `<section class="wx"><p class="muted small">Weather for ${esc(w.name)} will appear when you’re online.</p></section>`;
    const age = w.fetched ? Math.round((Date.now() - w.fetched) / 3600e3) : null;
    return `<section class="wx">
      <div class="wxdays">${days.map(d => `<div class="wxd${d.date === todayStr() ? ' now' : ''}${d.min <= 2 ? ' frost' : ''}"><span class="wn">${dayName(d.date)}</span>${Icons.weather(d.code, 30)}<b>${Math.round(d.max)}°</b><span class="lo">${Math.round(d.min)}°</span><span class="rn">${d.rain >= 0.5 ? Math.round(d.rain) + 'mm' : '&nbsp;'}</span></div>`).join('')}</div>
      <div class="wxfoot">${esc(w.name)} · ${age == null ? '' : age < 1 ? 'updated just now' : `updated ${age} h ago`}</div></section>`;
  },
};
export function weatherSettings() {
  const w = S.weather;
  A.wxHere = () => {
    if (!navigator.geolocation) return alert('Location isn’t available on this device.');
    navigator.geolocation.getCurrentPosition(async pos => {
      S.weather = { lat: +pos.coords.latitude.toFixed(2), lon: +pos.coords.longitude.toFixed(2), name: 'My garden' };
      await save(); await Weather.refresh(true); render();
    }, err => alert('Couldn’t get your location: ' + err.message), { timeout: 15000 });
  };
  A.wxSearch = async () => {
    const q = $('#wxq').value.trim(); if (!q) return;
    $('#wxres').innerHTML = '<p class="muted">Searching…</p>';
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
      const j = await r.json();
      const res = j.results || [];
      $('#wxres').innerHTML = res.length ? `<ul class="plist">${res.map((x, i) => `<li data-act="wxPick" data-i="${i}"><span class="grow">${esc(x.name)}<small>${esc([x.admin1, x.country].filter(Boolean).join(', '))}</small></span>›</li>`).join('')}</ul>` : '<p class="muted">No places found. Try the town or ward name in English or Japanese.</p>';
      A.wxPick = async el => { const x = res[+el.dataset.i]; S.weather = { lat: +x.latitude.toFixed(2), lon: +x.longitude.toFixed(2), name: x.name }; await save(); await Weather.refresh(true); render(); };
    } catch { $('#wxres').innerHTML = '<p class="muted">Couldn’t search — are you online?</p>'; }
  };
  A.wxClear = async () => { S.weather = null; await save(); render(); };
  return `<section><h3>Weather</h3>
    ${w && w.lat != null ? `<p>Forecast for <b>${esc(w.name)}</b> <small>(${w.lat}, ${w.lon})</small></p><div class="btnrow"><button class="btn small" data-act="wxClear">Remove location</button></div>` : '<p>Show a 7-day forecast on the home screen, with frost, heavy rain, wind and heat alerts for what you’re growing.</p>'}
    <div class="btnrow"><button class="btn" data-act="wxHere">📍 Use my current location</button></div>
    <div class="searchrow"><input id="wxq" placeholder="…or search a town, e.g. Setagaya" enterkeyhint="search" data-enter="wxSearch"><button class="btn" data-act="wxSearch">Search</button></div>
    <div id="wxres"></div>
    <p class="hint">Uses the free Open-Meteo service. Only your garden’s rough location (2 decimal places, about 1 km) is sent to get the forecast.</p></section>`;
}

// ---------- frost jobs ----------
const HALF_HARDY = ['lettuce', 'celery', 'shungiku', 'strawberry'];
export function frostRisk() {
  const days = Weather.days().slice(0, 5);
  const act = S.plantings.filter(p => isLive(p) && !(container(p.containerId) || {}).indoor && (!p.sowDate || p.sowDate <= addDays(todayStr(), 4)));
  const out = [];
  for (const d of days) {
    if (d.min > 2) continue;
    const hit = act.filter(p => (crop(p.cropId).tender || (d.min <= -1 && HALF_HARDY.includes(p.cropId))) && !(d.min > -2 && plantingCover(p, ['fushokufu'])));
    out.push({ d, hit, hard: d.min <= -2 });
  }
  return out;
}
export function syncFrost() {
  const td = todayStr();
  S.tasks = S.tasks.filter(t => !(t.kind === 'frost' && t.done && daysBetween(t.doneOn, td) > 60));
  const open = S.tasks.find(t => t.kind === 'frost' && !t.done);
  const r = (S.weather && S.weather.lat != null) ? frostRisk().find(x => x.hit.length) : null;
  if (!r) { if (open && open.due <= td) S.tasks = S.tasks.filter(x => x !== open); return; }
  if (S.tasks.some(t => t.kind === 'frost' && t.done && t.frostDate === r.d.date)) return;
  if ((S.frostDismissed || []).includes(r.d.date)) { if (open) S.tasks = S.tasks.filter(x => x !== open); return; }
  const names = [...new Set(r.hit.map(p => crop(p.cropId).en))];
  const due = addDays(r.d.date, -1) < td ? td : addDays(r.d.date, -1);
  const title = `Cover before frost ${dayName(r.d.date)} (${Math.round(r.d.min)}°): ${names.join(', ')}`;
  const cids = [...new Set(r.hit.map(p => p.containerId))];
  if (open) Object.assign(open, { title, due, frostDate: r.d.date, cids });
  else S.tasks.push({ id: uid(), kind: 'frost', title, due, frostDate: r.d.date, cids, done: false });
}

// ---------- spray-day forecast ----------
export function sprayDays() {
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
    ${beeNote()}
    <li>Spray in the cool of the day: oily sprays and hot sun can scorch leaves.</li></ul>`;
}
export function pageSprayDay() {
  setChrome('Spray days', { back: true, kicker: 'From the hourly forecast' });
  if (!S.weather || S.weather.lat == null) return { html: `<div class="empty-state">Set your garden’s location in Tools to see spray days.<br><a class="btn" href="#/settings">Tools</a></div>` };
  const html = `${sprayDaysHTML(false) || '<p class="muted">Hourly weather will appear when you’re online.</p>'}${sprayDayInfo()}
    ${sprayAlerts()}<div class="btnrow"><a class="btn" href="#/products?t=spray">📦 Your sprays</a><a class="btn" href="#/log">📝 Log a spray</a></div>`;
  return { html, after: () => Weather.refresh().then(ch => { if (ch && route().parts[0] === 'sprayday') render(); }) };
}

// ---------- weather alert jobs ----------
export const TALL = ['tomato', 'minitomato', 'nasu', 'piman', 'shishito', 'chilli', 'kyuri', 'corn', 'snappea', 'sayaendo', 'ingen', 'soramame', 'zucchini', 'edamame'];
export const NETTED = ['cabbage', 'hakusai', 'broccoli', 'cauliflower', 'komatsuna', 'chingensai', 'mizuna', 'kabu', 'daikon', 'hatsuka', 'nanohana'];
const gustOf = d => d.gust != null ? d.gust : (d.wind || 0) * 1.6;
export const WX = {
  wind: { icon: '💨', test: d => gustOf(d) >= 50, val: d => `gusts ${Math.round(gustOf(d))} km/h`, severe: d => gustOf(d) >= 75,
    title: s => s ? 'Prepare for storm-force wind' : 'Secure supports & nets before strong wind' },
  rain: { icon: '🌧️', test: d => d.rain >= 40 && (d.pop == null || d.pop >= 50), val: d => `${Math.round(d.rain)} mm`, severe: d => d.rain >= 80,
    title: s => s ? 'Prepare for very heavy rain' : 'Prepare for heavy rain' },
  heat: { icon: '🥵', test: d => d.max >= 33, val: d => `${Math.round(d.max)}°`, severe: d => d.max >= 36,
    title: s => s ? 'Protect crops from extreme heat' : 'Hot day coming — water early' },
};
export function syncWx() {
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
export function wxAdvice(t) {
  const live = S.plantings.filter(p => isLive(p) && !(container(p.containerId) || {}).indoor), td = todayStr();
  const names = f => [...new Set(live.filter(f).map(p => crop(p.cropId).en))].join(', ');
  const tall = names(p => TALL.includes(p.cropId)), net = names(p => NETTED.includes(p.cropId)), young = names(p => p.sowDate && daysBetween(p.sowDate, td) <= 21);
  const ready = names(p => p.harvestDate && p.harvestDate <= addDays(td, 7)), trays = startsGrowing().length > 0;
  const L = {
    wind: [tall && `Tie in stems and check stakes are firm: ${tall}`, coveredText() ? `Check tunnel hoops, pegs and the edges of: ${coveredText()}` : net && `Netted crops — check pegs and edges: ${net}`, `Move light pots${trays ? ', seedling trays' : ''} and anything loose somewhere sheltered`, ready && `Pick what’s ready first: ${ready}`,
      t.severe && 'Storm-force (typhoon): take off covers that act as sails, lay down supports you can’t secure, and push fabric bags together against a wall', 'Afterwards: check for snapped stems and earth up anything rocked loose (土寄せ)'],
    rain: ['Clear drainage around the beds and make sure bags aren’t standing in water', trays && 'Move seedling trays under cover', young && `Young plants can be flattened or splashed with soil — mulch or cover: ${young}`,
      'Hold off fertiliser and sprays until it’s passed — they’ll wash off', ready && `Pick what’s ready — heavy rain can split or rot it: ${ready}`, 'Afterwards: earth up anything washed out and watch for slugs and rot'],
    heat: ['Water pots & bags deeply in the early morning', young && `Shade young plants and new transplants: ${young}`, trays && 'Keep seedling trays in the shade and check them twice', 'Mulch bare soil; don’t spray or fertilise in the heat of the day'],
  };
  return (L[t.wx] || []).filter(Boolean);
}
export function wxTaskDialog(t) {
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

// ---------- frost job dialog ----------
export function frostTaskDialog(t) {
  const beds = (t.cids || []).map(id => (container(id) || {}).name).filter(Boolean).join(', ');
  modal(`<h3>❄️ Frost warning</h3><p class="msg">${esc(t.title)}</p>${beds ? `<p class="muted small">${esc(beds)}</p>` : ''}
    <p class="hint">Cover tender crops the evening before (a fushokufu tunnel, a sheet or an upturned box) and uncover in the morning. Made from the weather forecast.</p>
    <div class="btns"><button class="btn danger" data-x="del">Delete</button><button class="btn primary" data-x="ok">Close</button></div>`, (m, close) => {
    m.querySelector('[data-x=ok]').onclick = close;
    m.querySelector('[data-x=del]').onclick = async () => {
      if (!t.done && t.frostDate) S.frostDismissed = [...(S.frostDismissed || []).filter(d => d >= addDays(todayStr(), -7)), t.frostDate];
      S.tasks = S.tasks.filter(x => x !== t); await save(); close(); render();
    };
  });
}
