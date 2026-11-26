// Watering jobs for every kind of crop — pots & bags, each bed in the ground (which holds far more water), indoor pots
// and seedlings — and they follow the latest forecast: when it changes (say Friday's 23 mm becomes 3 mm), so do they.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
// a forecast like Open-Meteo's: 7 days back and 7 ahead from Wed 18 Nov 2026, rain as given (mm by date)
function forecast(rain) {
  const days = [], hours = [];
  for (let i = -7; i < 7; i++) { const d = new Date(Date.UTC(2026, 10, 18 + i)); days.push(d.toISOString().slice(0, 10)); }
  for (const d of days) for (let h = 0; h < 24; h++) hours.push(`${d}T${String(h).padStart(2, '0')}:00`);
  const n = days.length, hn = hours.length;
  return { daily: { time: days, weather_code: days.map(d => rain[d] ? 61 : 1), temperature_2m_max: Array(n).fill(16), temperature_2m_min: Array(n).fill(7),
    precipitation_sum: days.map(d => rain[d] || 0), precipitation_probability_max: days.map(d => rain[d] ? 80 : 10), wind_speed_10m_max: Array(n).fill(8), wind_gusts_10m_max: Array(n).fill(20) },
  hourly: { time: hours, temperature_2m: Array(hn).fill(11), precipitation: Array(hn).fill(0), precipitation_probability: Array(hn).fill(10), wind_speed_10m: Array(hn).fill(8), wind_gusts_10m: Array(hn).fill(15), soil_temperature_6cm: Array(hn).fill(12), relative_humidity_2m: Array(hn).fill(70) } };
}
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); const errs = [];
  let served = forecast({ '2026-11-20': 23, '2026-11-21': 15 });
  await ctx.route(u => u.hostname === 'api.open-meteo.com', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(served) }));
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [] }, { id: 'b2', type: 'bed', name: 'Plot B', width: 100, length: 200, margin: 10, history: [] },
      { id: 'g1', type: 'round', name: 'Bag 1', diameter: 40, depth: 35, margin: 2, history: [] }, { id: 'in1', type: 'round', name: 'Kitchen pot', diameter: 20, depth: 18, margin: 2, history: [], indoor: true });
    const P = (id, cid, cropId, sowDate, method = 'seedling') => ({ id, cropId, containerId: cid, from: 0, to: cid === 'b1' || cid === 'b2' ? 200 : 40, layout: 'center', plantSp: 30, method, sowDate, status: 'growing', photos: {}, series: [], harvests: [] });
    S.plantings.push(P('p1', 'b1', 'cabbage', '2026-09-20'), P('p2', 'b2', 'spinach', '2026-11-12', 'seed'), P('p3', 'g1', 'lettuce', '2026-10-20'), P('p4', 'in1', 'basil', '2026-10-01'));
    S.starts = [{ id: 'st', cropId: 'hakusai', kind: 'tray', tray: 1, count: 10, sowDate: '2026-11-10', kept: 'in', status: 'growing', events: [], created: '1' }];
    S.water = { lastDone: '2026-11-18', last: { 'bed:b1': '2026-11-10', 'bed:b2': '2026-11-16' } };
    S.weather = { lat: 35.75, lon: 139.42, name: 'Higashiyamato' };
    await save();
  });
  const jobs = () => pg.evaluate(() => S.tasks.filter(t => t.kind === 'water' && !t.done).map(t => `${t.title}: ${t.due} — ${t.note}`).sort().join('\n  '));
  await pg.goto(U + '#/plant/p1'); await pg.waitForTimeout(1800);   // not the home page: the forecast is fetched anyway
  console.log('with the first forecast (Fri 23 mm, Sat 15 mm):\n  ' + await jobs());
  // the forecast changes; a few hours later the app (here: coming back to the front) fetches it again
  served = forecast({ '2026-11-20': 3 });
  await pg.evaluate(() => { S.weather.fetched -= 4 * 3600e3; });
  await pg.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await pg.waitForTimeout(1500);
  console.log('after the forecast changed to Fri 3 mm, Sat 0 mm:\n  ' + await jobs());
  // ticking one bed's job only marks that bed as watered
  const id = await pg.evaluate(() => S.tasks.find(t => t.group === 'bed:b1' && !t.done).id);
  await pg.evaluate(i => toggleTask(i, true), id); await pg.waitForTimeout(300);
  console.log('ticked Plot A:', await pg.evaluate(() => JSON.stringify({ lastDone: S.water.lastDone, last: S.water.last })), '\n  ' + await jobs());
  await pg.evaluate(i => toggleTask(i, false), id); await pg.waitForTimeout(300);
  console.log('unticked:', await pg.evaluate(() => JSON.stringify(S.water.last)), '| Plot B job still there:', await pg.evaluate(() => S.tasks.some(t => t.group === 'bed:b2' && !t.done)));
  // a bed's job opens with the soil explanation
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(() => taskDialog(S.tasks.find(t => t.group === 'bed:b2' && !t.done))); await pg.waitForTimeout(200);
  console.log('Plot B dialog:', (await pg.textContent('#modal .hint')).slice(0, 140), '| rain table rows:', await pg.$$eval('#modal table tr', x => x.length - 1));
  console.log('errs', errs); await b.close();
})();
