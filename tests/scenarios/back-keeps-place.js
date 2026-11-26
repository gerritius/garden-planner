// Going back returns to where you were on the page: scroll down the garden, open a bag, go back — you're where you were.
// A page opened anew starts at the top, and the same page visited twice keeps each visit's own place.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers = Array.from({ length: 14 }, (_, i) => ({ id: 'g' + i, type: 'round', name: 'Bag ' + (i + 1), diameter: 40, depth: 35, margin: 2, history: [] }));
    S.plantings = []; S.tasks = []; await save();
  });
  await pg.goto(U + '#/'); await pg.waitForTimeout(500);
  const y = () => pg.evaluate(() => Math.round(scrollY));
  await pg.evaluate(() => document.querySelector('a.ptile[href="#/container/g11"]').scrollIntoView({ block: 'center' })); await pg.waitForTimeout(200);
  const y0 = await y();
  console.log('scrolled down the garden:', y0 > 300);
  await pg.click('a.ptile[href="#/container/g11"]'); await pg.waitForTimeout(500);
  console.log('bag page opens at the top:', (await y()) === 0, '|', await pg.textContent('#title'));
  await pg.click('#back'); await pg.waitForTimeout(600);
  console.log('back: same place on the garden page:', Math.abs((await y()) - y0) <= 2);
  // the same again with the phone's own back (the bag page scrolled a little meanwhile)
  await pg.click('a.ptile[href="#/container/g11"]'); await pg.waitForTimeout(500);
  await pg.evaluate(() => window.scrollTo(0, 150)); await pg.waitForTimeout(100);
  await pg.goBack(); await pg.waitForTimeout(600);
  console.log('phone back: same place again:', Math.abs((await y()) - y0) <= 2);
  // a new visit to the garden page (from the tab bar) starts at the top
  await pg.goto(U + '#/settings'); await pg.waitForTimeout(400);
  await pg.click('#tabs a[data-tab=home]'); await pg.waitForTimeout(500);
  console.log('garden opened anew from the tabs: at the top:', (await y()) === 0);
  console.log('errs', errs); await b.close();
})();
