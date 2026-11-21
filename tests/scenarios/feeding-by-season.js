const { newContext } = require('../lib');
// feeding stages by planting date, across crops
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.goto(U); await pg.waitForTimeout(400);
  const cases = [['cabbage', 'seedling', '2026-10-18'], ['cabbage', 'seedling', '2026-10-01'], ['cabbage', 'seedling', '2026-08-25'], ['cabbage', 'seedling', '2026-03-20'], ['broccoli', 'seedling', '2026-09-20'],
    ['hakusai', 'seedling', '2026-09-05'], ['garlic', 'seedling', '2026-10-10'], ['spinach', 'seed', '2026-10-15'], ['daikon', 'seed', '2026-09-10'], ['snappea', 'seed', '2026-11-05'], ['tomato', 'seedling', '2026-05-01'], ['komatsuna', 'seed', '2026-11-10']];
  const out = await pg.evaluate(async cs => {
    S.containers = [{ id: 'b1', type: 'bed', name: 'Plot', width: 100, length: 200, margin: 10, history: [] }];
    const res = [];
    for (const [id, m, sd] of cs) {
      const d = { cropId: id, sowDate: sd, method: m, containerId: 'b1', daysHarvest: crop(id).daysHarvest, daysThin: crop(id).daysThin, thinSp: crop(id).thinSp };
      recalc(d);
      const p = { id: 'x' + res.length, containerId: 'b1', cropId: id, method: m, layout: 'rows', from: 0, to: 200, rowSp: 40, plantSp: 30, sowDate: sd, harvestDate: d.harvestDate, thinDate: d.thinDate, status: 'active', photos: {}, series: [], harvests: [], fert: [{ product: 'Chicken manure', amount: 4, unit: 'handful' }] };
      S.plantings = [p]; S.tasks = [];
      const se = feedSeason(p), st = sideStages(p), L = feedLedger(p), sim = feedSim(p, L);
      res.push(`\n${id} ${m} ${sd} → harvest ${p.harvestDate}${se ? ` | winter ${se.ws}→${se.we}${se.bolt ? ' BOLT lean from ' + se.leanFrom : ' lean from ' + se.leanFrom}` : ' | no winter'}\n` +
        st.map(s => `   ${s.date} ${s.light ? '[light] ' : ''}${s.t}${s.why ? ' — ' + s.why : ''}`).join('\n') +
        (st.skipped.length ? '\n' + st.skipped.map(s => `   SKIP ${s.date} ${s.t}: ${s.why.slice(0, 90)}`).join('\n') : '') +
        `\n   card: ${simVerdict(sim, L, p).replace(/<[^>]+>/g, '').slice(0, 230)}`);
    }
    return res.join('');
  }, cases);
  console.log(out);
  // the planner for the user's spring cabbage
  await pg.evaluate(async () => { S.containers = [{ id: 'b1', type: 'bed', name: 'Plot', width: 100, length: 200, margin: 10, history: [] }];
    const p = { id: 'cb', containerId: 'b1', cropId: 'cabbage', method: 'seedling', layout: 'staggered', from: 0, to: 200, rowSp: 45, plantSp: 45, sowDate: '2026-10-18', status: 'active', photos: {}, series: [], harvests: [], fert: [{ product: 'Chicken manure', amount: 4, unit: 'handful' }] };
    const d = { cropId: 'cabbage', sowDate: p.sowDate, method: 'seedling', containerId: 'b1', daysHarvest: crop('cabbage').daysHarvest }; recalc(d); p.harvestDate = d.harvestDate;
    S.plantings = [p]; S.tasks = [{ id: 'old', plantingId: 'cb', kind: 'feed', title: 'Side-dress (追肥): Chicken manure 3 handfuls — 3–4 weeks after planting', product: 'Chicken manure', amount: 3, unit: 'handful', due: '2026-11-17', done: false }];
    S.plenty = ['chickenManure']; await save(); });
  await pg.goto(U + '#/plant/cb'); await pg.waitForTimeout(500);
  console.log('\nCARD:', (await pg.textContent('section.feeding')).replace(/\s+/g, ' ').slice(0, 700));
  await pg.locator('section.feeding').screenshot({ path: `${SP}/lean_card.png` });
  await pg.evaluate(() => { const t = S.tasks.find(t => t.id === 'old'); S.tasks = S.tasks.filter(x => x !== t); });
  await pg.click('[data-act=addSideDress]'); await pg.waitForTimeout(600);
  console.log('\nPLAN:', (await pg.textContent('#modal .sheet')).replace(/\s+/g, ' ').slice(0, 1100));
  await pg.locator('#modal .sheet').screenshot({ path: `${SP}/lean_plan.png` });
  console.log('errs', errs); await b.close();
})();
