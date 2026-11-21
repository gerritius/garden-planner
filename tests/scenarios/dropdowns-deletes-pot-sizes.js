const { newContext } = require('../lib');
// drop-downs everywhere, delete confirmations, fertiliser by pot size
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers = [20, 44, 80].map((v, i) => ({ id: 'p' + i, type: 'round', name: `Pot ${v} L`, diameter: Math.round(Math.sqrt(v * 1000 / (Math.PI * 35)) * 2), depth: 35, margin: 2, history: [{ cropId: 'kyuri', sowDate: '2026-05-01', harvestedOn: '2026-08-30', from: 0, to: 40 }], mixLog: [{ id: 'm' + i, date: '2026-03-01', kind: 'touikawa', fresh: false }] }));
    S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [] });
    S.customProducts = [{ id: 'cust_k', en: 'Kincho Liquid 6-6-7', form: 'liquid', kind: 'fert', npkv: [6, 6, 7], per: 5, doses: [5, 10], custom: true }];
    S.plantings = [{ id: 'le', containerId: 'p1', cropId: 'lettuce', method: 'seedling', layout: 'center', from: 0, to: 40, sowDate: '2026-11-01', status: 'active', photos: {}, series: [], harvests: [], fert: [] }];
    S.log = [{ id: 'lg', kind: 'fert', product: 'Chemical fertiliser 8-8-8', amount: 10, unit: 'g', date: '2026-11-10', cids: [], pids: ['le'] }];
    S.tasks = []; S.ownMigrated2 = true; await save();
  });
  console.log(await pg.evaluate(() => S.containers.filter(c => c.type !== 'bed').map(c => `${c.name}: base ${JSON.stringify(baseFertPlan('lettuce', c, 0, 40, todayStr()).map(f => f.amount + f.unit))} | Kincho 5 mL/5 L → ${(feedGrams(5, 'mL', 'Kincho Liquid 6-6-7', c) / 1.2).toFixed(1)} mL conc | lime@pH5.5 ${gramsFor(limeRate('lettuce', 5.5), c)} g`).join('\n')));
  // planting form: select → drop-down
  await pg.goto(U + '#/plant/new/b1?crop=lettuce'); await pg.waitForTimeout(500);
  await pg.click('#cropSel + .dd-field'); await pg.waitForTimeout(200);
  console.log('crop panel: search box', !!(await pg.$('.dd-panel .dd-search')), '| items', await pg.$$eval('.dd-panel .dd-item', x => x.length));
  await pg.fill('.dd-panel .dd-search', 'spin'); await pg.waitForTimeout(100);
  console.log('filtered:', await pg.$$eval('.dd-panel .dd-item', x => x.map(e => e.textContent)));
  await pg.click('.dd-panel .dd-item'); await pg.waitForTimeout(400);
  console.log('crop now', await pg.evaluate(() => draft.cropId), '| field shows', await pg.textContent('#cropSel + .dd-field'));
  await pg.screenshot({ path: `${SP}/dd_form.png` });
  // typed field with suggestions (variety)
  await pg.click('#pf [name=variety]'); await pg.waitForTimeout(200);
  console.log('variety panel items:', await pg.$$eval('.dd-panel .dd-item', x => x.map(e => e.textContent).slice(0, 3)));
  await pg.locator('.dd-panel .dd-item').first().click(); await pg.waitForTimeout(200);
  console.log('variety now', await pg.inputValue('#pf [name=variety]'), '| panel closed', !(await pg.$('.dd-panel')));
  // record feeding: product drop-down, unit follows
  await pg.goto(U + '#/plant/le'); await pg.waitForTimeout(400); await pg.click('[data-act=feedNow]'); await pg.waitForTimeout(300);
  console.log('feed dialog chip row gone:', !(await pg.$('#fdf .sowchips')));
  await pg.click('#fdf [name=product]'); await pg.waitForTimeout(200);
  await pg.click('.dd-panel .dd-item:has-text("Kincho")'); await pg.waitForTimeout(200);
  console.log('unit now', await pg.evaluate(() => document.querySelector('#fdf [name=unit]').value), '| unit field', await pg.textContent('#fdf [name=unit] + .dd-field'), '| hint', (await pg.textContent('#fdn')).slice(0, 120));
  await pg.locator('#modal .sheet').screenshot({ path: `${SP}/dd_feed.png` });
  await pg.click('#fdf [data-x=no]'); await pg.waitForTimeout(200);
  // delete asks first (a feeding record)
  await pg.evaluate(() => feedDialog(S.log[0])); await pg.waitForTimeout(250);
  await pg.click('#fdf [data-x=del]'); await pg.waitForTimeout(200);
  console.log('ask shown:', await pg.textContent('.delask').catch(() => 'NO'), '| still there:', await pg.evaluate(() => S.log.length));
  await pg.locator('#modal .sheet').screenshot({ path: `${SP}/delask.png` });
  await pg.click('.delask [data-k=no]'); await pg.waitForTimeout(100); console.log('after cancel:', await pg.evaluate(() => S.log.length));
  await pg.click('#fdf [data-x=del]'); await pg.waitForTimeout(150); await pg.click('.delask [data-k=yes]'); await pg.waitForTimeout(400);
  console.log('after delete:', await pg.evaluate(() => S.log.length), '| modal open', await pg.evaluate(() => !document.querySelector('#modal').hidden));
  // feeding plan: main fertiliser drop-down
  await pg.goto(U + '#/plant/le'); await pg.waitForTimeout(300); await pg.click('[data-act=addSideDress]'); await pg.waitForTimeout(500);
  console.log('plan main field:', await pg.textContent('#fpMainSel + .dd-field'), '| plenty tick', !!(await pg.$('#fpPlenty')));
  await pg.click('#fpMainSel + .dd-field'); await pg.waitForTimeout(150); await pg.locator('.dd-panel .dd-item').nth(1).click(); await pg.waitForTimeout(300);
  console.log('main now:', await pg.textContent('#fpMainSel + .dd-field'));
  await pg.click('#fpf [data-x=no]'); await pg.waitForTimeout(200);
  // log something: kind + product library
  await pg.evaluate(() => logDialog()); await pg.waitForTimeout(250);
  await pg.click('#lf [name=product]'); await pg.waitForTimeout(150);
  const opt = await pg.$$eval('.dd-panel .dd-item', x => x.map(e => e.textContent)); console.log('log product options:', opt.slice(0, 6), opt.length);
  await pg.click('.dd-panel .dd-item:has-text("Benica")').catch(() => pg.locator('.dd-panel .dd-item').first().click()); await pg.waitForTimeout(200);
  console.log('log kind →', await pg.evaluate(() => document.querySelector('#lf [name=kind]').value), '| productId', await pg.evaluate(() => document.querySelector('#lf [name=productId]').value));
  console.log('errs', errs); await b.close();
})();
