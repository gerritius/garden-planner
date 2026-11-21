const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => { S.containers = [{ id: 'b1', type: 'bed', name: 'Plot', width: 100, length: 200, margin: 10, history: [] }];
    const p = { id: 'cb', containerId: 'b1', cropId: 'cabbage', method: 'seedling', layout: 'staggered', from: 0, to: 200, rowSp: 45, plantSp: 45, sowDate: '2026-10-18', status: 'active', photos: {}, series: [], harvests: [], fert: [{ product: 'Chicken manure', amount: 4, unit: 'handful' }] };
    const d = { cropId: 'cabbage', sowDate: p.sowDate, method: 'seedling', containerId: 'b1', daysHarvest: crop('cabbage').daysHarvest }; recalc(d); p.harvestDate = d.harvestDate;
    S.plantings = [p]; S.tasks = []; S.plenty = ['chickenManure']; await save(); });
  await pg.goto(U + '#/plant/cb'); await pg.waitForTimeout(400);
  await pg.click('[data-act=addSideDress]'); await pg.waitForTimeout(600); await pg.click('#fpf button.primary'); await pg.waitForTimeout(500);
  console.log('saved:', JSON.stringify(await pg.evaluate(() => S.tasks.filter(t => t.kind === 'feed').map(t => [t.due, t.title.slice(0, 60)]))));
  console.log('card:', (await pg.textContent('section.feeding')).replace(/\s+/g, ' ').slice(0, 300));
  console.log('lean banner?', (await pg.textContent('section.feeding')).includes('planned in the lean stretch'));
  console.log('errs', errs); await b.close();
})();
