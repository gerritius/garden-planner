const { newContext } = require('../lib');
// Tools merges
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U + '#/settings'); await pg.waitForTimeout(400);
  console.log('tiles:', (await pg.$$eval('.tiles .tile', x => x.map(e => e.textContent.trim()))).join(' | '));
  await pg.click('a[href="#/sprayday"]'); await pg.waitForTimeout(400); await pg.screenshot({ path: `${SP}/tabs.png` });
  await pg.click('[data-r=picksafe]'); await pg.waitForTimeout(300);
  console.log('on', pg.url().split('#')[1]);
  await pg.goBack(); await pg.waitForTimeout(300); console.log('back →', pg.url().split('#')[1]);
  await pg.goto(U + '#/products'); await pg.waitForTimeout(300); console.log('products has tabs?', !!(await pg.$('.seg.tabs')));
  for (const r of ['spend', 'totals', 'review', 'compare']) { await pg.goto(U + '#/' + r); await pg.waitForTimeout(300); console.log(r, await pg.textContent('.seg.tabs .on')); }
  await pg.goto(U + '#/'); await pg.waitForTimeout(300); console.log('home has tabs?', !!(await pg.$('.seg.tabs')));
  console.log('errs', errs); await b.close();
})();
