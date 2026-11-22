const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const pg = await (await newContext(b, { viewport: { width: 400, height: 860 } })).newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10 });
    S.plantings.push({ id: 'hk', containerId: 'b1', cropId: 'hakusai', method: 'seed', layout: 'staggered', from: 0, to: 200, rowSp: 45, plantSp: 45, thinSp: 45, sowDate: '2026-08-30', thinDate: '2026-09-24', harvestDate: '2026-11-20', spread: 50, thinned: false, status: 'active', photos: {}, series: [] });
    syncTasks(planting('hk')); await save();
  });
  await pg.goto(U + '#/plant/hk'); await pg.waitForTimeout(300);
  const tid = await pg.evaluate(() => S.tasks.find(t => t.plantingId === 'hk' && t.kind === 'thin').id);
  await pg.check(`input[data-task="${tid}"]`); await pg.waitForTimeout(300);
  await pg.screenshot({ path: require('path').join(process.argv[2] || '.', 'when.png') });
  await pg.click('#modal [data-w]'); await pg.waitForTimeout(500);
  console.log('thin', await pg.evaluate(() => [planting('hk').thinDoneOn, Math.round(Draw.radius(planting('hk'), todayStr()) * 2)]));
  console.log((await pg.textContent('main')).match(/Size in drawing.*?\)/)?.[0]);
  // edit done date
  await pg.evaluate(id => taskDialog(S.tasks.find(t => t.id === id)), tid); await pg.waitForTimeout(200);
  await pg.fill('#tf input[name=due]', '2026-09-28'); await pg.click('#tf button.primary'); await pg.waitForTimeout(400);
  console.log('edited', await pg.evaluate(() => planting('hk').thinDoneOn));
  // germ task: tick → how many are up, and the day you looked
  const gid = await pg.evaluate(() => S.tasks.find(t => t.plantingId === 'hk' && t.kind === 'germ')?.id);
  if (gid) { await pg.click(`input[data-task="${gid}"]`); await pg.waitForTimeout(300); await pg.click('#gcf [data-pct="100"]'); await pg.fill('#gcf input[name=date]', '2026-09-03'); await pg.click('#gcf button.primary'); await pg.waitForTimeout(700);
    console.log('germ', await pg.evaluate(() => [planting('hk').germ.result, planting('hk').germ.date, S.tasks.find(t => t.kind === 'germ').doneOn, S.tasks.filter(t => t.kind === 'germ' && !t.done).length])); }
  // cancel path
  await pg.evaluate(async () => { S.tasks.push({ id: 'cx', plantingId: 'hk', kind: 'custom', title: 'Old job', due: '2026-10-01', done: false }); await save(); render(); });
  await pg.waitForTimeout(300); await pg.check('input[data-task="cx"]'); await pg.waitForTimeout(200); await pg.click('#wdf [data-x=no]'); await pg.waitForTimeout(400);
  console.log('cancel', await pg.evaluate(() => S.tasks.find(t => t.id === 'cx').done), await pg.isChecked('input[data-task="cx"]'));
  console.log('errs', errs); await b.close();
})();
