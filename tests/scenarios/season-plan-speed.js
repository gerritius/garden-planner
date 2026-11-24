const { newContext } = require('../lib');
// time the season plan with a realistic garden (12 bags, 2 plots, ~20 plantings)
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers = []; S.plantings = []; S.tasks = [];
    const crops = ['garlic', 'celery', 'snappea', 'lettuce', 'komatsuna', 'potato', 'spinach', 'mizuna', 'kabu', 'onion', 'chingensai', 'shungiku'];
    for (let i = 0; i < 12; i++) {
      S.containers.push({ id: 'g' + i, type: 'round', name: 'Bag ' + (i + 1), diameter: 40, depth: 35, margin: 2, history: [{ cropId: ['kyuri', 'tomato', 'nasu', 'edamame'][i % 4], sowDate: '2026-05-01', harvestedOn: '2026-08-30', from: 0, to: 40 }] });
      if (i < 9) S.plantings.push({ id: 'p' + i, containerId: 'g' + i, cropId: crops[i], method: 'seedling', layout: 'center', from: 0, to: 40, rowSp: 20, plantSp: 20, sowDate: '2026-10-' + String(5 + i).padStart(2, '0'), status: 'active', photos: {}, series: [], harvests: [], fert: [] });
    }
    S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [{ cropId: 'tomato', sowDate: '2026-05-01', harvestedOn: '2026-08-20', from: 0, to: 200 }] });
    S.containers.push({ id: 'b2', type: 'bed', name: 'Plot B', width: 100, length: 200, margin: 10, history: [] });
    S.plantings.push({ id: 'dk', containerId: 'b1', cropId: 'daikon', method: 'seed', layout: 'rows', from: 0, to: 200, rowSp: 30, plantSp: 25, sowDate: '2026-09-10', status: 'active', photos: {}, series: [], harvests: [] });
    S.plantings.push({ id: 'cb', containerId: 'b2', cropId: 'cabbage', method: 'seedling', layout: 'staggered', from: 0, to: 100, rowSp: 45, plantSp: 45, sowDate: '2026-10-18', status: 'active', photos: {}, series: [], harvests: [] });
    S.plantings.push({ id: 'hk', containerId: 'b2', cropId: 'hakusai', method: 'seedling', layout: 'staggered', from: 100, to: 200, rowSp: 45, plantSp: 45, sowDate: '2026-09-05', status: 'active', photos: {}, series: [], harvests: [] });
    S.plantings.forEach(p => { const d = { cropId: p.cropId, sowDate: p.sowDate, method: p.method, containerId: p.containerId, daysHarvest: crop(p.cropId).daysHarvest }; recalc(d); p.harvestDate = d.harvestDate; syncTasks(p); });
    await save();
  });
  for (const h of ['#/plan', '#/rotation', '#/', '#/container/b2']) {
    await pg.goto(U + '#/settings'); await pg.waitForTimeout(300);
    const t = await pg.evaluate(async h => { const t0 = performance.now(); location.hash = h; await new Promise(r => setTimeout(r, 0)); return performance.now() - t0; }, h);
    await pg.waitForTimeout(300);
    console.log(h, Math.round(t), 'ms');
  }
  await pg.goto(U + '#/plan');
  // (ideas fill in after the page shows; wait for them rather than a fixed time — under load 3 s wasn't always enough)
  await pg.waitForFunction(() => !document.querySelector('.gaps .chip.muted'), null, { timeout: 15000 }).catch(() => {});
  console.log('plan chips filled:', await pg.$$eval('.gaps .gap', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 90))).then(a => a.slice(0, 3)), '| placeholders left', await pg.$$eval('.gaps .chip.muted', x => x.length));
  await pg.goto(U + '#/settings'); await pg.waitForTimeout(300);
  console.log('plan again (cached):', Math.round(await pg.evaluate(async () => { const t0 = performance.now(); location.hash = '#/plan'; await new Promise(r => setTimeout(r, 0)); return performance.now() - t0; })), 'ms');
  await pg.goto(U + '#/rotation'); await pg.waitForTimeout(300); await pg.screenshot({ path: process.argv[2] + '/rotation.png', fullPage: true });
  // profile the plan page's parts
  console.log(await pg.evaluate(() => {
    const out = [], time = (l, f) => { const t0 = performance.now(); f(); out.push(`${l} ${Math.round(performance.now() - t0)} ms`); };
    time('freeGaps ×14', () => S.containers.forEach(c => freeGaps(c)));
    time('gapLi (ideas) ×14', () => S.containers.forEach(c => freeGaps(c).forEach(g => gapLi(c, g))));
    time('cropIdeas one bag', () => cropIdeas(S.containers[9], 0, 40, todayStr(), '2027-04-30'));
    time('feedSim ×all', () => S.plantings.forEach(p => feedSim(p, feedLedger(p))));
    return out.join('\n');
  }));
  console.log('errs', errs); await b.close();
})();
