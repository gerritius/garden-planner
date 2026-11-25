const { newContext } = require('../lib');
// Kincho as own product: 5/10 mL per 5 L
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b, { products: true }); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.ownMigrated2 = false; S.customProducts = [];
    S.containers = [{ id: 'g1', type: 'round', name: 'Bag 1', diameter: 40, depth: 35, margin: 2, history: [], mixLog: [{ id: 'm', date: '2026-03-01', kind: 'touikawa', fresh: false }] }];
    S.plantings = [{ id: 'le', containerId: 'g1', cropId: 'lettuce', method: 'seedling', layout: 'center', from: 0, to: 40, rowSp: 20, plantSp: 20, sowDate: '2026-11-01', status: 'active', photos: {}, series: [], harvests: [], fert: [],
      feedPlan: [{ id: 'fp', product: 'Kincho Liquid 6-6-7', amount: 5, unit: 'mL', every: 7, start: '2026-11-10', end: '2027-01-20' }] }];
    S.log = [{ id: 'l1', kind: 'fert', product: 'Kincho liquid 6-6-7', amount: 10, unit: 'mL', date: '2026-11-10', cids: ['g1'], pids: [] }];
    S.tasks = []; delete S.dataVersion; await save();
  });
  await pg.reload(); await pg.waitForTimeout(500);   // an old-format save is brought up to date when the app loads it
  await pg.goto(U + '#/plant/le'); await pg.waitForTimeout(500);
  console.log('custom:', JSON.stringify(await pg.evaluate(() => S.customProducts)));
  console.log('log renamed:', await pg.evaluate(() => S.log[0].product));
  await pg.evaluate(async () => { const x = libList().find(p => /kincho/i.test(p.en)); x.per = 5; x.doses = [5, 10]; await save(); });
  console.log('counted:', JSON.stringify(await pg.evaluate(() => feedLedger(planting('le')).lines.filter(l => l.g === 'fed').map(l => [l.label, +l.n.toFixed(3)]))));
  console.log('grams 5 mL:', await pg.evaluate(() => feedGrams(5, 'mL', 'Kincho Liquid 6-6-7').toFixed(2)), '| N:', await pg.evaluate(() => usable3(feedGrams(5, 'mL', 'Kincho Liquid 6-6-7'), 'Kincho Liquid 6-6-7').n.toFixed(3)));
  console.log('card:', (await pg.textContent('section.feeding')).replace(/\s+/g, ' ').slice(0, 260));
  await pg.evaluate(() => feedDialog({ pids: ['le'] })); await pg.waitForTimeout(200);
  await pg.fill('#fdf [name=product]', 'Kincho Liquid 6-6-7'); await pg.dispatchEvent('#fdf [name=product]', 'input'); await pg.waitForTimeout(150);
  await pg.press('#fdf [name=product]', 'Escape'); await pg.waitForTimeout(100);   // close the suggestions, as you would before tapping a dose
  await pg.click('#fdd [data-dose="10"]'); await pg.waitForTimeout(150);
  console.log('dialog:', (await pg.textContent('#fdd')).trim(), '|', await pg.textContent('#fdn'));
  await pg.locator('#modal .sheet').screenshot({ path: `${SP}/kincho_dlg.png` });
  await pg.click('#fdf [data-x=no]'); await pg.waitForTimeout(200);
  console.log('dose for 0.15 g N:', JSON.stringify(await pg.evaluate(() => doseOf('Kincho Liquid 6-6-7', 0.15, true))), JSON.stringify(await pg.evaluate(() => doseOf('Kincho Liquid 6-6-7', 0.4, true))));
  await pg.goto(U + '#/products'); await pg.waitForTimeout(400);
  console.log('own section:', (await pg.textContent('section')).replace(/\s+/g, ' ').slice(0, 200));
  await pg.goto(U + '#/product/' + await pg.evaluate(() => libList().find(p => /kincho/i.test(p.en)).id)); await pg.waitForTimeout(300); await pg.click('[data-act=editProd]'); await pg.waitForTimeout(200); await pg.locator('#modal .sheet').screenshot({ path: `${SP}/own_dlg.png` });
  await pg.click('#pdf [data-x=no]').catch(() => {}); await pg.waitForTimeout(200);
  console.log('errs', errs); await b.close();
})();
