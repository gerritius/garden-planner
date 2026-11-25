// The bee warning works from a general list of bee-harmful insecticide ingredients (English and Japanese names and
// common brands), checked against any product's name, details and registry entry — not a few hard-coded products.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b, { products: true }); const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  console.log(await pg.evaluate(() => [
    ...libList('spray').map(p => `${p.en}: ${beeHarm(p).map(h => `${h.name} (${h.kind})`).join(', ') || '—'}`),
    'your own, by ingredient (fenitrothion emulsion): ' + beeHarm({ en: 'Garden insect killer', what: 'fenitrothion 50%' }).map(h => h.name).join(', '),
    'your own, by ingredient (cypermethrin): ' + beeHarm({ en: 'Garden cypermethrin spray' }).map(h => h.name).join(', '),
    'not fooled by "spinach" (NAC is carbaryl): ' + (beeHarm({ en: 'Spinach booster', what: 'seaweed extract' }).length === 0),
  ].join('\n')));
  await pg.evaluate(async () => { S.weather = { lat: 35.75, lon: 139.42, name: 'Here' }; await save(); });
  await pg.goto(U + '#/sprayday'); await pg.waitForTimeout(400);
  console.log('spray days page:', (await pg.textContent('#view')).replace(/\s+/g, ' ').match(/Many insecticides harm bees[^]*?\.\s*Of your sprays:[^]*?\)\./)[0].slice(0, 600));
  console.log('errs', errs); await b.close();
})();
