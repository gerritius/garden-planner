const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers = [{ id: 'bk', type: 'round', name: 'Bucket', diameter: 40, depth: 35, margin: 2, history: [] }];
    S.plantings = []; S.tasks = []; await save();
  });
  await pg.goto(U + '#/plant/new/bk?crop=potato&date=2026-09-20'); await pg.waitForTimeout(500);
  console.log('form layout:', await pg.evaluate(() => draft.layout), 'harvest:', await pg.evaluate(() => draft.harvestDate));
  await pg.click('[data-act=method][data-v=seedling]'); await pg.waitForTimeout(300);
  console.log('as tubers, harvest:', await pg.evaluate(() => draft.harvestDate));
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(500);
  const p = await pg.evaluate(() => { const p = S.plantings[0]; const w = harvestWindow(p); return { hv: p.harvestDate, w, txt: harvestWindowText ? harvestWindowText(p) : '' }; });
  console.log(JSON.stringify(p));
  // the user's case: 4 seed potatoes in diamond
  await pg.evaluate(async () => { const p = S.plantings[0]; p.layout = 'diamond'; await save(); });
  await pg.goto(U + '#/container/bk'); await pg.waitForTimeout(400); await pg.locator('.plotwrap').first().screenshot({ path: `${SP}/potato4.png` });
  console.log('errs', errs); await b.close();
})();
