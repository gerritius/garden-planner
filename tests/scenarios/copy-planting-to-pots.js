const { newContext } = require('../lib');
// copy a planting to other pots
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers = [1, 2, 3, 4, 5].map(i => ({ id: 'k' + i, type: 'round', name: 'Bag ' + i, diameter: 40, depth: 35, margin: 2, history: [] }));
    S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [] });
    S.plantings = [{ id: 'other', containerId: 'k5', cropId: 'lettuce', method: 'seedling', layout: 'center', from: 0, to: 40, sowDate: '2026-10-01', status: 'active', photos: {}, series: [], harvests: [] }];
    S.tasks = []; S.log = []; await save();
  });
  // make the original through the form
  await pg.goto(U + '#/plant/new/k1?crop=potato&date=2026-09-10'); await pg.waitForTimeout(500);
  await pg.fill('#pf [name=variety]', 'デジマ'); await pg.click('[data-act=method][data-v=seedling]'); await pg.waitForTimeout(200);
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(600);
  const pid = await pg.evaluate(() => S.plantings.find(p => p.cropId === 'potato').id);
  // tick a job and record a feeding on the original
  await pg.evaluate(async id => { const t = S.tasks.find(t => t.plantingId === id && !t.done && /stems/.test(t.title)); if (t) { t.done = true; t.doneOn = '2026-10-05'; }
    S.tasks.push({ id: 'man', plantingId: id, kind: 'custom', title: 'Check for aphids', due: '2026-11-25', done: false });
    S.log.push({ id: 'lg', kind: 'fert', product: 'Chemical fertiliser 8-8-8', amount: 10, unit: 'g', date: '2026-10-10', cids: [], pids: [id] }); await save(); }, pid);
  console.log('original tasks:', JSON.stringify(await pg.evaluate(id => S.tasks.filter(t => t.plantingId === id).map(t => [t.title.slice(0, 30), t.due, t.done]), pid)));
  await pg.goto(U + '#/plant/' + pid); await pg.waitForTimeout(400);
  await pg.click('[data-act=copyTo]'); await pg.waitForTimeout(250);
  console.log('choices:', (await pg.textContent('#cpf .sowchips')).replace(/\s+/g, ' '));
  await pg.locator('#modal .sheet').screenshot({ path: `${SP}/copy_dlg.png` });
  for (const id of ["k2", "k3", "k4"]) await pg.click(`#cpf label:has(input[value=${id}])`);
  console.log('k5 disabled:', await pg.isDisabled('#cpf input[value=k5]'), '| bed offered:', !!(await pg.$('#cpf input[value=b1]')));
  await pg.click('#cpf button.primary'); await pg.waitForTimeout(500);
  const out = await pg.evaluate(() => S.plantings.filter(p => p.cropId === 'potato').map(p => ({ c: p.containerId, v: p.variety, sow: p.sowDate, hv: p.harvestDate, m: p.method, lay: p.layout, fert: (p.fert || []).length, ser: (p.series || []).length,
    tasks: S.tasks.filter(t => t.plantingId === p.id).map(t => [t.title.slice(0, 22), t.done]).join('; '), mix: (container(p.containerId).mixLog || []).map(e => e.kind + (e.fresh ? ' fresh' : ' reused')).join(','),
    fed: (S.log || []).filter(l => (l.pids || []).includes(p.id)).length, L: +feedLedger(p).total.toFixed(1) })));
  out.forEach(o => console.log(JSON.stringify(o)));
  await pg.goto(U + '#/'); await pg.waitForTimeout(400); await pg.screenshot({ path: `${SP}/copy_home.png` });
  console.log('errs', errs); await b.close();
})();
