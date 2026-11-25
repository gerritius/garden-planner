const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers.push({ id: 'g1', type: 'round', name: 'Bag sun', diameter: 40, depth: 35, margin: 2, history: [], sun: 'full' }, { id: 'g2', type: 'round', name: 'Bag shade', diameter: 40, depth: 35, margin: 2, history: [], sun: 'shade' }, { id: 'p9', type: 'round', name: 'Small pot', diameter: 15, depth: 12, margin: 1, history: [], sun: 'full' });
    const mk = (id, cid, extra) => Object.assign({ id, containerId: cid, cropId: 'komatsuna', method: 'seed', layout: 'continuous', from: 0, to: 40, rowSp: 15, plantSp: 3, thinSp: 5, thinStage: 'At 3–4 true leaves', sowDate: '2026-11-10', status: 'active', photos: {}, series: [], harvests: [] }, extra || {});
    S.plantings.push(mk('a', 'g1'), mk('b', 'g2'), mk('c', 'p9'));
    for (const p of S.plantings) syncTasks(p); await save();
  });
  await pg.goto(U); await pg.waitForTimeout(400);
  const show = l => pg.evaluate(l => ({ l, v: S.plantings.map(p => `${container(p.containerId).name}: thin ${p.thinDate} harvest ${p.harvestDate}`) }), l);
  console.log(JSON.stringify(await show('initial')));
  // hot swap: shade bag indoors via the page chip
  await pg.goto(U + '#/container/g2'); await pg.waitForTimeout(300);
  console.log('chip', await pg.textContent('[data-act=climate]'));
  await pg.click('[data-act=climate]'); await pg.waitForTimeout(200); await pg.click('[data-io=in]'); await pg.waitForTimeout(400);
  await pg.click('[data-x=ok]'); await pg.waitForTimeout(300);
  console.log(JSON.stringify(await show('shade bag moved indoors')));
  console.log('water pots', await pg.evaluate(() => waterPots().map(c => c.name)));
  // learning: three past komatsuna that came up and were picked late
  await pg.evaluate(async () => {
    S.containers.push({ id: 'b1', type: 'bed', name: 'Bed old', width: 100, length: 200, margin: 10, history: [] });
    for (const [i, sd] of ['2026-09-01', '2026-09-20', '2026-10-05'].entries()) {
      const p = { id: 'h' + i, containerId: 'b1', cropId: 'komatsuna', method: 'seed', layout: 'rows', from: i * 60, to: i * 60 + 50, rowSp: 15, plantSp: 3, thinSp: 5, sowDate: sd, status: 'harvested', photos: {}, series: [], harvests: [] };
      p.germ = { result: 'good', date: addDays(sd, 5) };
      const est = harvestEstimate(Object.assign({}, p, { status: 'active' }));
      p.harvests = [{ id: 'x' + i, date: addDays(est, 10), count: 5 }]; p.harvestedOn = addDays(est, 20);
      S.plantings.push(p);
    }
    await save();
  });
  await pg.goto(U + '#/settings'); await pg.waitForTimeout(400);
  console.log('learned', (await pg.$$eval('section', s => s.map(x => x.textContent.replace(/\s+/g, ' ')).find(t => t.startsWith('Learned')))) );
  await pg.goto(U); await pg.waitForTimeout(400);
  console.log(JSON.stringify(await show('after learning')));
  // leaf count on the sun bag
  await pg.goto(U + '#/plant/a'); await pg.waitForTimeout(300);
  await pg.click('[data-act=leaves]'); await pg.waitForTimeout(200); await pg.fill('#lvf input[name=n]', '2'); await pg.click('#lvf button.primary'); await pg.waitForTimeout(400);
  console.log('after 2 leaves today', await pg.evaluate(() => planting('a').thinDate), '|', (await pg.textContent('dl.details')).match(/Thinning.*?update/)?.[0]);
  console.log('errs', errs); await b.close();
})();
