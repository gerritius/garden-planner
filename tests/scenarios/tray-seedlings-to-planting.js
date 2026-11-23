const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b, { openFolds: true });
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers.push({ id: 'b1', type: 'bed', name: 'Bed 1', width: 100, length: 200, margin: 10, history: [] }, { id: 'g1', type: 'round', name: 'Bag 1', diameter: 40, depth: 35, margin: 2, history: [] }, { id: 'b2', type: 'bed', name: 'Bed 2', width: 100, length: 200, margin: 10, history: [] }, { id: 'b3', type: 'bed', name: 'Bed 3', width: 100, length: 200, margin: 10, history: [] });
    // old planting with a hand-typed packet date (doesn't match the old formula) and one with the old formula
    S.plantings.push({ id: 'old1', containerId: 'b2', cropId: 'daikon', method: 'seed', layout: 'rows', from: 0, to: 100, rowSp: 30, plantSp: 30, sowDate: '2026-09-05', harvestDate: '2026-11-20', status: 'active', photos: {}, series: [], harvests: [] });
    S.plantings.push({ id: 'old2', containerId: 'b2', cropId: 'komatsuna', method: 'seed', layout: 'rows', from: 100, to: 200, rowSp: 15, plantSp: 3, sowDate: '2026-11-10', harvestDate: addDays('2026-11-10', 35), status: 'active', photos: {}, series: [], harvests: [] });
    S.starts = [{ id: 'st', cropId: 'cabbage', kind: 'tray', tray: 1, count: 10, sowDate: '2026-10-10', kept: 'cover', status: 'growing', events: [], created: '1' }];
    S.hvMig = false; delete S.dataVersion; await save();   // saved as an older version of the app would have
  });
  await pg.goto(U); await pg.waitForTimeout(400);
  console.log('migrated', JSON.stringify(await pg.evaluate(() => ['old1', 'old2'].map(id => [id, planting(id).harvestDate, !!planting(id).harvestFixed]))));
  // 1) seed in a bag through the form
  await pg.goto(U + '#/plant/new/g1?crop=komatsuna'); await pg.waitForTimeout(400);
  const hv1 = await pg.inputValue('#pf input[name=harvestDate]'); await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(400);
  // 2) bought seedlings in a bed (seed crop as seedlings)
  await pg.goto(U + '#/plant/new/b1?crop=broccoli&from=0&to=100'); await pg.waitForTimeout(400);
  await pg.click('[data-act=method][data-v=seedling]'); await pg.waitForTimeout(300);
  const hv2 = await pg.inputValue('#pf input[name=harvestDate]'); await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(400);
  // 3) plant out from the tray
  await pg.goto(U + '#/seedlings'); await pg.waitForTimeout(300);
  console.log('tray ready line', (await pg.textContent('li.start')).replace(/\s+/g, ' ').match(/Sown.*?\)/)?.[0]);
  await pg.click('[data-act=replant]'); await pg.waitForTimeout(200); await pg.click('[data-c=b1]'); await pg.waitForTimeout(400);
  await pg.fill('#pf input[name=from]', '100'); await pg.dispatchEvent('#pf input[name=from]', 'input');
  const hv3 = await pg.inputValue('#pf input[name=harvestDate]'); await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(400);
  // 4) planned with tray, then a typed harvest date that must stick
  await pg.goto(U + '#/plant/new/b2?plan=1&crop=hakusai&from=0&to=100&date=2027-08-30'); await pg.waitForTimeout(400);
  await pg.click('[data-act=method][data-v=seedling]'); await pg.waitForTimeout(300); await pg.click('[data-act=raise][data-v=tray]'); await pg.waitForTimeout(300);
  const hv4 = await pg.inputValue('#pf input[name=harvestDate]'); await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(500);
  await pg.goto(U + '#/plant/new/b3?crop=spinach&from=0&to=100&date=2026-11-16'); await pg.waitForTimeout(400);
  await pg.fill('#pf input[name=harvestDate]', '2027-01-10'); await pg.dispatchEvent('#pf input[name=harvestDate]', 'input');
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(400);
  await pg.goto(U); await pg.waitForTimeout(300); await pg.goto(U + '#/cal'); await pg.waitForTimeout(300);
  const rows = await pg.evaluate(() => S.plantings.map(p => [p.cropId, (container(p.containerId) || {}).name, p.method, p.status, p.sowDate, p.seededOn || '', p.harvestDate, harvestEstimate(p), p.harvestFixed ? 'fixed' : 'auto', (S.tasks.find(t => t.plantingId === p.id && (t.kind === 'harvest' || t.kind === 'plan_tray')) || {}).due || '']));
  console.log('form values', hv1, hv2, hv3, hv4);
  for (const r of rows) console.log(r.join(' | '));
  console.log('errs', errs); await b.close();
})();
