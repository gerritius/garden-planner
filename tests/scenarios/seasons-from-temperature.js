const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.goto('http://localhost:8765/'); await pg.waitForTimeout(400);
  console.log(await pg.evaluate(() => {
    const iv = [...Array(12)].map((_, i) => waterInterval(new Date(2026, i, 15))).join(' ');
    const cb = ['2026-11-18', '2027-01-10', '2027-03-01', '2027-05-10'].map(s => s + '→' + clearByFor({}, s, null)).join(', ');
    const fe = ['2026-03-01', '2026-08-25', '2026-09-20'].map(s => s + '→' + frostEnd({ cropId: 'potato', sowDate: s })).join(', ');
    const gw = ['2026-04-15', '2026-07-15', '2026-11-20', '2027-01-15'].map(s => s + ' carrot ' + JSON.stringify(germWindow({ cropId: 'carrot', method: 'seed', sowDate: s }))).join('\n');
    return `water interval Jan–Dec: ${iv}\nclear-by: ${cb}\npotato frost end: ${fe}\n${gw}`;
  }));
  console.log('errs', errs); await b.close();
})();
