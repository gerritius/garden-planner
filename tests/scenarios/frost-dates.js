// Frost dates from the daily lows in the 10-year records: the usual first and last frost (median), shown in Tools; frost-
// tender crops go out after the last and are done (or stop picking) by the first; autumn potatoes end at the first frost.
// A place where frost is rare gets no frost dates. (A made-up climate tile: a Denver-like place, lows 8 °C under the daily mean,
// each winter a little different.)
const { newContext, climateTile } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
const DEN = [0.0, 0.9, 5.0, 9.0, 14.0, 19.6, 23.5, 22.4, 17.6, 10.8, 4.4, -0.4], MILD = [12.5, 13, 14.5, 16.5, 19, 21.5, 24, 25, 23.5, 20.5, 17, 14];
const archive = (T, spread, shiftBy) => { const time = [], mean = [], min = [], p = [];
  for (let y = 2016; y <= 2025; y++) for (let m = 1; m <= 12; m++) { const n = new Date(y, m, 0).getDate();
    for (let d = 1; d <= n; d++) { const f = (d - 15) / 30, o = f >= 0 ? m % 12 : (m + 10) % 12, t = T[m - 1] + (T[o] - T[m - 1]) * Math.abs(f), sh = shiftBy((y * 7) % 5 - 2);
      time.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`); mean.push(t); min.push(+(t - spread + sh).toFixed(1)); p.push(1); } }
  return { daily: { time, temperature_2m_mean: mean, temperature_2m_min: min, precipitation_sum: p } }; };
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  let place = 'den';
  await ctx.route(u => /\/climate\/\d+_\d+\.bin$/.test(u.pathname), r => r.fulfill({ body: climateTile((place === 'den' ? archive(DEN, 8, s => s) : archive(MILD, 9.5, s => s * 1.5)).daily) }));
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => { S.plantings = []; S.tasks = []; S.containers = [{ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [], covers: [] }];
    S.weather = { lat: 39.74, lon: -104.99, name: 'Denver' }; delete S.climate; await save(); await ensureClimate(true); });
  console.log('frost:', JSON.stringify(await pg.evaluate(() => S.climate.frost)));
  const show = () => pg.evaluate(() => {
    const pot = d => harvestEstimate({ cropId: 'potato', sowDate: d, method: 'seed', containerId: 'b1', from: 0, to: 100 });
    return `first frost after 1 Aug ${firstFrostAfter('2026-08-01')} · frost-free 1 May ${frostFree('2026-05-01')}, 20 May ${frostFree('2026-05-20')}
  tomato ${crop('tomato').sow} · basil ${crop('basil').sow} · kyuri ${crop('kyuri').sow} · potato ${crop('potato').sow}
  potato planted 20 Jul: harvest ${pot('2026-07-20')} (before the frost) · planted 20 Apr: ${pot('2026-04-20')}`; });
  console.log('Denver:', await show());
  await pg.goto(U + '#/settings'); await pg.waitForTimeout(300);
  console.log('  Tools:', await pg.evaluate(() => { const r = document.querySelector('.climrow'); return r && r.parentElement.querySelector('p.small') ? r.parentElement.querySelector('p.small').textContent : '—'; }));
  // a mild place where frost only comes some winters: no frost dates
  place = 'mild';
  await pg.evaluate(async () => { S.weather = { lat: 33.6, lon: 130.4, name: 'Mild town' }; await save(); await ensureClimate(true); });
  console.log('mild:', JSON.stringify(await pg.evaluate(() => S.climate.frost)), '| has frost dates', await pg.evaluate(() => hasFrostDates()));
  await pg.goto(U + '#/settings'); await pg.waitForTimeout(300);
  console.log('  Tools:', await pg.evaluate(() => { const r = document.querySelector('.climrow'); return r && r.parentElement.querySelector('p.small') ? r.parentElement.querySelector('p.small').textContent : '—'; }));
  console.log('errs', errs); await b.close();
})();
