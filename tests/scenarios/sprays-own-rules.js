// Sprays carry the rules you enter from their labels — crops, days to wait before picking, most sprays a season — and
// the app looks nothing up. A garden from before (sprays with Japan's register data) keeps its sprays with those rules
// as its own entries. Logging checks the crops you sprayed against them, counts sprays left, and the waiting period
// holds picking.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  await pg.goto(U); await pg.waitForTimeout(400);
  console.log('new garden products:', await pg.evaluate(() => (S.products || []).length));
  // an older garden: Spino Ace and a home-made spray from the old catalogue, with the old register link and a stochu recipe
  await pg.evaluate(async () => {
    S.products = [Object.assign(normProd(OLD_PRODUCTS.find(p => p.id === 'spinoace')), { tpl: 'spinoace' }), Object.assign(normProd(OLD_PRODUCTS.find(p => p.id === 'stochu')), { tpl: 'stochu' })];
    S.stochu = { vinegar: 15, wood: 15, shochu: 15, tabasco: 'a few drops', water: 1, note: 'evenings' };
    S.containers = [{ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [], covers: [] }];
    S.plantings = [{ id: 'cb', containerId: 'b1', cropId: 'cabbage', method: 'seedling', layout: 'staggered', from: 0, to: 100, rowSp: 45, plantSp: 45, sowDate: '2026-10-01', status: 'active', photos: {}, series: [], harvests: [] },
      { id: 'pk', containerId: 'b1', cropId: 'parsley', method: 'seedling', layout: 'rows', from: 100, to: 200, rowSp: 20, plantSp: 20, sowDate: '2026-10-01', status: 'active', photos: {}, series: [], harvests: [] }];
    S.log = [{ id: 'l1', kind: 'spray', date: '2026-11-17', product: 'Spino Ace water granules', productId: 'spinoace', pids: ['cb'], phi: 3 }];
    S.tasks = []; S.dataVersion = 9; await save();
  });
  await pg.reload(); await pg.waitForTimeout(500);
  console.log('after update: data version', await pg.evaluate(() => S.dataVersion), '| Spino Ace has register link?', await pg.evaluate(() => 'reg' in product('spinoace')),
    '| its crops:', await pg.evaluate(() => Object.keys(product('spinoace').crops).length), '| cabbage', JSON.stringify(await pg.evaluate(() => product('spinoace').crops.cabbage)));
  console.log('stochu notes:', JSON.stringify(await pg.evaluate(() => product('stochu').notes.slice(-1))));
  const sprays = () => pg.evaluate(() => { document.querySelectorAll('details.fold').forEach(d => d.open = true); const s = [...document.querySelectorAll('details.fold')].find(d => d.textContent.includes('Your sprays')); return s ? s.textContent.replace(/\s+/g, ' ').trim() : '—'; });
  await pg.goto(U + '#/plant/cb'); await pg.waitForTimeout(400);
  console.log('cabbage:', await sprays());
  // log a spray on both: parsley isn't one of Spino Ace's crops here; cabbage: spray 2 of its 3
  await pg.evaluate(() => logDialog({ pids: ['cb', 'pk'] })); await pg.waitForTimeout(200);
  await pg.click('#lf [name=product]'); await pg.waitForTimeout(150); await pg.click('.dd-panel .dd-item:has-text("Spino Ace")'); await pg.waitForTimeout(250);
  console.log('log check:', (await pg.textContent('#legal')).replace(/\s+/g, ' '), '| wait set to', await pg.inputValue('#lf [name=phi]'));
  await pg.evaluate(() => $('#modal')._close()); await pg.waitForTimeout(150);
  await pg.goto(U + '#/picksafe'); await pg.waitForTimeout(300);
  console.log('pick board:', (await pg.textContent('.plist.pick')).replace(/\s+/g, ' ').trim());
  // a spray with no crops entered: the app can't say
  await pg.evaluate(async () => { S.products.push(normProd({ id: 'p_new', kind: 'spray', en: 'Mystery spray', what: '', crops: {} })); await save(); });
  await pg.goto(U + '#/plant/pk'); await pg.waitForTimeout(400);
  console.log('parsley:', await sprays());
  await pg.goto(U + '#/product/spinoace'); await pg.waitForTimeout(300);
  console.log('product page:', (await pg.textContent('#view')).replace(/\s+/g, ' ').slice(0, 420));
  console.log('errs', errs); await b.close();
})();
