const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const pg = await (await newContext(b)).newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [{ id: 'hx', manual: true, cropId: 'edamame', from: 0, to: 200, sowDate: '2026-05-01', harvestedOn: '2026-08-31' }] },
      { id: 'g1', type: 'round', name: 'Bag 1', diameter: 40, depth: 35, margin: 2, history: [] });
    S.plantings.push({ id: 'kb', containerId: 'b1', cropId: 'cabbage', method: 'seedling', layout: 'staggered', from: 100, to: 200, rowSp: 45, plantSp: 45, sowDate: '2026-09-10', harvestDate: '2026-12-10', spread: 45, status: 'active', photos: {}, series: [], harvests: [] });
    S.plantings.push({ id: 'kom', containerId: 'g1', cropId: 'komatsuna', method: 'seed', layout: 'continuous', from: 0, to: 40, rowSp: 15, plantSp: 1, sowDate: '2026-10-20', harvestDate: '2026-11-25', spread: 15, status: 'active', photos: {}, series: [], harvests: [] });
    syncTasks(planting('kb')); syncTasks(planting('kom')); await save();
  });
  await pg.goto(U + '#/products'); await pg.waitForTimeout(300); await pg.screenshot({ path: SP + '/prods.png', fullPage: true });
  await pg.goto(U + '#/product/spinoace'); await pg.waitForTimeout(400); await pg.fill('#mixf input[name=L]', '2'); await pg.waitForTimeout(100);
  console.log('mix', await pg.textContent('#mixout')); await pg.screenshot({ path: SP + '/spino.png', fullPage: true });
  await pg.goto(U + '#/product/stochu'); await pg.waitForTimeout(300); await pg.fill('#stf input[name=water]', '15'); await pg.click('[data-act=saveStochu]'); await pg.waitForTimeout(300);
  console.log('stochu', await pg.evaluate(() => S.stochu)); await pg.screenshot({ path: SP + '/stochu.png', fullPage: true });
  await pg.goto(U + '#/plant/kom'); await pg.waitForTimeout(300); await pg.screenshot({ path: SP + '/komspray.png', fullPage: true });
  console.log('kom sprays', (await pg.textContent('.sprays')).replace(/\s+/g, ' ').slice(0, 600));
  // log a Pai Benica V spray on whole Plot A + Bag 1: cabbage ok, komatsuna ok
  await pg.goto(U + '#/log'); await pg.waitForTimeout(300); await pg.click('button[data-act=newLog]'); await pg.waitForTimeout(200);
  await pg.fill('#lf input[name=product]', 'Spino Ace water granules'); await pg.dispatchEvent('#lf input[name=product]', 'change'); await pg.waitForTimeout(100);
  await pg.click('#lf label.chip.tog:has(input[value=b1])'); await pg.click('#lf label.chip.tog:has(input[value=g1])'); await pg.waitForTimeout(150);
  console.log('legal', (await pg.textContent('#legal')).replace(/\s+/g, ' '), '| phi', await pg.inputValue('#lf input[name=phi]'));
  await pg.screenshot({ path: SP + '/logspino.png', fullPage: true });
  await pg.fill('#lf input[name=amount]', '1'); await pg.click('#lf button.primary'); await pg.waitForTimeout(300);
  console.log('saved', JSON.stringify(await pg.evaluate(() => S.log.map(e => [e.productId, e.product, e.phi, e.kind]))));
  await pg.click('button[data-act=newLog]'); await pg.waitForTimeout(200); await pg.fill('#lf input[name=product]', await pg.evaluate(() => product('paiBenicaV').en)); await pg.dispatchEvent('#lf input[name=product]', 'change'); await pg.click('#lf label.chip.tog:has(input[value=b1])'); await pg.waitForTimeout(150);
  console.log('legal2', (await pg.textContent('#legal')).replace(/\s+/g, ' '));
  await pg.keyboard.press('Escape');
  await pg.goto(U + '#/plant/kom'); await pg.waitForTimeout(300); console.log('kom after', (await pg.textContent('.sprays')).replace(/\s+/g, ' ').match(/Spino[^·]*·[^·]*·[^S]*/)?.[0]);
  // new planting form: tomato in bag
  await pg.goto(U + '#/plant/new/g1?crop=tomato'); await pg.waitForTimeout(400);
  console.log('fert', JSON.stringify(await pg.$$eval('.fert', fs => fs.map(f => [...f.querySelectorAll('input,select')].map(i => i.value).join(' ')))));
  console.log('jobs', (await pg.textContent('fieldset:has(legend:text("Suggested jobs"))')).replace(/\s+/g, ' ').slice(0, 500));
  await pg.screenshot({ path: SP + '/formtom.png', fullPage: true });
  // bed prep
  await pg.goto(U + '#/container/b1'); await pg.waitForTimeout(300); await pg.click('[data-act=bedMore]'); await pg.waitForTimeout(150); await pg.click('[data-m=prep]'); await pg.waitForTimeout(200);
  console.log('prep', (await pg.textContent('#modal')).replace(/\s+/g, ' ').slice(0, 500));
  console.log('errs', errs); await b.close();
})();
