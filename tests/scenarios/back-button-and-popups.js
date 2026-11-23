const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers.push({ id: 'g1', type: 'round', name: 'Bag 5', diameter: 40, depth: 35, margin: 2, history: [] });
    S.plantings.push({ id: 'ce', containerId: 'g1', cropId: 'celery', method: 'seedling', layout: 'center', from: 0, to: 40, rowSp: 20, plantSp: 20, sowDate: '2026-09-15', status: 'active', photos: {}, series: [], harvests: [], fert: [{ product: '化成肥料 8-8-8', amount: 120, unit: 'g' }] });
    S.starts = [{ id: 'st', cropId: 'lettuce', kind: 'tray', tray: 1, count: 5, sowDate: '2026-10-20', status: 'growing', events: [], created: '1' }];
    S.tasks.push({ id: 'cj', plantingId: 'ce', kind: 'custom', title: 'Tie up stems', due: '2026-11-20', done: false });
    syncTasks(S.plantings[0]); await save();
  });
  const where = async l => console.log(l, '→', pg.url().split('#')[1] || '/', '| modal open:', await pg.evaluate(() => !document.querySelector('#modal').hidden));
  await pg.goto(U + '#/container/g1'); await pg.waitForTimeout(300);
  await pg.click('a[href="#/plant/ce"]'); await pg.waitForTimeout(300); await where('crop page');
  await pg.click('[data-act=addSideDress]'); await pg.waitForTimeout(400); await where('feeding plan open');
  await pg.goBack(); await pg.waitForTimeout(300); await where('after Back');
  await pg.click('[data-act=addSideDress]'); await pg.waitForTimeout(400); await pg.click('#fpf [data-x=no]'); await pg.waitForTimeout(300); await where('after Cancel');
  await pg.goBack(); await pg.waitForTimeout(300); await where('after one Back');
  // chained: task dialog -> delete -> confirm
  await pg.goto(U + '#/plant/ce'); await pg.waitForTimeout(300);
  await pg.click('.tmore[data-id="cj"]'); await pg.waitForTimeout(200); await pg.click('[data-x=del]'); await pg.waitForTimeout(200);
  await where('confirm open'); await pg.click('[data-x=ok]'); await pg.waitForTimeout(400);
  console.log('task deleted:', await pg.evaluate(() => !S.tasks.some(t => t.id === 'cj'))); await where('after delete');
  // modal that navigates: plant out from seedlings
  await pg.goto(U + '#/seedlings'); await pg.waitForTimeout(300); await pg.click('[data-act=replant]'); await pg.waitForTimeout(200);
  await pg.click('[data-c=g1]'); await pg.waitForTimeout(500); await where('plant-out navigated');
  console.log('errs', errs); await b.close();
})();
