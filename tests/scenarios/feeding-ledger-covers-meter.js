const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b, { products: true });
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load/.test(m.text())) errs.push(m.text()); }); pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [{ id: 'h0', cropId: 'tomato', from: 0, to: 200, sowDate: '2026-05-01', harvestedOn: '2026-08-20' }], covers: [{ id: 'cv', type: 'fleece', from: 0, to: 100, on: '2026-11-01' }] },
      { id: 'b2', type: 'bed', name: 'Plot B', width: 100, length: 200, margin: 10, history: [] },
      { id: 'g1', type: 'round', name: 'Bag 1', diameter: 40, depth: 35, margin: 2, history: [], mixLog: [{ id: 'm1', date: '2026-09-01', kind: 'iris', fresh: true }] },
      { id: 'g2', type: 'round', name: 'Bag 2', diameter: 40, depth: 35, margin: 2, history: [{ id: 'hx', cropId: 'tomato', from: 0, to: 40, sowDate: '2026-05-01', harvestedOn: '2026-08-25' }], mixLog: [{ id: 'm2', date: '2026-04-20', kind: 'touikawa', fresh: true }] });
    S.plantings.push({ id: 'hk', containerId: 'b1', cropId: 'hakusai', method: 'seed', layout: 'staggered', from: 0, to: 200, rowSp: 60, plantSp: 45, sowDate: '2026-08-30', harvestDate: '2026-12-05', status: 'active', thinned: true, photos: {}, series: [], harvests: [],
      fert: [{ product: 'Cow manure compost', amount: 2, unit: 'kg' }, { product: 'Bokashi', amount: 6, unit: 'handful' }] });
    S.plantings.push({ id: 'dk', containerId: 'b2', cropId: 'daikon', method: 'seed', layout: 'rows', from: 0, to: 100, rowSp: 40, plantSp: 30, sowDate: '2026-09-05', harvestDate: '2026-10-30', harvestFixed: true, status: 'active', photos: {}, series: [], harvests: [] });
    S.plantings.push({ id: 'sp', containerId: 'b2', cropId: 'spinach', method: 'seed', layout: 'rows', from: 100, to: 200, rowSp: 15, plantSp: 3, sowDate: '2026-09-20', harvestDate: '2026-11-25', status: 'active', photos: {}, series: [], harvests: [] });
    S.plantings.push({ id: 'k1', containerId: 'g1', cropId: 'komatsuna', method: 'seed', layout: 'continuous', from: 0, to: 40, rowSp: 15, plantSp: 3, sowDate: '2026-09-10', status: 'active', photos: {}, series: [{ id: 'se1', title: 'Side-dress (追肥)', product: 'Chemical fertiliser 8-8-8', amount: 10, unit: 'g', every: 0, per: 'week', start: addDays(todayStr(), -2) }], harvests: [] });
    S.tasks.push({ id: 'oldjob', containerId: 'b1', plantingId: null, kind: 'bed', title: 'Side-dress', due: '2026-10-25', done: false });
    for (const p of S.plantings) syncTasks(p); delete S.dataVersion; await save();
  });
  await pg.reload(); await pg.waitForTimeout(500);   // an old-format save is brought up to date when the app loads it
  await pg.goto(U); await pg.waitForTimeout(400);
  console.log('cover type migrated', await pg.evaluate(() => container('b1').covers[0].type));
  // 1) fix the old bed job: mark done 25 Oct with 3 handfuls bokashi
  await pg.evaluate(() => taskDialog(S.tasks.find(t => t.id === 'oldjob'))); await pg.waitForTimeout(200);
  await pg.check('#btf input[name=done]'); await pg.evaluate(() => document.querySelector('#btf details.pktpick').open = true);
  await pg.fill('#btf input[name=product]', 'Bokashi'); await pg.fill('#btf input[name=amount]', '3'); await pg.selectOption('#btf select[name=unit]', 'handful'); await pg.click('#btf button.primary'); await pg.waitForTimeout(300);
  console.log('old job', JSON.stringify(await pg.evaluate(() => { const t = S.tasks.find(t => t.id === 'oldjob'); return [t.done, t.doneOn, !!t.logId, (S.log || []).map(e => [e.product, e.amount, e.unit, e.date, e.cids])]; })));
  console.log('today jobs mention side-dress?', (await pg.textContent('section.today')).includes('Side-dress'));
  // 2) new bed job dated in the past with fertiliser
  await pg.goto(U + '#/container/b2'); await pg.waitForTimeout(300); await pg.click('[data-act=bedMore]'); await pg.waitForTimeout(200); await pg.click('[data-m=job]'); await pg.waitForTimeout(200);
  await pg.fill('#btf input[name=title]', 'Side-dress'); await pg.fill('#btf input[name=due]', '2026-10-28'); await pg.dispatchEvent('#btf input[name=due]', 'change');
  await pg.evaluate(() => document.querySelector('#btf details.pktpick').open = true); await pg.fill('#btf input[name=product]', 'Chicken manure'); await pg.fill('#btf input[name=amount]', '200'); await pg.selectOption('#btf select[name=unit]', 'mL');
  await pg.click('#btf button.primary'); await pg.waitForTimeout(300);
  console.log('new past job done?', await pg.evaluate(() => { const t = S.tasks.find(t => t.title === 'Side-dress' && t.containerId === 'b2'); return [t.done, t.doneOn, !!t.logId]; }));
  // feeding on hakusai page
  await pg.goto(U + '#/plant/hk'); await pg.waitForTimeout(400);
  console.log('hakusai feeding:', (await pg.textContent('section.feeding')).replace(/\s+/g, ' ').slice(0, 420));
  await pg.screenshot({ path: SP + '/feed_hk.png', fullPage: false });
  await pg.evaluate(() => document.querySelector('section.feeding details').open = true); await pg.waitForTimeout(100);
  await pg.locator('section.feeding').screenshot({ path: SP + '/feed_ledger.png' });
  // 3) bags
  console.log('bag1 fresh base plan', JSON.stringify(await pg.evaluate(() => baseFertPlan('komatsuna', container('g1'), 0, 40, '2026-09-10'))), '| bag2 reused', JSON.stringify(await pg.evaluate(() => baseFertPlan('komatsuna', container('g2'), 0, 40, todayStr()))));
  // 4) tick the 8-8-8 side-dress job on komatsuna -> feeding dialog
  const sid = await pg.evaluate(() => S.tasks.find(t => t.seriesId === 'se1').id);
  await pg.evaluate(id => toggleTask(id, true), sid); await pg.waitForTimeout(300);
  console.log('dialog prefilled', await pg.inputValue('#fdf input[name=product]'), await pg.inputValue('#fdf input[name=amount]'), await pg.textContent('#fdn'));
  await pg.fill('#fdf input[name=amount]', '15'); await pg.click('#fdf button.primary'); await pg.waitForTimeout(300);
  console.log('task done & logged', JSON.stringify(await pg.evaluate(id => { const t = S.tasks.find(t => t.id === id); return [t.done, t.doneOn, !!t.logId]; }, sid)));
  await pg.goto(U + '#/plant/k1'); await pg.waitForTimeout(300);
  console.log('komatsuna feeding:', (await pg.textContent('section.feeding')).replace(/\s+/g, ' ').slice(0, 330));
  // 5) daikon window: set packet 55-80 via edit
  await pg.goto(U + '#/plant/dk/edit'); await pg.waitForTimeout(400); await pg.evaluate(() => { const m = document.querySelector('#pfMore'); if (m) m.open = true; }); await pg.fill('#pf input[name=daysFrom]', '55'); await pg.fill('#pf input[name=daysTo]', '80'); await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(400);
  await pg.goto(U + '#/plant/dk'); await pg.waitForTimeout(300);
  console.log('daikon:', (await pg.textContent('p.pickby')).replace(/\s+/g, ' '));
  console.log('pickby task', await pg.evaluate(() => (S.tasks.find(t => t.plantingId === 'dk' && t.kind === 'pickby') || {}).due));
  // 6) split: shrink spinach then plant in freed half
  await pg.evaluate(async () => { const p = planting('sp'); p.from = 100; p.to = 200; await save(); });
  await pg.goto(U + '#/plant/sp/edit'); await pg.waitForTimeout(300); await pg.fill('#pf input[name=from]', '150'); await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(400);
  await pg.goto(U + '#/plant/new/b2?crop=lettuce&from=100&to=150'); await pg.waitForTimeout(400);
  console.log('split prev:', (await pg.textContent('#rotWarn')).replace(/\s+/g, ' ').slice(0, 160));
  // 7) meter DRY on a bag -> water today
  await pg.evaluate(async () => { container('g2').soil = [{ id: 'r1', date: todayStr(), from: 0, to: 40, moistLvl: 'DRY', salt: 'NOR', ph: 6.5 }]; await save(); });
  await pg.goto(U); await pg.waitForTimeout(300);
  console.log('water', await pg.evaluate(() => { const t = S.tasks.find(t => t.kind === 'water' && !t.group && !t.done); return t && t.due + ' ' + t.note; }));
  console.log('errs', errs); await b.close();
})();
