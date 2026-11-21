const { newContext } = require('../lib');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await (await newContext(b)).newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://localhost:8765/'); await pg.waitForTimeout(400);
  const r = await pg.evaluate(async () => {
    S.containers.push({ id: 'b1', type: 'bed', name: 'T', width: 100, length: 200, margin: 10 });
    const base = { containerId: 'b1', layout: 'staggered', from: 0, to: 200, rowSp: 45, status: 'active', photos: {}, series: [] };
    S.plantings.push(Object.assign({ id: 'hk', cropId: 'hakusai', method: 'seed', plantSp: 45, thinSp: 45, sowDate: '2026-09-10', thinDate: '2026-10-05', harvestDate: '2026-11-25', spread: 50, thinned: false }, base));
    S.plantings.push(Object.assign({ id: 'cb', cropId: 'cabbage', method: 'seedling', plantSp: 45, sowDate: '2026-09-10', harvestDate: '2026-11-25', spread: 45 }, base));
    await save();
    const t = todayStr(); return [Draw.radius(planting('hk'), t), Draw.radius(planting('cb'), t), Draw.radius(planting('hk'), '2026-09-20')];
  });
  console.log(r);
  await pg.goto('http://localhost:8765/#/plant/hk'); await pg.waitForTimeout(300);
  console.log((await pg.textContent('main')).match(/Size in drawing[^·]*/)?.[0]);
  console.log('errs', errs); await b.close();
})();
