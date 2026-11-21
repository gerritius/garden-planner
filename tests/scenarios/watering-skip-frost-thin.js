const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const pg = await (await newContext(b, { openFolds: true })).newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers.push({ id: 'g1', type: 'round', name: 'Bag 1', diameter: 40, depth: 35, margin: 2, history: [] });
    S.plantings.push({ id: 'kom', containerId: 'g1', cropId: 'komatsuna', method: 'seed', layout: 'continuous', from: 0, to: 40, rowSp: 15, plantSp: 1, sowDate: '2026-10-20', harvestDate: '2026-11-25', thinDate: '2026-11-01', thinSp: 5, spread: 15, status: 'active', photos: {}, series: [], harvests: [] });
    S.tasks.push({ id: 'fr', kind: 'frost', title: 'Cover before frost Thu (0°): Tomato', due: addDays(todayStr(), 1), frostDate: addDays(todayStr(), 1), cids: ['g1'], done: false });
    syncTasks(planting('kom')); await save();
  });
  await pg.goto(U + '#/'); await pg.waitForTimeout(400);
  const w = () => pg.evaluate(() => { const t = S.tasks.find(t => t.kind === 'water' && !t.group && !t.done); return t && t.due + ' ' + t.note; });
  console.log('water before', await w());
  await pg.screenshot({ path: SP + '/tasks.png' });
  const wid = await pg.evaluate(() => S.tasks.find(t => t.kind === 'water' && !t.group && !t.done).id);
  await pg.click(`.tmore[data-id="${wid}"]`); await pg.waitForTimeout(200); await pg.click('[data-x=skip]'); await pg.waitForTimeout(300);
  console.log('water after skip', await w());
  await pg.reload(); await pg.waitForTimeout(500); console.log('after reload', await w());
  console.log('frost exists', await pg.evaluate(() => S.tasks.some(t => t.id === 'fr'))); await pg.evaluate(() => taskDialog(S.tasks.find(t => t.id === 'fr'))); await pg.waitForTimeout(200); await pg.click('[data-x=del]'); await pg.waitForTimeout(300);
  console.log('frost gone', await pg.evaluate(() => !S.tasks.some(t => t.kind === 'frost')), await pg.evaluate(() => S.frostDismissed));
  const tid = await pg.evaluate(() => (S.tasks.find(t => t.kind === 'thin') || {}).id);
  await pg.goto(U + '#/plant/kom'); await pg.waitForTimeout(400); await pg.click(`.tmore[data-id="${tid}"]`); await pg.waitForTimeout(200); await pg.click('[data-x=del]'); await pg.waitForTimeout(300);
  await pg.click('[data-x=ok]'); await pg.waitForTimeout(300);
  console.log('thin gone', await pg.evaluate(() => !S.tasks.some(t => t.kind === 'thin')));
  console.log('errs', errs); await b.close();
})();
