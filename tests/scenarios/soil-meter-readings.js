const { newContext } = require('../lib');
// soil meter readings used everywhere
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    const td = todayStr(), time = [], soil = [];
    for (let d = -3; d <= 6; d++) for (let h = 0; h < 24; h++) { time.push(addDays(td, d) + 'T' + String(h).padStart(2, '0') + ':00'); soil.push(9); }   // forecast: 9° all week
    S.weather = Object.assign(S.weather || {}, { lat: 35.7, lon: 139.4, fetched: Date.now(), hourly: { time, soil_temperature_6cm: soil, temperature_2m: soil.map(() => 10) }, daily: null });
    S.containers = [
      { id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [], soil: [{ id: 'r1', date: td, from: 0, to: 200, ph: 5.5, moistLvl: 'DRY', temp: 9 }] },
      { id: 'g1', type: 'round', name: 'Bag 1', diameter: 40, depth: 35, margin: 2, history: [], soil: [{ id: 'r2', date: td, from: 0, to: 40, ph: 6.5, temp: 14, salt: 'NOR', moistLvl: 'NOR' }] },
      { id: 'g2', type: 'round', name: 'Bag 2', diameter: 40, depth: 35, margin: 2, history: [], soil: [{ id: 'r3', date: td, from: 0, to: 40, salt: 'DANGER', moistLvl: 'WET' }] }];
    S.plantings = [{ id: 'le', containerId: 'g2', cropId: 'lettuce', method: 'seedling', layout: 'center', from: 0, to: 40, sowDate: '2026-11-01', status: 'active', photos: {}, series: [], harvests: [], fert: [] }];
    S.tasks = []; S.rainHist = {}; await save();
  });
  await pg.goto(U + '#/'); await pg.waitForTimeout(500);
  console.log('bed water job:', JSON.stringify(await pg.evaluate(() => S.tasks.filter(t => t.meterWater).map(t => [t.title, t.due]))));
  console.log('soil temp bag1:', JSON.stringify(await pg.evaluate(() => soilTempFor(container('g1'), 0, 40))), '| bed:', JSON.stringify(await pg.evaluate(() => soilTempFor(container('b1'), 0, 200))));
  console.log('germ carrot bag1 vs bed:', JSON.stringify(await pg.evaluate(() => [germWindow({ cropId: 'carrot', method: 'seed', sowDate: todayStr(), containerId: 'g1', from: 0, to: 40 }), germWindow({ cropId: 'carrot', method: 'seed', sowDate: todayStr(), containerId: 'b1', from: 0, to: 200 })])));
  await pg.goto(U + '#/plant/new/g1?crop=carrot'); await pg.waitForTimeout(500);
  console.log('form bag1:', await pg.evaluate(() => [soilLine('carrot', 'seed', container('g1'), 0, 40), draft.method, document.querySelectorAll('#pf .soil').length, [...document.querySelectorAll('#pf .soil')].map(e => e.outerHTML.slice(0, 120))]));
  await pg.goto(U + '#/plant/new/b1?crop=spinach'); await pg.waitForTimeout(500);
  console.log('form bed:', (await pg.textContent('#pf .soil').catch(() => '-')).replace(/\s+/g, ' '), '|', (await pg.textContent('#rotWarn')).replace(/\s+/g, ' ').slice(0, 160));
  await pg.goto(U + '#/plant/le'); await pg.waitForTimeout(500);
  console.log('feeding card:', (await pg.textContent('section.feeding')).replace(/\s+/g, ' ').slice(0, 220));
  await pg.goto(U + '#/container/b1'); await pg.waitForTimeout(400); await pg.click('[data-act=ideas]'); await pg.waitForTimeout(600);
  console.log('ideas bed:', (await pg.textContent('#modal .sheet')).replace(/\s+/g, ' ').slice(0, 900));
  console.log('errs', errs); await b.close();
})();
