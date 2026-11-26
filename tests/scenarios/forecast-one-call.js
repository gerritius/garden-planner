// The forecast is one small request — at most 10 values over at most 7 days, which Open-Meteo counts as a single call
// — with each day's summary made from its hours; fetched again only once it's 3 hours old, and not while the app is
// in the background.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  const asked = [];
  await ctx.route('**/api.open-meteo.com/**', r => { const q = new URL(r.request().url()).searchParams; asked.push(q);
    const time = [], T = [], P = [], PP = [], W = [], G = [], C = [], ST = [];
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) { const day = `2026-11-${String(17 + d).padStart(2, '0')}`; time.push(`${day}T${String(h).padStart(2, '0')}:00`);
      T.push(8 + d + 6 * Math.sin((h - 9) / 24 * 2 * Math.PI)); P.push(d === 3 && h > 12 ? 1.5 : 0); PP.push(d === 3 ? 80 : 10); W.push(10 + h % 5); G.push(20 + h % 7); C.push(d === 3 ? 61 : h === 12 ? 2 : 1); ST.push(10 + d * 0.3); }
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ hourly: { time, weather_code: C, temperature_2m: T, precipitation: P, precipitation_probability: PP, wind_speed_10m: W, wind_gusts_10m: G, soil_temperature_6cm: ST } }) }); });
  await ctx.route('**/archive-api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => { S.weather = { lat: 35.75, lon: 139.42, name: 'Higashiyamato' }; await save(); await Weather.refresh(true); });
  const q = asked[asked.length - 1];
  console.log('request: hourly', q.get('hourly').split(',').length, 'values |', 'daily', q.get('daily') || 'none', '| days', +q.get('past_days') + +q.get('forecast_days'));
  console.log('days made from the hours:', await pg.evaluate(() => Weather.days().slice(0, 3).map(d => `${d.date} ${Math.round(d.max)}/${Math.round(d.min)}° rain ${d.rain} mm ${d.pop}% gust ${d.gust} code ${d.code}`).join(' | ')));
  console.log('rain recorded for yesterday:', await pg.evaluate(() => S.rainHist['2026-11-17']));
  // opened again an hour later, and two hours after that: one more fetch only once it's 3 hours old
  const n0 = asked.length;
  await pg.evaluate(async () => { S.weather.fetched = Date.now() - 3600e3; await Weather.refresh(); });
  console.log('1 h later: fetched again?', asked.length > n0);
  await pg.evaluate(async () => { S.weather.fetched = Date.now() - 3.1 * 3600e3; await Weather.refresh(); });
  console.log('3 h later: fetched again?', asked.length > n0);
  console.log('errs', errs); await b.close();
})();
