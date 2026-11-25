const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b, { products: true }); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers = [{ id: 'g1', type: 'round', name: 'Bag 3', diameter: 40, depth: 35, margin: 2, history: [], mixLog: [{ date: '2026-03-01', kind: 'touikawa', fresh: false }] }];
    S.plantings = [{ id: 'ga', containerId: 'g1', cropId: 'garlic', method: 'seedling', layout: 'center', from: 0, to: 40, rowSp: 15, plantSp: 15, sowDate: '2026-10-10', harvestDate: '2027-05-15', status: 'active', photos: {}, series: [], harvests: [], fert: [{ product: 'Chemical fertiliser 8-8-8', amount: 130, unit: 'g' }] }];
    S.tasks = []; for (let d = '2026-10-10'; d < todayStr(); d = addDays(d, 3)) S.tasks.push({ id: uid(), kind: 'water', title: 'Water', due: d, done: true, doneOn: d });
    syncTasks(S.plantings[0]); await save();
  });
  await pg.goto(U + '#/plant/ga'); await pg.waitForTimeout(400);
  await pg.evaluate(() => document.querySelectorAll('section.feeding details').forEach(d => d.open = true));
  console.log('CARD:', (await pg.textContent('section.feeding')).replace(/\s+/g, ' '));
  await pg.locator('section.feeding').screenshot({ path: `${SP}/garlic_card.png` });
  await pg.click('[data-act=addSideDress]'); await pg.waitForTimeout(500);
  console.log('PLAN:', (await pg.textContent('#modal .sheet')).replace(/\s+/g, ' ').slice(0, 900));
  console.log('errs', errs); await b.close();
})();
