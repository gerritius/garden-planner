// Closing a pop-up takes its step in the back history back again, a moment later. When the app moves to another page in
// that moment (Save → the new planting, Delete → the bed), it stays there: the step back doesn't undo the move.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [] });
    S.plantings.push({ id: 'hk', cropId: 'hakusai', containerId: 'b1', from: 0, to: 100, layout: 'rows', rowSp: 40, plantSp: 30, method: 'seed', sowDate: '2026-09-10', status: 'active', photos: {}, series: [], harvests: [] });
    await save();
  });
  const where = () => pg.evaluate(() => location.hash);
  // the worst case, forced: the app moves on just after the step back has started, before it lands
  await pg.goto(U + '#/container/b1'); await pg.waitForTimeout(300);
  await pg.evaluate(() => { window.__ok = confirmBox('Go on?', 'OK'); });
  await pg.click('#modal [data-x=ok]');
  await pg.evaluate(async () => { await window.__ok; await new Promise(r => setTimeout(r, 0)); location.replace('#/plan'); });
  await pg.waitForTimeout(600);
  console.log('moved on while the step back was on its way:', await where());
  // deleting a planting: are you sure? → Delete → its bed
  await pg.goto(U + '#/container/b1'); await pg.waitForTimeout(300);
  await pg.goto(U + '#/plant/hk'); await pg.waitForTimeout(300);
  await pg.click('[data-act=del]'); await pg.waitForTimeout(200);
  await pg.click('#modal [data-x=ok]'); await pg.waitForTimeout(800);
  console.log('after deleting:', await where(), '| plantings left:', await pg.evaluate(() => S.plantings.length));
  // Back from there goes to the page before the planting (here the same bed), with no pop-up left behind
  await pg.goBack(); await pg.waitForTimeout(300);
  console.log('Back (to the page before the planting):', await where(), '| pop-up open:', await pg.evaluate(() => !document.querySelector('#modal').hidden));
  console.log('errs', errs); await b.close();
})();
