const { newContext } = require('../lib');
// products page, add/edit/remove any kind, catalogue, and everything using them
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    delete S.prodLib; delete S.products; S.productsRemoved = [];
    S.myProducts = ['benicaNatural', 'spinoace', 'oysterLime', 'bokashi', 'chickenManure', 'cowCompost', 'kasei888'];
    S.plenty = ['chickenManure']; S.customProducts = [];
    S.containers = [{ id: 'g1', type: 'round', name: 'Bag 1', diameter: 40, depth: 35, margin: 2, history: [], mixLog: [{ id: 'm1', date: '2026-10-01', kind: 'touikawa', fresh: true }] },
      { id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [] }];
    S.plantings = [{ id: 'cb', containerId: 'b1', cropId: 'cabbage', method: 'seedling', layout: 'staggered', from: 0, to: 200, rowSp: 45, plantSp: 45, sowDate: '2026-10-18', status: 'active', photos: {}, series: [], harvests: [], fert: [{ product: 'Bokashi', amount: 4, unit: 'handful' }] }];
    S.log = []; S.tasks = []; delete S.dataVersion; await save();
  });
  await pg.reload(); await pg.waitForTimeout(500);   // an old-format save is brought up to date when the app loads it
  await pg.goto(U + '#/products'); await pg.waitForTimeout(500);
  console.log('tabs:', await pg.$$eval('.ptabs button', x => x.map(b => b.textContent + (b.classList.contains('on') ? '*' : '')).join(' | ')));
  console.log('page:', (await pg.textContent('#view')).replace(/\s+/g, ' ').slice(0, 700));
  await pg.screenshot({ path: `${SP}/products.png`, fullPage: true });
  // add my own spray (no registry)
  await pg.click('[data-act=pTab][data-t=spray]'); await pg.waitForTimeout(300);
  await pg.click('[data-act=addProd][data-k=spray]'); await pg.waitForTimeout(200);
  await pg.fill('#pdf [name=en]', 'Garden Safe Neem Oil'); await pg.fill('#pdf [name=what]', 'neem oil 70%'); await pg.fill('#pdf [name=phi]', '1'); await pg.check('#pdf [name=organic]', { force: true });
  await pg.locator('#modal .sheet').screenshot({ path: `${SP}/prod_spray.png` });
  await pg.click('#pdf button.primary'); await pg.waitForTimeout(300);
  // add a fertiliser: switch type & form in the dialog
  await pg.click('[data-act=pTab][data-t=fert]'); await pg.waitForTimeout(300);
  await pg.click('[data-act=addProd][data-k=fert]'); await pg.waitForTimeout(200);
  await pg.fill('#pdf [name=en]', 'Hyponex granules 6-10-5'); await pg.selectOption('#pdf [name=form]', 'quick'); await pg.waitForTimeout(150);
  await pg.fill('#pdf [name=n]', '6'); await pg.fill('#pdf [name=p]', '10'); await pg.fill('#pdf [name=k]', '5');
  await pg.click('#pdf button.primary'); await pg.waitForTimeout(300);
  // add a compost from the catalogue
  await pg.click('[data-act=pTab][data-t=soil]'); await pg.waitForTimeout(300);
  await pg.evaluate(() => document.querySelector('details.fold').open = true);
  await pg.click('[data-act=addCat][data-id=barkCompost]'); await pg.waitForTimeout(300);
  console.log('library now:', await pg.evaluate(() => libList().map(p => `${p.kind}:${p.en}`).join(' | ')));
  // edit Touikawa: it now lasts 300 days
  await pg.goto(U + '#/product/touikawa'); await pg.waitForTimeout(300); await pg.click('[data-act=editProd]'); await pg.waitForTimeout(200);
  console.log('mix form fields:', await pg.$$eval('#pdf input, #pdf select', x => x.map(e => e.name).filter(Boolean).join(',')));
  await pg.fill('#pdf [name=lasts]', '300'); await pg.click('#pdf button.primary'); await pg.waitForTimeout(300);
  console.log('touikawa lasts', await pg.evaluate(() => mixFert('touikawa').days));
  // rename Bokashi → records follow
  await pg.goto(U + '#/product/bokashi'); await pg.waitForTimeout(300); await pg.click('[data-act=editProd]'); await pg.waitForTimeout(200);
  await pg.fill('#pdf [name=en]', 'Bokashi (Sun & Hope)'); await pg.click('#pdf button.primary'); await pg.waitForTimeout(300);
  console.log('planting fert renamed:', await pg.evaluate(() => planting('cb').fert[0].product), '| still counted N', await pg.evaluate(() => feedLedger(planting('cb')).lines.find(l => l.g === 'base').n.toFixed(2)));
  // remove Chicken manure (asks first); base suggestion falls back
  await pg.goto(U + '#/product/chickenManure'); await pg.waitForTimeout(300); await pg.click('[data-act=editProd]'); await pg.waitForTimeout(200);
  await pg.click('#pdf [data-x=del]'); await pg.waitForTimeout(200); console.log('ask:', await pg.textContent('#modal .msg'));
  await pg.click('#modal [data-x=ok]'); await pg.waitForTimeout(300);
  console.log('library has chicken?', await pg.evaluate(() => libList().some(p => p.id === 'chickenManure')), '| old record name still counts:', JSON.stringify(await pg.evaluate(() => npkOf('Chicken manure'))));
  console.log('bed base now:', JSON.stringify(await pg.evaluate(() => baseFertPlan('cabbage', container('b1'), 0, 200, todayStr()))));
  // log a spray that has no registry data
  await pg.evaluate(() => logDialog({ pids: ['cb'] })); await pg.waitForTimeout(200);
  await pg.click('#lf [name=product]'); await pg.waitForTimeout(150); await pg.click('.dd-panel .dd-item:has-text("Garden Safe")'); await pg.waitForTimeout(250);
  console.log('log check:', (await pg.textContent('#legal')).slice(0, 120), '| phi', await pg.inputValue('#lf [name=phi]'));
  await pg.evaluate(() => $('#modal')._close()); await pg.waitForTimeout(150);
  // crop page sprays section shows it neutrally
  await pg.goto(U + '#/plant/cb'); await pg.waitForTimeout(400);
  console.log('crop sprays:', await pg.evaluate(() => [...document.querySelectorAll('.sprays li')].map(li => li.textContent.replace(/\s+/g, ' ').trim().slice(0, 90))));
  // planting form: potting mix list and fertiliser suggestions come from the library
  await pg.goto(U + '#/plant/new/g1?crop=lettuce'); await pg.waitForTimeout(500);
  console.log('fert names:', await pg.$$eval('#fertNames option', x => x.map(o => o.value).join(' | ')));
  console.log('errs', errs); await b.close();
})();
