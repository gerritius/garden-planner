const { newContext } = require('../lib');
// crop ideas for free space
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers = [{ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [] },
      { id: 'g1', type: 'round', name: 'Bag 6', diameter: 40, depth: 35, margin: 2, history: [{ cropId: 'kyuri', sowDate: '2026-05-01', harvestedOn: '2026-08-30', from: 0, to: 40 }] }];
    S.plantings = [{ id: 'dk', containerId: 'b1', cropId: 'daikon', method: 'seed', layout: 'rows', from: 0, to: 200, rowSp: 30, plantSp: 25, sowDate: '2026-09-10', harvestDate: '2026-11-25', keepUntil: '2027-01-10', status: 'active', photos: {}, series: [], harvests: [] }];
    S.tasks = []; S.starts = []; await save();
  });
  const show = async label => {
    const t = await pg.evaluate(() => [...document.querySelectorAll('#modal h4, #modal li, #modal #clrBy, #modal summary')].map(e => e.id === 'clrBy' ? 'clear by ' + e.value : e.textContent.replace(/\s+/g, ' ').trim()).join('\n'));
    console.log('\n=== ' + label + '\n' + t);
  };
  // 1) empty bag now (Nov)
  await pg.goto(U + '#/container/g1'); await pg.waitForTimeout(500);
  await pg.click('[data-act=ideas]'); await pg.waitForTimeout(600); await show('Bag 6, empty now');
  await pg.locator('#modal .sheet').screenshot({ path: `${SP}/ideas_bag.png` });
  // pick the first fitting idea → planting form prefilled
  const first = await pg.$('#modal [data-idea]'); const id = await first.getAttribute('data-idea'); await first.click(); await pg.waitForTimeout(500);
  console.log('→', pg.url().split('#')[1], '| draft', JSON.stringify(await pg.evaluate(() => [draft.cropId, draft.method, draft.sowDate, draft.raise, draft.harvestDate])));
  // 2) daikon bed: the space after the daikon (plan section)
  await pg.goto(U + '#/container/b1'); await pg.waitForTimeout(500);
  const chips = await pg.$$eval('.gaps .gap', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  console.log('\ngap rows:', chips);
  const btn = await pg.$('.gaps [data-act=ideas]');
  if (btn) { await btn.click(); await pg.waitForTimeout(600); await show('Plot A after the daikon'); }
  // 3) planting form for a plan: the link applies to the draft
  await pg.goto(U + '#/plant/new/b1?plan=1&date=2027-01-15'); await pg.waitForTimeout(500);
  await pg.click('[data-act=formIdeas]'); await pg.waitForTimeout(600);
  const it = await pg.$('#modal [data-idea]'); const iid = await it.getAttribute('data-idea'); await it.click(); await pg.waitForTimeout(500);
  console.log('\nform pick', iid, JSON.stringify(await pg.evaluate(() => [draft.cropId, draft.method, draft.sowDate, draft.raise, draft.harvestDate])));
  console.log('errs', errs); await b.close();
})();
