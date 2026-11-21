const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => { S.starts = []; delete S.nursery; await save(); });
  await pg.goto(U + '#/seedlings'); await pg.waitForTimeout(400);
  console.log('before:', (await pg.textContent('#view')).match(/Tray: [^.]*\./)[0]);
  await pg.click('[data-act=nursery]'); await pg.waitForTimeout(200);
  await pg.fill('#nuf [name=cells]', '72'); await pg.fill('#nuf [name=cols]', '12'); await pg.fill('#nuf [name=potCm]', '7.5'); await pg.click('#nuf button.primary'); await pg.waitForTimeout(400);
  console.log('after:', (await pg.textContent('#view')).match(/Tray: [^.]*\.[^.]*\./)[0], '| free in tray 1:', await pg.evaluate(() => trayFree(1)));
  await pg.goto(U + '#/container/new'); await pg.waitForTimeout(300); await pg.click('[data-act=preset]'); await pg.waitForTimeout(200);
  console.log('preset count:', await pg.inputValue('[name=count]').catch(() => '?'));
  console.log('errs', errs); await b.close();
})();
