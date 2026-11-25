const { newContext } = require('../lib');
// simplified planting form
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b, { products: true }); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => { S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [] }); await save(); });
  await pg.goto(U + '#/plant/new/b1?crop=hakusai'); await pg.waitForTimeout(500);
  console.log('more open?', await pg.evaluate(() => $('#pfMore').open), '| summary:', await pg.textContent('#pfMore summary'));
  await pg.screenshot({ path: `${SP}/pf_short.png`, fullPage: true });
  await pg.click('#pfMore summary'); await pg.waitForTimeout(200);
  await pg.selectOption('[name=layout]', 'rows'); await pg.waitForTimeout(300);   // forces a re-render
  console.log('still open after re-render?', await pg.evaluate(() => $('#pfMore').open));
  await pg.fill('[name=plantSp]', '40'); await pg.fill('[name=notes]', 'test note');
  await pg.click('#pfMore summary'); await pg.waitForTimeout(100);
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(600);
  const p = await pg.evaluate(() => { const x = S.plantings[S.plantings.length - 1]; return x && { crop: x.cropId, layout: x.layout, sp: x.plantSp, notes: x.notes, more: x._more, fert: (x.fert || []).length, tasks: S.tasks.filter(t => t.plantingId === x.id).length }; });
  console.log('saved', JSON.stringify(p), pg.url().split('#')[1]);
  console.log('errs', errs); await b.close();
})();
