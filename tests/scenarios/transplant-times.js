// Every crop has its own time to planting out (and the sign it's ready), or says it isn't raised in trays — no
// stand-in figure. A crop of your own asks for its days; until then there's no plant-out date at all. Its growing
// temperatures come from the packet too: without them its dates count plain days, with them they follow the weather.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  console.log(await pg.evaluate(() => {
    const missing = CATALOG.filter(c => !TRANSPLANT[c.id]).map(c => c.id), notEnglish = Object.entries(TRANSPLANT).filter(([, v]) => /[　-鿿]/.test(v[1])).map(([k]) => k);
    const direct = CATALOG.filter(c => TRANSPLANT[c.id] && !TRANSPLANT[c.id][0]).map(c => c.en);
    return `crops without their own plant-out time: ${missing.join(', ') || 'none'} | signs not in English: ${notEnglish.join(', ') || 'none'} | not raised in trays: ${direct.join(', ')}`;
  }));
  console.log('spinach sown 15 Nov:', await pg.evaluate(() => ['out', 'cover', 'in'].map(k => `${k} ${startReady({ cropId: 'spinach', sowDate: '2026-11-15', kept: k })}`).join(', ')), '| sign:', await pg.evaluate(() => TRANSPLANT.spinach[1]));
  // a crop of your own
  await pg.evaluate(async () => { S.customCrops = [{ id: 'c_oka', en: 'Okahijiki', ja: 'おかひじき', color: '#7a9a5b', method: 'seed', layout: 'rows', depth: 1, rowSp: 20, sowSp: 5, daysHarvest: 40, spread: 20, varieties: [], family: 'other', germ: [5, 10] }];
    S.starts = [{ id: 'ok', status: 'growing', created: '2026-11-12T00:00:00Z', events: [], cropId: 'c_oka', kind: 'tray', nid: 'nt_tray', tray: 1, count: 10, sowDate: '2026-11-12', kept: 'out' }];
    syncStartTasks(start('ok')); await save(); });
  await pg.goto(U + '#/seedlings'); await pg.waitForTimeout(300);
  const card = () => pg.$eval('li.start', e => e.querySelectorAll('small')[1].textContent.replace(/\s+/g, ' '));
  console.log('without its days:', await card(), '| plant-out job:', await pg.evaluate(() => !!S.tasks.find(t => t.startId === 'ok' && t.kind === 'transplant')));
  await pg.click('[data-act=editStart]'); await pg.waitForTimeout(200);
  console.log('edit asks:', await pg.isVisible('#ownTpL'), '|', await pg.textContent('#tpHint'));
  await pg.fill('#sdf input[name=tpd]', '28'); await pg.dispatchEvent('#sdf input[name=tpd]', 'input');
  console.log('with 28 days:', await pg.textContent('#tpHint'));
  await pg.click('#sdf button.primary'); await pg.waitForTimeout(400);
  console.log('saved:', await pg.evaluate(() => S.customCrops[0].tpDays), '|', await card(), '| plant-out job:', await pg.evaluate(() => S.tasks.find(t => t.startId === 'ok' && t.kind === 'transplant')?.due));
  // its growing temperatures, from the packet (a warm-season crop: 20–30 °C), through "edit this crop"
  await pg.goto(U + '#/products?t=seeds'); await pg.waitForTimeout(300);
  console.log('seeds tab:', (await pg.$eval('[data-act=editCrop]', b => b.closest('section').textContent.replace(/\s+/g, ' ').trim())).slice(0, 160));
  await pg.click('[data-act=editCrop]'); await pg.waitForTimeout(200);
  await pg.selectOption('#ncf select[name=like]', 'spinach');   // (it has to say what it's like)
  await pg.fill('#ncf input[name=tempLo]', '20'); await pg.fill('#ncf input[name=tempHi]', '30'); await pg.click('#ncf button.primary'); await pg.waitForTimeout(300);
  console.log('crop now:', JSON.stringify(await pg.evaluate(() => { const c = S.customCrops[0]; return [c.tempLo, c.tempHi, c.tpDays, growParams(c.id)]; })));
  await pg.goto(U + '#/seedlings'); await pg.waitForTimeout(300);
  console.log('warm-season, sown in November:', await card());
  console.log('errs', errs); await b.close();
})();
