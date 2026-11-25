const { newContext } = require('../lib');
// same garden in old and new versions: products, counted nutrients, base fertiliser, feeding plan must match
const { chromium, devices } = require('playwright');
const PORT = '8765';
const U = `http://localhost:${PORT}/`;
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b, { products: true }); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.myProducts = ['benicaNatural', 'paiBenicaV', 'spinoace', 'neem', 'toshoAburakasu', 'oysterLime', 'bokashi', 'aburakasu', 'chickenManure', 'cowCompost', 'cowHuskCompost', 'stochu', 'kasei888', 'woodAsh', 'kuntan', 'cust_k'];
    S.plenty = ['chickenManure', 'aburakasu'];
    S.customProducts = [{ id: 'cust_k', en: 'Kincho Liquid 6-6-7', ja: '', form: 'liquid', kind: 'fert', npkv: [6, 6, 7], npk: '6-6-7', per: 5, doses: [5, 10], custom: true }];
    delete S.prodLib; delete S.products; S.ownMigrated = true; S.ownMigrated2 = true; S.kaseiAdded = true;
    S.containers = [
      { id: 'g1', type: 'round', name: 'Bag 1', diameter: 40, depth: 35, margin: 2, history: [{ cropId: 'kyuri', sowDate: '2026-05-01', harvestedOn: '2026-08-30', from: 0, to: 40 }], mixLog: [{ id: 'm1', date: '2026-03-01', kind: 'touikawa', fresh: true }, { id: 'm2', date: '2026-10-01', kind: 'touikawa', fresh: false }] },
      { id: 'g2', type: 'round', name: 'Bag 2', diameter: 40, depth: 35, margin: 2, history: [], mixLog: [{ id: 'm3', date: '2026-10-01', kind: 'iris', fresh: true }] },
      { id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [{ cropId: 'tomato', sowDate: '2026-05-01', harvestedOn: '2026-08-20', from: 0, to: 200 }] }];
    S.plantings = [
      { id: 'ce', containerId: 'g1', cropId: 'celery', method: 'seedling', layout: 'center', from: 0, to: 40, sowDate: '2026-10-05', status: 'active', photos: {}, series: [], harvests: [], fert: [{ product: '化成肥料 8-8-8', amount: 40, unit: 'g' }, { product: 'Cow manure compost', amount: 4, unit: 'L' }],
        feedPlan: [{ id: 'fp', product: 'Kincho Liquid 6-6-7', amount: 5, unit: 'mL', every: 7, start: '2026-11-10', end: '2027-01-20' }] },
      { id: 'le', containerId: 'g2', cropId: 'lettuce', method: 'seedling', layout: 'center', from: 0, to: 40, sowDate: '2026-10-05', status: 'active', photos: {}, series: [], harvests: [], fert: [] },
      { id: 'cb', containerId: 'b1', cropId: 'cabbage', method: 'seedling', layout: 'staggered', from: 0, to: 200, rowSp: 45, plantSp: 45, sowDate: '2026-10-18', status: 'active', photos: {}, series: [], harvests: [], fert: [{ product: 'Chicken manure', amount: 4, unit: 'handful' }, { product: '牛ふん堆肥', amount: 4, unit: 'kg' }, { product: 'oyster lime', amount: 200, unit: 'g' }] }];
    S.log = [{ id: 'l1', kind: 'fert', product: 'Bokashi', amount: 2, unit: 'handful', date: '2026-11-01', cids: ['b1'], pids: [] }, { id: 'l2', kind: 'fert', product: 'Kincho Liquid 6-6-7', amount: 10, unit: 'mL', date: '2026-11-10', cids: [], pids: ['ce'] },
      { id: 'l3', kind: 'fert', product: 'Wood ash', amount: 1, unit: 'handful', date: '2026-11-05', cids: ['b1'], pids: [] }, { id: 'l4', kind: 'spray', product: 'Benica Natural spray', productId: 'benicaNatural', date: '2026-11-12', cids: [], pids: ['cb'] }];
    S.tasks = []; S.plantings.forEach(p => { const d = { cropId: p.cropId, sowDate: p.sowDate, method: p.method, containerId: p.containerId, daysHarvest: crop(p.cropId).daysHarvest }; recalc(d); p.harvestDate = d.harvestDate; syncTasks(p); });
    delete S.dataVersion; await save();
  });
  await pg.reload(); await pg.waitForTimeout(500);   // an old-format save is brought up to date when the app loads it
  await pg.goto(U + '#/'); await pg.waitForTimeout(500);
  const out = await pg.evaluate(() => {
    const r = [];
    r.push('my products: ' + myProducts().map(p => p.id).sort().join(','));
    r.push('plenty: ' + myProducts().filter(p => isPlenty(p.id)).map(p => p.id).sort().join(','));
    for (const p of S.plantings) { const L = feedLedger(p), sim = feedSim(p, L); r.push(`${p.cropId}: total N ${L.total.toFixed(2)} P ${L.totalP.toFixed(2)} K ${L.totalK.toFixed(2)} | lines ${L.lines.map(l => l.label.slice(0, 40) + '=' + (l.n || 0).toFixed(2)).join('; ')} | short ${sim && sim.shortFrom}`); }
    for (const [c, f, t, crp] of [['g1', 0, 40, 'lettuce'], ['g2', 0, 40, 'lettuce'], ['b1', 0, 90, 'spinach'], ['b1', 0, 200, 'cabbage']]) r.push(`base ${c} ${crp}: ${JSON.stringify(baseFertPlan(crp, container(c), f, t, todayStr()))} — ${baseFertNote(crp, container(c), todayStr())}`);
    r.push('npk: ' + ['Chicken manure', '化成肥料 8-8-8', 'Kincho Liquid 6-6-7', 'Bokashi', 'oyster lime', 'Wood ash', 'Hyponex 6-10-5'].map(n => n + '=' + JSON.stringify(npkOf(n))).join(' '));
    r.push('rel: ' + ['Chicken manure', 'Aburakasu (oil cake)', 'Kincho Liquid 6-6-7', 'Cow manure compost', 'Chemical fertiliser 8-8-8'].map(n => n + '=' + JSON.stringify(relOf(n))).join(' '));
    r.push('lead: ' + ['chickenManure', 'aburakasu', 'kasei888', 'bokashi'].map(i => i + '=' + leadOf(product(i))[0]).join(' '));
    r.push('mix: ' + JSON.stringify(mixState(container('g1'))) + ' | ' + JSON.stringify(mixState(container('g2'))));
    return r.join('\n');
  });
  console.log(out); console.log('errs', errs); await b.close();
})();
