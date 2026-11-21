const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  const td = new Date(); const ymd = d => d.toISOString().slice(0, 10);
  const days = [...Array(14)].map((_, i) => ymd(new Date(Date.now() + (i - 7) * 864e5)));
  const hrs = days.flatMap(d => [...Array(24)].map((_, h) => d + 'T' + String(h).padStart(2, '0') + ':00'));
  const body = { daily: { time: days, weather_code: days.map(() => 2), temperature_2m_max: days.map(() => 15), temperature_2m_min: days.map(() => 6), precipitation_sum: days.map((d, i) => i === 9 ? 12 : 0), precipitation_probability_max: days.map((d, i) => i === 9 ? 80 : 5), wind_speed_10m_max: days.map(() => 9), wind_gusts_10m_max: days.map(() => 20) },
    hourly: { time: hrs, temperature_2m: hrs.map(() => 13), precipitation: hrs.map(t => t.startsWith(days[9]) ? 0.5 : 0), precipitation_probability: hrs.map(t => t.startsWith(days[9]) ? 80 : 5), wind_speed_10m: hrs.map(() => 5), wind_gusts_10m: hrs.map(() => 12) } };
  let calls = 0;
  await ctx.route('**/api.open-meteo.com/**', r => { calls++; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }); });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://localhost:8765/'); await pg.waitForTimeout(400);
  await pg.evaluate(async () => { S.weather = { lat: 35.6, lon: 139.4, name: 'Higashiyamato', fetched: Date.now(), daily: { time: [todayStr()], weather_code: [3], temperature_2m_max: [14], temperature_2m_min: [9], precipitation_sum: [0], precipitation_probability_max: [10], wind_speed_10m_max: [8] } }; await save(); });
  await pg.reload(); await pg.waitForTimeout(1500);
  console.log('weather fetched:', calls > 0, '| line:', await pg.textContent('.wxspray').catch(() => 'NONE'));
  await pg.goto('http://localhost:8765/#/sprayday'); await pg.waitForTimeout(600);
  console.log('page:', (await pg.$$eval('.spd', x => x.map(e => e.textContent.replace(/\s+/g, ' ')))).join(' | '));
  console.log('errs', errs); await b.close();
})();
