const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.goto('http://localhost:8765/'); await pg.waitForTimeout(400);
  console.log(await pg.evaluate(() => ['2026-08-25', '2026-09-05', '2026-09-15', '2026-09-25', '2026-10-05', '2026-03-01'].map(sd => {
    const p = { id: 'x', cropId: 'potato', method: 'seed', sowDate: sd, containerId: null }; const m = harvestModel(p);
    return `${sd}: emerge ${emergeDate(p).d} need ${m.need.toFixed(0)} → harvest ${harvestEstimate(p)}`; }).join('\n')));
  console.log('errs', errs); await b.close();
})();
