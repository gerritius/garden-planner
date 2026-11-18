/* Climate from your location, and sowing windows worked out from each crop's temperature needs.
   - Climate: 10 years of daily records for your weather location (Open-Meteo archive) → usual temperature and
     rainfall for each month. Until it's fetched (or with no location) the built-in western Tokyo values are used.
   - Sowing windows: a month is a sowing/planting month for a crop if it's the right temperature to sow or plant,
     the crop can reach harvest in reasonable time, frost-tender crops finish before the cold, and heat-sensitive
     crops don't mature in the heat. Crops grown through winter (garlic, onions, peas, broad beans…) are planted
     as it cools, if winters are mild enough — otherwise in spring. Any crop's months can be set by hand. */
'use strict';

// ---------- climate ----------
const TOKYO_T = NORMAL_T.slice(), TOKYO_RAIN = RAIN_MONTH.slice();
let _climKey = '', _climBusy = false;
function clearSeasonCaches() {
  for (const k in _need) delete _need[k];
  if (typeof _season === 'object') for (const k in _season) delete _season[k];
  if (typeof _ideaCache !== 'undefined') _ideaCache.clear();
}
function applyClimate() {
  const c = S.climate && Array.isArray(S.climate.t) && S.climate.t.length === 12 ? S.climate : null;
  const t = c ? c.t : TOKYO_T, r = c ? c.rain : TOKYO_RAIN, key = t.join(',') + '|' + JSON.stringify(S.sowOverride || {});
  if (key === _climKey) return;
  _climKey = key;
  for (let i = 0; i < 12; i++) { NORMAL_T[i] = t[i]; RAIN_MONTH[i] = r[i]; }
  clearSeasonCaches();
  applySowWindows();
}
async function ensureClimate(force) {
  const w = S.weather; if (!w || w.lat == null || _climBusy || !navigator.onLine) return false;
  const c = S.climate;
  if (!force && c && Math.abs(c.lat - w.lat) < 0.15 && Math.abs(c.lon - w.lon) < 0.15 && daysBetween(c.fetched, todayStr()) < 365) return false;
  _climBusy = true;
  try {
    const y = new Date().getFullYear(), start = `${y - 10}-01-01`, end = `${y - 1}-12-31`;
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${w.lat}&longitude=${w.lon}&start_date=${start}&end_date=${end}&daily=temperature_2m_mean,precipitation_sum&timezone=auto`;
    const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json(), d = j.daily; if (!d || !d.time) throw new Error('no data');
    const tSum = Array(12).fill(0), tN = Array(12).fill(0), rain = {};
    d.time.forEach((ds, i) => { const m = +ds.slice(5, 7) - 1, t = d.temperature_2m_mean[i], p = d.precipitation_sum[i];
      if (t != null) { tSum[m] += t; tN[m]++; }
      if (p != null) { const k = ds.slice(0, 7); rain[k] = (rain[k] || 0) + p; } });
    const rSum = Array(12).fill(0), rN = Array(12).fill(0);
    Object.entries(rain).forEach(([k, v]) => { const m = +k.slice(5, 7) - 1; rSum[m] += v; rN[m]++; });
    const t = tSum.map((s, i) => tN[i] ? Math.round(s / tN[i] * 10) / 10 : null), rr = rSum.map((s, i) => rN[i] ? Math.round(s / rN[i]) : null);
    if (t.some(v => v == null)) throw new Error('incomplete');
    S.climate = { lat: w.lat, lon: w.lon, name: w.name || '', t, rain: rr, years: `${y - 10}–${y - 1}`, fetched: todayStr() };
    applyClimate(); await save(); render();
    return true;
  } catch (e) { console.warn('climate', e); return false; } finally { _climBusy = false; }
}
const climateName = () => S.climate ? `${S.climate.name || 'your location'} (${S.climate.years} averages)` : 'western Tokyo (built-in — set your location for your own)';

// ---------- sowing windows from temperature ----------
// per crop, where the general rules need a hand. heat: mean °C above which it bolts/spoils when maturing.
// rising / falling: sow or plant in that temperature range while it's warming / cooling (crops with set seasons).
// winter: grown through winter — planted as it cools within [low, high] °C if winters are mild; spring: otherwise, as it warms.
// pick: days of picking after the first harvest that need frost-free weather (crops picked over a season).
// plant: [low, high] mean °C to sow / plant out, where the general rule doesn't fit. warmLo: when warming, wait for this much warmth (young plants
// that get cold bolt later, e.g. hakusai).
const SOW_PROFILE = {
  lettuce: { heat: 22 }, spinach: { heat: 21, hardy: true }, shungiku: { heat: 22, plant: [9, 24] }, hakusai: { heat: 21, warmLo: 14 }, broccoli: { heat: 22 }, cauliflower: { heat: 22 },
  cabbage: { heat: 23 }, daikon: { heat: 22 }, kabu: { heat: 23 }, hatsuka: { heat: 24 }, komatsuna: { heat: 25 }, mizuna: { heat: 23 }, chingensai: { heat: 24 },
  carrot: { heat: 25 },
  potato: { rising: [6, 10], falling: [21, 25.5] }, satsumaimo: { plant: [17, 28] }, celery: { rising: [12, 19], falling: [21, 27] }, naganegi: { rising: [12, 26] }, satoimo: { rising: [13, 19] },
  garlic: { winter: [15, 23] }, onion: { winter: [10, 15], spring: [6, 12] }, hatamanegi: { winter: [11, 18] },
  soramame: { winter: [11, 18], spring: [5, 10] }, snappea: { winter: [11, 18], spring: [6, 12] }, sayaendo: { winter: [11, 18], spring: [6, 12] },
  strawberry: { winter: [14, 20] }, nanohana: { winter: [15, 23] },
  tomato: { pick: 90 }, minitomato: { pick: 90 }, nasu: { pick: 100 }, piman: { pick: 100 }, shishito: { pick: 100 }, chilli: { pick: 90 }, kyuri: { pick: 50 }, zucchini: { pick: 60 }, ingen: { pick: 30 },
};
const monthDays = (y, m) => [5, 15, 25].map(d => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
// days of growth to harvest, using the usual temperatures from a sowing date (null if it never gets there within a year)
function climGrow(cr, from) {
  const g = growParams(cr.id), need = (cr.daysHarvest || 60) * Math.max(1, Math.min(g.tref, g.tcap) - g.tb);
  let acc = 0, d = from;
  for (let i = 1; i <= 365; i++) { d = addDays(d, 1); acc += growUnits(cr.id, normalT(d)); if (acc >= need) return { days: i, end: d }; }
  return null;
}
const meanT = (a, b) => { let s = 0, n = 0; for (let d = a; d <= b; d = addDays(d, 3)) { s += normalT(d); n++; } return n ? s / n : normalT(a); };
const minT = (a, b) => { let m = 99; for (let d = a; d <= b; d = addDays(d, 3)) m = Math.min(m, normalT(d)); return m; };
const coldDays = (a, b) => { let n = 0; for (let d = a; d <= b; d = addDays(d, 1)) if (normalT(d) < 8) n++; return n; };
const isWarming = d => normalT(addDays(d, 30)) > normalT(d);
// does sowing / planting on this day work for this crop, in this climate?
function sowDayOK(cr, d) {
  const pr = SOW_PROFILE[cr.id] || {}, T = normalT(d), warm = isWarming(d), coldest = Math.min(...NORMAL_T);
  if (pr.winter) return coldest >= -2 ? !warm && T >= pr.winter[0] && T <= pr.winter[1] : !!(pr.spring && warm && T >= pr.spring[0] && T <= pr.spring[1]);
  if (pr.rising || pr.falling) return !!((warm && pr.rising && T >= pr.rising[0] && T <= pr.rising[1]) || (!warm && pr.falling && T >= pr.falling[0] && T <= pr.falling[1]));
  const seedT = SOIL_T[cr.id], seedling = cr.method !== 'seed';
  const lo = pr.plant ? pr.plant[0] : cr.tender ? (seedling ? 14 : (seedT ? seedT[0] : 14)) : Math.max(7, seedT && !seedling ? seedT[0] + 2 : 7);
  const hi = pr.plant ? pr.plant[1] : seedT && seedT[2] ? seedT[2] - 1 : cr.tender ? 29 : 26;
  if (warm && pr.warmLo && T < pr.warmLo) return false;
  if (T < lo || T > hi) return false;
  const g = climGrow(cr, d); if (!g || g.days > (cr.daysHarvest || 60) * 2) return false;              // too slow: it would crawl into winter
  if (cr.tender && minT(d, g.end) < 12) return false;                                                // frost-tender: growing done before the cold
  if (!cr.tender && !pr.hardy && !warm && coldDays(d, g.end) > 20) return false;                     // sown as it cools: should be ready before winter
  if (pr.heat && meanT(addDays(g.end, -Math.round(g.days * 0.3)), g.end) > pr.heat) return false;     // would mature in the heat: bolts / poor quality
  return pr.pick ? pickDays(g.end, pr.pick) : true;
}
// days of picking from the first harvest until the cold (mean below 12 °C), up to the crop's usual season
const pickDays = (from, max) => { let n = 0; for (let d = from; n < max && normalT(d) >= 12; d = addDays(d, 1)) n++; return n; };
function sowWindow(cr) {
  const res = [];
  for (let m = 1; m <= 12; m++) res.push(monthDays(2026, m).map(d => sowDayOK(cr, d)));
  // crops picked over a season: the planting dates that give a good part of the longest picking season possible here
  const best = Math.max(0, ...res.flat().filter(v => typeof v === 'number'));
  const ok = v => v === true || (typeof v === 'number' && v >= Math.max(20, best * 0.6));
  return res.map((r, i) => r.some(ok) ? i + 1 : 0).filter(Boolean);
}
// every crop's months: yours if you've set them, otherwise worked out (the original chart is kept as sowRef)
const SOW_RULES_VER = 1;   // bump when the rules change, so stored windows are worked out again
function applySowWindows() {
  const crops = allCrops(), key = [SOW_RULES_VER, NORMAL_T.join(','), crops.map(c => c.id + ':' + (c.daysHarvest || 0)).join(',')].join('|');
  const cache = S.sowCache && S.sowCache.key === key ? S.sowCache.m : null, worked = {};
  for (const c of crops) {
    if (c.sowRef === undefined) c.sowRef = (c.sow || []).slice();
    worked[c.id] = cache && cache[c.id] ? cache[c.id] : c.daysHarvest ? sowWindow(c) : c.sowRef.slice();
    const own = (S.sowOverride || {})[c.id];
    c.sow = own ? own.slice() : worked[c.id].slice();
    c.sowOwn = !!own;
  }
  if (!cache) S.sowCache = { key, m: worked };   // kept with your data so it isn't worked out again every time the app opens
}

// ---------- where you see it ----------
// Tools → Weather location: what the climate is based on
function climateSection() {
  A.climRefresh = async () => { const el = $('#climst'); if (el) el.textContent = 'Fetching…'; const ok = await ensureClimate(true); if (!ok && el) el.textContent = 'Couldn’t fetch it — are you online?'; };
  const c = S.climate, t = NORMAL_T, rows = MONTHS.map((m, i) => `<span><i>${m[0]}</i>${Math.round(t[i])}°</span>`).join('');
  return `<section><h3>Climate</h3><p>Sowing months, growth and harvest estimates, frost and watering use the usual weather for <b>${esc(climateName())}</b>.</p>
    <div class="climrow">${rows}</div>
    ${S.weather && S.weather.lat != null ? `<div class="btnrow"><button class="btn small" data-act="climRefresh">↻ ${c ? 'Refresh' : 'Get'} climate for ${esc(S.weather.name || 'my location')}</button></div><p class="small muted" id="climst"></p>` : '<p class="hint">Set your location above and the app fetches the usual temperatures and rainfall there (10 years of records).</p>'}</section>`;
}
// sowing calendar: worked out for your climate, every crop's months editable
function pageSow() {
  setChrome('Sowing calendar', { back: true, kicker: S.climate ? `For ${S.climate.name || 'your location'}` : 'Western Tokyo (built-in climate)', sub: sekki() });
  const m = new Date().getMonth() + 1;
  const list = allCrops().filter(c => c.daysHarvest || (c.sow || []).length).slice().sort((a, b) => a.en.localeCompare(b.en));
  A.sowCrop = el => sowPick(el.dataset.id);
  A.sowEdit = el => sowMonthsDialog(crop(el.dataset.id));
  const st = soilTemps();
  const html = `<p class="hint">Months to sow or plant out, worked out from each crop’s temperature needs and the usual weather ${S.climate ? `in ${esc(S.climate.name || 'your area')}` : 'in western Tokyo'}. ✎ marks months you’ve set yourself — tap ✎ on any crop to change them. Tap a crop to plant it.${st ? ` Soil this week ~${Math.round(st.week ?? st.now)}° at 6 cm: ✓ good for sowing · ◐ slow · ❄ too cold.` : ''}</p>
    <div class="sowtable"><div class="sowrow head"><span></span>${MONTHS.map((x, i) => `<i class="${i + 1 === m ? 'now' : ''}">${x[0]}</i>`).join('')}<b></b></div>
    ${list.map(c => `<div class="sowrow"><span data-act="sowCrop" data-id="${c.id}">${ic(c.id, 20)}${esc(c.en)}${c.method === 'seed' ? soilBadge(c.id) : ''}</span>${MONTHS.map((x, i) => `<i data-act="sowCrop" data-id="${c.id}" class="${(c.sow || []).includes(i + 1) ? 'on' : ''}${i + 1 === m ? ' now' : ''}"></i>`).join('')}<button type="button" class="link sowed${c.sowOwn ? ' own' : ''}" data-act="sowEdit" data-id="${c.id}" aria-label="Change months">✎</button></div>`).join('')}
    </div>${!S.climate && S.weather && S.weather.lat != null ? '<p class="hint">Fetching the climate for your location…</p>' : ''}`;
  return { html };
}
function sowMonthsDialog(cr) {
  const own = (S.sowOverride || {})[cr.id], auto = c => c.daysHarvest ? sowWindow(c) : (c.sowRef || []);
  let sel = new Set(cr.sow || []);
  modal('<div></div>', (m, close) => {
    const draw = () => {
      m.querySelector('.sheet').innerHTML = `<h3>${ic(cr.id, 22)} ${esc(cr.en)} — months</h3>
        <p class="small muted">Tap the months you sow or plant it out. ${own ? 'You’ve set these yourself.' : 'These are worked out for your climate.'}</p>
        <div class="monthgrid">${MONTHS.map((x, i) => `<button type="button" class="chip${sel.has(i + 1) ? ' on' : ''}" data-mo="${i + 1}">${x}</button>`).join('')}</div>
        <p class="hint">Worked out: ${auto(cr).map(i => MONTHS[i - 1]).join(', ') || 'none — too cold or too hot here outdoors'}.</p>
        <div class="btns">${own ? '<button type="button" class="btn" data-x="reset">Use worked-out months</button>' : '<button type="button" class="btn" data-x="no">Cancel</button>'}<button type="button" class="btn primary" data-x="ok">Save</button></div>`;
      m.querySelectorAll('[data-mo]').forEach(b => b.onclick = () => { const v = +b.dataset.mo; sel.has(v) ? sel.delete(v) : sel.add(v); draw(); });
      const no = m.querySelector('[data-x=no]'); if (no) no.onclick = close;
      const rs = m.querySelector('[data-x=reset]'); if (rs) rs.onclick = async () => { delete S.sowOverride[cr.id]; applyClimate(); await save(); close(); render(); };
      m.querySelector('[data-x=ok]').onclick = async () => { const v = [...sel].sort((a, b) => a - b), a = auto(cr);
        S.sowOverride = S.sowOverride || {}; if (v.join() === a.join()) delete S.sowOverride[cr.id]; else S.sowOverride[cr.id] = v;
        applyClimate(); await save(); close(); render(); };
    };
    draw();
  });
}
