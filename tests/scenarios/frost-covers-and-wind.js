const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    const td = todayStr(), days = [-1,0,1,2,3,4,5,6].map(n => addDays(td, n));
    S.weather = { lat: 35, lon: 139, name: 'Test', fetched: Date.now(), daily: { time: days, weather_code: days.map(() => 3), temperature_2m_max: days.map(() => 12), temperature_2m_min: days.map((d, i) => i === 2 ? -1 : 4), precipitation_sum: days.map(() => 0), precipitation_probability_max: days.map(() => 5), wind_speed_10m_max: days.map(() => 30), wind_gusts_10m_max: days.map((d, i) => i === 3 ? 60 : 20) },
      hourly: { time: [], temperature_2m: [], precipitation: [], precipitation_probability: [], wind_speed_10m: [], wind_gusts_10m: [], soil_temperature_6cm: [] } };
    S.containers.push({ id: 'b1', type: 'bed', name: 'Bed 2', width: 100, length: 200, margin: 10, history: [] }, { id: 'g1', type: 'round', name: 'Bag 3', diameter: 40, depth: 35, margin: 2, history: [] });
    S.plantings.push({ id: 'hk', containerId: 'b1', cropId: 'hakusai', method: 'seed', layout: 'staggered', from: 0, to: 100, rowSp: 60, plantSp: 45, sowDate: '2026-09-01', harvestDate: '2026-12-05', spread: 50, status: 'active', thinned: true, photos: {}, series: [], harvests: [] });
    S.plantings.push({ id: 'sp', containerId: 'b1', cropId: 'snappea', method: 'seed', layout: 'rows', from: 100, to: 200, rowSp: 30, plantSp: 10, sowDate: '2026-11-01', harvestDate: '2027-04-10', spread: 30, status: 'active', photos: {}, series: [], harvests: [] });
    S.plantings.push({ id: 'lt', containerId: 'g1', cropId: 'lettuce', method: 'seedling', layout: 'center', from: 0, to: 40, rowSp: 25, plantSp: 25, sowDate: '2026-11-01', harvestDate: '2026-12-20', spread: 25, status: 'active', photos: {}, series: [], harvests: [] });
    await save();
  });
  await pg.goto(U + '#/container/b1'); await pg.waitForTimeout(300);
  await pg.click('[data-act=addCover]'); await pg.waitForTimeout(200); await pg.click('[data-sec="0,100"]'); await pg.click('#cvf button.primary'); await pg.waitForTimeout(300);
  await pg.screenshot({ path: SP + '/cover_bed.png' });
  console.log('frost before fleece', await pg.evaluate(() => frostRisk().map(x => x.hit.map(p => p.cropId))));
  await pg.goto(U + '#/container/g1'); await pg.waitForTimeout(300);
  await pg.click('[data-act=addCover]'); await pg.waitForTimeout(200); await pg.click('[data-t=fushokufu]'); await pg.click('#cvf button.primary'); await pg.waitForTimeout(300);
  console.log('frost after fleece', await pg.evaluate(() => frostRisk().map(x => x.hit.map(p => p.cropId))));
  console.log('wind advice', await pg.evaluate(() => { const t = S.tasks.find(t => t.kind === 'wx' && t.wx === 'wind'); return t ? wxAdvice(t) : 'no wind task'; }));
  await pg.evaluate(async () => { S.homeView = 'beds'; await save(); });   // (the bed cards)
  await pg.goto(U); await pg.waitForTimeout(400); await pg.screenshot({ path: SP + '/cover_home.png', fullPage: true });
  console.log('card chips', await pg.$$eval('.covchips', x => x.map(e => e.textContent.trim())));
  // finish hakusai -> net over nothing
  await pg.evaluate(async () => { planting('hk').status = 'harvested'; planting('hk').harvestedOn = addDays(todayStr(), -3); S.containers[0].covers[0].on = addDays(todayStr(), -20); await save(); });
  await pg.goto(U + '#/container/b1'); await pg.waitForTimeout(300);
  console.log('notes', await pg.$$eval('.banner.warn', x => x.map(e => e.textContent)));
  await pg.goto(U + '#/log'); await pg.waitForTimeout(300);
  console.log('log', (await pg.$$eval('.logi b', x => x.map(e => e.textContent))).slice(0, 3));
  console.log('errs', errs); await b.close();
})();
