const { newContext } = require('../lib');
// a bag added to the app today, holding a crop planted months ago: its potting mix was filled when that crop went in
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b, { products: true }); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers = []; S.plantings = []; S.tasks = []; delete S.prodLib; delete S.products; migrateProducts();
    S.products.push(Object.assign(normProd(Object.assign({ kind: 'mix', maker: '' }, OLD_MIXES.find(m => m.id === 'iris'))), { tpl: 'iris' })); await save();
  });
  const log = id => pg.evaluate(id => JSON.stringify(container(id).mixLog.map(e => [e.date, e.kind, e.fresh, !!e.pid])), id);
  const mixUI = async () => (await pg.textContent('#pf')).replace(/\s+/g, ' ').match(/Potting mix.*?(?=More options|$)/)?.[0]?.slice(0, 200);
  // 1) add a bag with Iris mix today (the form offers a fill date), then the potatoes planted on 30 Aug
  await pg.goto(U + '#/container/new'); await pg.waitForTimeout(400);
  await pg.click('[data-act=preset]'); await pg.waitForTimeout(300);
  await pg.fill('#cf [name=name]', 'Bag 10'); await pg.selectOption('#cf [name=mixKind]', 'iris');
  console.log('add form fill date:', await pg.inputValue('#cf [name=mixDate]'));
  await pg.click('#cf button[type=submit]'); await pg.waitForTimeout(500);
  const cid = await pg.evaluate(() => S.containers.find(c => c.name === 'Bag 10').id);
  console.log('bag added:', await log(cid));
  await pg.goto(U + `#/plant/new/${cid}?crop=potato&date=2026-08-30`); await pg.waitForTimeout(500);
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(500);
  console.log('potatoes 30 Aug saved:', await log(cid));
  await pg.goto(U + `#/plant/new/${cid}?crop=carrot&date=2027-03-01`); await pg.waitForTimeout(500);
  console.log('next crop form:', await mixUI());
  // 2) a fill date given when adding the bag
  await pg.goto(U + '#/container/new'); await pg.waitForTimeout(400);
  await pg.click('[data-act=preset]'); await pg.waitForTimeout(300);
  await pg.fill('#cf [name=name]', 'Bag 11'); await pg.selectOption('#cf [name=mixKind]', 'iris'); await pg.fill('#cf [name=mixDate]', '2026-10-01');
  await pg.click('#cf button[type=submit]'); await pg.waitForTimeout(500);
  console.log('bag with its own fill date:', await log(await pg.evaluate(() => S.containers.find(c => c.name === 'Bag 11').id)));
  // 3) saves from before: the fill dated the day the bag was added moves back to the crop growing in it; others stay
  const up = await pg.evaluate(() => {
    const raw = { dataVersion: 11, containers: [
      { id: 'g', type: 'round', name: 'Growing', diameter: 40, depth: 35, created: '2026-11-17', history: [], mixLog: [{ id: 'a', date: '2026-11-17', kind: 'iris', fresh: true }, { id: 'b', date: '2026-08-30', kind: 'iris', fresh: true, pid: 'p1' }] },
      { id: 'h', type: 'round', name: 'Harvested before', diameter: 40, depth: 35, created: '2026-11-17', history: [{ plantingId: 'x', cropId: 'lettuce', sowDate: '2026-05-01', harvestedOn: '2026-07-01' }], mixLog: [{ id: 'c', date: '2026-11-17', kind: 'iris', fresh: true }] },
      { id: 'r', type: 'round', name: 'Refilled by hand', diameter: 40, depth: 35, created: '2026-06-01', history: [], mixLog: [{ id: 'd', date: '2026-11-17', kind: 'iris', fresh: true }] }],
    plantings: [{ id: 'p1', containerId: 'g', cropId: 'potato', sowDate: '2026-08-30', status: 'active', from: 0, to: 40 }, { id: 'p2', containerId: 'r', cropId: 'potato', sowDate: '2026-08-30', status: 'active', from: 0, to: 40 }] };
    const s = upgrade(raw).state; return s.containers.map(c => `${c.name}: ${c.mixLog.map(e => e.date + (e.pid ? '(crop)' : '')).join(', ')}`);
  });
  console.log('old saves:', JSON.stringify(up));
  console.log('errs', errs); await b.close();
})();
