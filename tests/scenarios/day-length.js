// Day length from latitude and date (sunrise to sunset), the onion type that bulbs at each latitude (shown when planting
// onions), and long-day crops kept from maturing in very long days (London's midsummer) but not in Japan.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  console.log(await pg.evaluate(() => [['Tokyo', 35.7], ['Sapporo', 43.1], ['London', 51.5], ['Sydney', -33.9], ['Singapore', 1.35]].map(([n, lat]) =>
    `${n}: 21 Jun ${dayLength('2026-06-21', lat).toFixed(1)} h · 21 Dec ${dayLength('2026-12-21', lat).toFixed(1)} h · onions: ${onionType(lat)[0]}`).join('\n')));
  await pg.evaluate(async () => { S.weather = { lat: 51.5, lon: -0.12, name: 'London' }; S.containers = [{ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [], covers: [] }]; await save(); });
  await pg.goto(U + '#/plant/new/b1?crop=onion'); await pg.waitForTimeout(400);
  console.log('onion form (London):', await pg.evaluate(() => { const h = [...document.querySelectorAll('small.hint')].find(x => x.textContent.includes('For here')); return h ? h.textContent : '—'; }));
  console.log('lengthening 1 May / 1 Aug (London):', await pg.evaluate(() => [lengthening('2026-05-01'), lengthening('2026-08-01')].join(' / ')));
  console.log('errs', errs); await b.close();
})();
