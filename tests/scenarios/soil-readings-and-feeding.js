const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b, { products: true });
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers.push({ id: 'b1', type: 'bed', name: 'Bed 2', width: 100, length: 200, margin: 10, history: [] }, { id: 'g1', type: 'round', name: 'Bag 1', diameter: 40, depth: 35, margin: 2, history: [] });
    S.plantings.push({ id: 'hk', containerId: 'b1', cropId: 'hakusai', method: 'seed', layout: 'staggered', from: 0, to: 100, rowSp: 60, plantSp: 45, sowDate: '2026-09-01', harvestDate: '2026-12-05', status: 'active', thinned: true, photos: {}, series: [], harvests: [],
      fert: [{ product: 'Cow manure compost', amount: 2, unit: 'kg' }, { product: 'Oyster shell lime', amount: 150, unit: 'g' }, { product: 'Bokashi', amount: 200, unit: 'g' }] });
    S.log = [{ id: 'l1', date: '2026-10-05', kind: 'fert', product: 'Bokashi', amount: 40, unit: 'g', pids: ['hk'], cids: [] }, { id: 'l2', date: '2026-10-20', kind: 'fert', product: '化成肥料 8-8-8', amount: 2, unit: 'handful', cids: ['b1'], pids: [] }];
    await save();
  });
  await pg.goto(U + '#/container/b1'); await pg.waitForTimeout(300);
  await pg.click('[data-act=bedMore]'); await pg.waitForTimeout(150); await pg.click('[data-m=reading]'); await pg.waitForTimeout(200);
  await pg.click('[data-sec="0,100"]'); await pg.click('[data-seg=ph] [data-v="5.5"]'); await pg.click('[data-seg=salt] [data-v=DANGER]'); await pg.click('[data-seg=moistLvl] [data-v=DRY]'); await pg.fill('#srf input[name=temp]', '12'); await pg.click('#srf button.primary'); await pg.waitForTimeout(300);
  console.log('readings', await pg.$$eval('section', s => s.map(x => x.textContent.replace(/\s+/g, ' ')).find(t => t.startsWith('Soil readings'))));
  await pg.goto(U + '#/plant/hk'); await pg.waitForTimeout(300);
  const dl = (await pg.textContent('dl.details')).replace(/\s+/g, ' ');
  console.log('soil test:', dl.match(/Soil test.*?(?=Fed so far)/)?.[0]);
  console.log('fed:', dl.match(/Fed so far.*?\)/)?.[0]);
  console.log('new plan fert', JSON.stringify(await pg.evaluate(() => baseFertPlan('cabbage', container('b1'), 0, 100))), 'vs bag', JSON.stringify(await pg.evaluate(() => baseFertPlan('cabbage', container('g1'), 0, 40))));
  await pg.evaluate(() => taskDialog(S.tasks.find(t => t.kind === 'water' && !t.group) || { kind: 'water', note: '' })); await pg.waitForTimeout(200);
  console.log('errs', errs); await b.close();
})();
