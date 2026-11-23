// A crop of your own must say which crop it's most like, and then everything it doesn't give comes from that crop —
// spacing, sowing months, growth, time to planting out, care jobs, its icon — while what you give from the packet wins.
// Your data keeps only what you entered. Spray registrations never carry over (they're legal per crop).
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = [], said = []; pg.on('pageerror', e => errs.push(e.message));
  pg.on('dialog', d => { said.push(d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  // add tatsoi through the form: without "most like" it isn't saved
  await pg.evaluate(() => newCropDialog(() => {})); await pg.waitForTimeout(200);
  await pg.fill('#ncf input[name=en]', 'Tatsoi'); await pg.fill('#ncf input[name=ja]', 'ターサイ');
  await pg.evaluate(() => { document.querySelector('#ncf select[name=like]').required = false; });   // (past the browser's own check, to see the app's)
  await pg.click('#ncf button.primary'); await pg.waitForTimeout(200);
  console.log('without "most like":', said.pop(), '| saved:', await pg.evaluate(() => (S.customCrops || []).length));
  console.log('"most like" offers:', await pg.$$eval('#ncf select[name=like] optgroup', g => g.map(x => `${x.label.split(' (')[0]} ${x.children.length}`).join(', ')));
  await pg.selectOption('#ncf select[name=like]', 'komatsuna'); await pg.click('#ncf button.primary'); await pg.waitForTimeout(300);
  const id = await pg.evaluate(() => S.customCrops[0].id);
  console.log('stored (only what was entered):', await pg.evaluate(() => JSON.stringify(S.customCrops[0], (k, v) => k === 'id' ? 'ID' : v)));
  console.log('same as komatsuna:', JSON.stringify(await pg.evaluate(id => {
    const a = crop(id), k = crop('komatsuna'), same = f => JSON.stringify(f(a)) === JSON.stringify(f(k));
    const p = c => ({ cropId: c, sowDate: '2026-09-10', method: 'seed', containerId: null });
    return { spacing: same(c => [c.rowSp, c.sowSp, c.thinSp, c.layout, c.method]), family: same(c => c.family), sowMonths: same(c => c.sow), germ: same(c => c.germ),
      growth: JSON.stringify(growParams(id)) === JSON.stringify(growParams('komatsuna')), plantOut: JSON.stringify(transplantOf(id)) === JSON.stringify(transplantOf('komatsuna')),
      careJobs: JSON.stringify(careJobs(id)) === JSON.stringify(careJobs('komatsuna')), icon: ic(id) === ic('komatsuna').replace(k.color, a.color),
      harvest: harvestEstimate(p(id)) === harvestEstimate(p('komatsuna')) ? harvestEstimate(p(id)) : `${harvestEstimate(p(id))} vs ${harvestEstimate(p('komatsuna'))}` };
  }, id)));
  const regs = c => pg.evaluate(c => Object.keys(REGISTRATIONS).filter(k => regRows(k, c).length).length, c);
  console.log('sprays registered for it:', await regs(id), '| for komatsuna:', await regs('komatsuna'));
  // the packet says 45 days: that wins
  await pg.evaluate(async id => { const c = S.customCrops.find(x => x.id === id); c.daysHarvest = 45; await save(); }, id);
  console.log('own 45 days → harvest', await pg.evaluate(id => harvestEstimate({ cropId: id, sowDate: '2026-09-10', method: 'seed' }), id), 'vs komatsuna', await pg.evaluate(() => harvestEstimate({ cropId: 'komatsuna', sowDate: '2026-09-10', method: 'seed' })));
  // an older crop of your own, not linked: flagged, and linking it drops the stand-in values it was given
  await pg.evaluate(async () => { S.customCrops.push({ id: 'c_old', en: 'Okahijiki', ja: 'おかひじき', color: '#7a9a5b', method: 'seed', layout: 'rows', depth: 1, rowSp: 20, sowSp: 5, thinStage: '', thinSp: null, daysThin: null, daysHarvest: 40, spread: 25, varieties: [], family: 'other' }); await save(); });
  await pg.goto(U + '#/products?t=seeds'); await pg.waitForTimeout(300);
  console.log('seeds tab:', (await pg.$$eval('[data-act=editCrop]', x => x.map(b => b.closest('section').querySelector('h3').textContent.replace(/\s+/g, ' ').trim() + ' — ' + (b.parentElement.querySelector('small.warn') || { textContent: 'linked' }).textContent.trim()))).join(' | '));
  await pg.click('[data-act=editCrop][data-id=c_old]'); await pg.waitForTimeout(200);
  await pg.selectOption('#ncf select[name=like]', 'spinach'); await pg.click('#ncf button.primary'); await pg.waitForTimeout(300);
  console.log('linked:', await pg.evaluate(() => JSON.stringify(S.customCrops.find(c => c.id === 'c_old'))), '| row spacing now', await pg.evaluate(() => crop('c_old').rowSp), '(spinach', await pg.evaluate(() => crop('spinach').rowSp) + ')');
  console.log('errs', errs); await b.close();
})();
