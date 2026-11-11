'use strict';
/* Extra features: units, rotation, harvest log, photo diary, sowing guide, weather, themes.
   Uses helpers defined in app.js (loaded after this file) at call time. */

// ---------- units ----------
function fmtAmt(amount, unit) {
  if (amount == null || amount === '') return '';
  if (unit === 'handful') return `${amount} handful${+amount === 1 ? '' : 's'} (~${Math.round(amount * HANDFUL_G)} g)`;
  return `${amount} ${unit || 'g'}`;
}
const unitOpts = sel => UNITS.map(u => `<option value="${u}"${sel === u ? ' selected' : ''}>${u === 'handful' ? 'handfuls' : u}</option>`).join('');

// ---------- rotation ----------
function lastCropIn(c, from, to, beforeDate, excludeId) {
  const h = (c.history || []).filter(x => x.plantingId !== excludeId && x.from < to - 0.5 && x.to > from + 0.5 && (!beforeDate || (x.harvestedOn || '') <= beforeDate));
  h.sort((a, b) => ((a.harvestedOn || '') < (b.harvestedOn || '') ? -1 : 1));
  return h.length ? h[h.length - 1] : null;
}
function rotationNote(c, from, to, cropId, beforeDate, excludeId) {
  const prev = lastCropIn(c, from, to, beforeDate, excludeId);
  if (!prev) return null;
  const a = crop(prev.cropId), b = cropId ? crop(cropId) : null;
  const same = !!(b && a.family && a.family !== 'other' && a.family === b.family);
  const fam = same ? FAMILIES[a.family] : null;
  return {
    prev, same,
    html: same
      ? `<b>Same family as the last crop here.</b> ${esc(a.en)} was here before (harvested ${shortDate(prev.harvestedOn)}) — both are ${esc(fam[0])} ${esc(fam[1])}. Consider extra compost or a different spot.`
      : `Last crop here: ${esc(cropName(prev.cropId))} (harvested ${shortDate(prev.harvestedOn)}).`,
  };
}

// ---------- harvest log ----------
const harvestTotal = p => (p.harvests || []).reduce((s, h) => s + (+h.count || 0), 0);
function harvestSection(p) {
  const hs = (p.harvests || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  return `<section><h3>Harvest log</h3>
    <div class="hvbar"><div class="hvtotal"><b>${harvestTotal(p)}</b><span>picked so far</span></div><button class="btn primary" data-act="logHarvest">🧺 Log a harvest</button></div>
    ${hs.length ? `<ul class="plist hvlist">${hs.map(h => `<li data-act="editHarvest" data-id="${h.id}"><span class="hvn">+${h.count}</span><span class="grow">${niceDate(h.date)}${h.note ? `<small>${esc(h.note)}</small>` : ''}</span><span class="muted">✎</span></li>`).join('')}</ul>` : ''}
  </section>`;
}
function harvestDialog(p, h) {
  const isNew = !h;
  h = h || { id: uid(), date: todayStr(), count: 1, note: '' };
  modal(`<h3>${isNew ? 'Log a harvest' : 'Edit harvest'}</h3>
    <p class="muted small">${ic(p.cropId)} ${esc(cropName(p.cropId))}${p.variety ? ' · ' + esc(p.variety) : ''}</p>
    <form id="hf" class="form">
      <label>How many?<div class="stepper"><button type="button" data-s="-1">−</button><input name="count" type="number" inputmode="numeric" min="0" value="${h.count}"><button type="button" data-s="1">＋</button></div></label>
      <label>Date<input name="date" type="date" value="${h.date}"></label>
      <label>Note<input name="note" value="${esc(h.note)}" placeholder="optional, e.g. outer leaves only"></label>
      <div class="btns">${isNew ? '<button type="button" class="btn" data-x="no">Cancel</button>' : '<button type="button" class="btn danger" data-x="del">Delete</button>'}<button class="btn primary">Save</button></div>
    </form>`, (m, close) => {
    const f = m.querySelector('#hf');
    m.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { f.count.value = Math.max(0, (+f.count.value || 0) + +b.dataset.s); });
    const no = m.querySelector('[data-x=no]'); if (no) no.onclick = close;
    const del = m.querySelector('[data-x=del]');
    if (del) del.onclick = async () => { p.harvests = (p.harvests || []).filter(x => x.id !== h.id); await save(); close(); render(); };
    f.onsubmit = async e => {
      e.preventDefault();
      const n = Math.max(0, parseInt(f.count.value) || 0);
      if (!n) return alert('Enter how many you picked.');
      Object.assign(h, { count: n, date: f.date.value || todayStr(), note: f.note.value.trim() });
      if (isNew) (p.harvests = p.harvests || []).push(h);
      await save(); close(); render();
    };
  });
}

// ---------- photo diary ----------
const dayN = (p, date) => p.sowDate ? daysBetween(p.sowDate, date) : null;
function diarySection(p) {
  const ds = (p.diary || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  return `<section><h3>Photo diary</h3><div class="diary">
    <label class="dthumb add"><span>＋<br>Photo</span><input type="file" accept="image/*" id="diaryIn" hidden></label>
    <button type="button" class="dthumb add" data-act="diaryNote"><span>＋<br>Note / pest</span></button>
    ${ds.map(d => { const n = dayN(p, d.date); return `<a class="dthumb ph${d.photo ? '' : ' txt'}" href="#/plant/${p.id}/diary/${d.id}">${d.photo ? `<img data-photo="${d.photo}" alt="">` : `<em>${esc(d.note || (d.tags || []).map(pestName).join(', '))}</em>`}${(d.tags || []).length ? '<i class="pestdot">🐛</i>' : ''}<span>${shortDate(d.date)}${n != null && n >= 0 ? ` · day ${n}` : ''}</span></a>`; }).join('')}
  </div></section>`;
}
function diaryAfter(p) {
  A.diaryNote = () => diaryEntryDialog(p, null);
  const inp = $('#diaryIn'); if (!inp) return;
  inp.addEventListener('change', () => addDiaryFromFile(p, inp.files[0]));
}
function pageDiary(p, eid) {
  if (!p) return { html: notFound() };
  const list = (p.diary || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const i = list.findIndex(d => d.id === eid), d = list[i];
  if (!d) return { html: notFound() };
  setChrome('Photo diary', { back: true, kicker: crop(p.cropId).en + (p.variety ? ' · ' + p.variety : '') });
  const n = dayN(p, d.date);
  A.saveDiary = async () => { const f = $('#def'); d.date = f.date.value || d.date; d.note = f.note.value.trim(); d.tags = readPests(f); await save(); history.back(); };
  A.delDiary = async () => {
    if (!await confirmBox('Delete this diary photo?', 'Delete', true)) return;
    if (d.photo) { await DB.delPhoto(d.photo); delete photoURLs[d.photo]; }
    p.diary = p.diary.filter(x => x.id !== d.id); await save(); history.back();
  };
  const nav = (j, l) => list[j] ? `<a class="btn small" href="#/plant/${p.id}/diary/${list[j].id}" onclick="location.replace(this.href);return false;">${l}</a>` : '<span></span>';
  const html = `${d.photo ? `<figure class="bigphoto ph"><img data-photo="${d.photo}" alt=""></figure>` : ''}
    <div class="dnav">${nav(i - 1, '‹ Older')}<span class="muted">${i + 1} / ${list.length}</span>${nav(i + 1, 'Newer ›')}</div>
    <p class="center dday">${niceDate(d.date)}${n != null && n >= 0 ? ` · day ${n} since ${p.method === 'seed' ? 'sowing' : 'planting'}` : ''}</p>
    <form id="def" class="form" onsubmit="return false"><label>Date<input type="date" name="date" value="${d.date}"></label>
      <label>Note<textarea name="note" rows="3">${esc(d.note || '')}</textarea></label>${pestPicker(d.tags || [])}</form>
    <div class="btnrow"><button class="btn danger" data-act="delDiary">Delete</button><button class="btn primary" data-act="saveDiary">Save</button></div>`;
  return { html };
}

// ---------- sowing guide ----------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function sowNowSection() {
  const m = new Date().getMonth() + 1;
  const list = allCrops().filter(c => (c.sow || []).includes(m));
  const mn = new Date().toLocaleDateString('en-GB', { month: 'long' });
  return `<section><h3>Sow &amp; plant in ${mn}</h3>
    ${list.length ? `<div class="sowchips">${list.map(c => `<button class="chip big" data-act="sowCrop" data-id="${c.id}">${ic(c.id, 26)}${esc(c.en)}</button>`).join('')}</div>` : '<p class="muted">Nothing in the catalogue for this month.</p>'}
    <a class="more" href="#/sow">Full sowing calendar →</a></section>`;
}
function sowPick(id) {
  const opts = S.containers.filter(c => gaps(c).length);
  const free = c => { const g = gaps(c), L = Draw.dims(c).L; return g.length === 1 && g[0][0] === 0 && g[0][1] >= L ? 'empty' : g.map(x => `${x[0]}–${x[1]} cm`).join(', ') + ' free'; };
  modal(`<h3>Plant ${esc(cropName(id))} in…</h3>
    ${opts.length ? `<ul class="plist">${opts.map(c => `<li><a href="#/plant/new/${c.id}?crop=${id}" data-x="go"><span class="grow"><b>${esc(c.name)}</b><small>${sizeLabel(c)} · ${free(c)}</small></span>›</a></li>`).join('')}</ul>` : '<p class="muted">No free space — harvest something or add a bed or pot first.</p>'}
    <div class="btns"><button class="btn" data-x="no">Cancel</button></div>`, (m, close) => {
    m.querySelectorAll('[data-x=go]').forEach(a => a.onclick = () => close());
    m.querySelector('[data-x=no]').onclick = close;
  });
}
function pageSow() {
  setChrome('Sowing calendar', { back: true, kicker: 'Central Japan · 中間地', sub: sekki() });
  const m = new Date().getMonth() + 1;
  const list = allCrops().filter(c => (c.sow || []).length).slice().sort((a, b) => a.en.localeCompare(b.en));
  A.sowCrop = el => sowPick(el.dataset.id);
  const html = `<p class="hint">Typical months to sow or plant out in central Japan. Shaded = sow/plant. Tap a crop to plant it.</p>
    <div class="sowtable"><div class="sowrow head"><span></span>${MONTHS.map((x, i) => `<i class="${i + 1 === m ? 'now' : ''}">${x[0]}</i>`).join('')}</div>
    ${list.map(c => `<div class="sowrow" data-act="sowCrop" data-id="${c.id}"><span>${ic(c.id, 20)}${esc(c.en)}</span>${MONTHS.map((x, i) => `<i class="${c.sow.includes(i + 1) ? 'on' : ''}${i + 1 === m ? ' now' : ''}"></i>`).join('')}</div>`).join('')}</div>`;
  return { html };
}

// ---------- weather (Open-Meteo, free, no key) ----------
const dayName = d => { const n = daysBetween(todayStr(), d); return n === 0 ? 'Today' : n === 1 ? 'Tmrw' : pd(d).toLocaleDateString('en-GB', { weekday: 'short' }); };
const Weather = {
  busy: false,
  async refresh(force) {
    const w = S.weather;
    if (!w || w.lat == null || this.busy) return false;
    if (!force && w.fetched && Date.now() - w.fetched < 2 * 3600e3) return false;
    if (!navigator.onLine) return false;
    this.busy = true;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${w.lat}&longitude=${w.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=auto&forecast_days=7&past_days=1`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      w.daily = (await r.json()).daily; w.fetched = Date.now();
      await save(); return true;
    } catch (e) { console.warn('weather', e); return false; } finally { this.busy = false; }
  },
  days() {
    const d = S.weather && S.weather.daily; if (!d) return [];
    return d.time.map((t, i) => ({ date: t, code: d.weather_code[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], rain: d.precipitation_sum[i] || 0, pop: (d.precipitation_probability_max || [])[i], wind: d.wind_speed_10m_max[i] }))
      .filter(x => x.date >= todayStr());
  },
  alerts() {
    const days = this.days().slice(0, 5), out = [];
    const active = S.plantings.filter(p => p.status !== 'harvested');
    if (!active.length) return out;
    const tender = [...new Set(active.filter(p => crop(p.cropId).tender).map(p => crop(p.cropId).en))];
    const list = (arr, f) => arr.map(d => `${dayName(d.date)} ${f(d)}`).join(', ');
    const frost = days.filter(d => d.min <= 2);
    if (frost.length) out.push(['frost', `<b>Frost risk</b> ${list(frost, d => Math.round(d.min) + '°')}${tender.length ? ` — protect ${esc(tender.join(', '))}` : ''}`]);
    const rain = days.filter(d => d.rain >= 30);
    if (rain.length) out.push(['rain', `<b>Heavy rain</b> ${list(rain, d => Math.round(d.rain) + ' mm')} — check drainage`]);
    const wind = days.filter(d => d.wind >= 40);
    if (wind.length) out.push(['wind', `<b>Strong wind</b> ${list(wind, d => Math.round(d.wind) + ' km/h')} — check supports & covers`]);
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
      ${this.alerts().map(([k, t]) => `<div class="wxalert ${k}">${t}</div>`).join('')}
      <div class="wxfoot">${esc(w.name)} · ${age == null ? '' : age < 1 ? 'updated just now' : `updated ${age} h ago`}</div></section>`;
  },
};
function weatherSettings() {
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
    <div class="searchrow"><input id="wxq" placeholder="…or search a town, e.g. Setagaya" enterkeyhint="search" onkeydown="if(event.key==='Enter'){event.preventDefault();A.wxSearch();}"><button class="btn" data-act="wxSearch">Search</button></div>
    <div id="wxres"></div>
    <p class="hint">Uses the free Open-Meteo service. Only your garden’s rough location (2 decimal places, about 1 km) is sent to get the forecast.</p></section>`;
}

// ---------- themes ----------
const THEMES = [['cream', 'Cream'], ['kraft', 'Kraft'], ['dark', 'Dark'], ['auto', 'Match phone']];
const THEME_BAR = { cream: '#6b8a55', kraft: '#34492b', dark: '#23301d' };
function applyTheme() {
  const t = (S && S.theme) || 'cream';
  const r = t === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'cream') : t;
  document.documentElement.dataset.theme = r;
  const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = THEME_BAR[r];
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
function themeSettings() {
  A.theme = async el => { S.theme = el.dataset.v; applyTheme(); await save(); render(); };
  const cur = S.theme || 'cream';
  return `<section><h3>Appearance</h3><div class="seg">${THEMES.map(([v, l]) => `<button type="button" data-act="theme" data-v="${v}" class="${cur === v ? 'on' : ''}">${l}</button>`).join('')}</div></section>`;
}

// ---------- harvest totals ----------
function harvestTotalsSection() {
  const y = String(new Date().getFullYear());
  const tot = {};
  for (const p of S.plantings) for (const h of p.harvests || []) if ((h.date || '').startsWith(y)) tot[p.cropId] = (tot[p.cropId] || 0) + (+h.count || 0);
  const rows = Object.entries(tot).sort((a, b) => b[1] - a[1]);
  return `<section><h3>Harvests in ${y}</h3>${rows.length ? `<ul class="plist">${rows.map(([id, n]) => `<li>${ic(id)}<span class="grow">${esc(cropName(id))}</span><b>${n}</b></li>`).join('')}</ul>` : '<p class="muted">Nothing logged yet. Use “Log a harvest” on a crop’s page.</p>'}</section>`;
}
