const { newContext } = require('../lib');
// garlic in a bag: why "fed until 23 Mar" with 11 g / 5.9 g?
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  for (const [label, fert, waterTicks, mixKind, extra] of [['130 g 8-8-8, re-used mix', 130, true, 'reused', []], ['130 g 8-8-8, fresh Touikawa', 130, true, 'fresh', []], ['100 g 8-8-8 + 2 handfuls chicken manure, re-used', 100, true, 'reused', [{ product: 'Chicken manure', amount: 2, unit: 'handful' }]]]) {
    const out = await pg.evaluate(async ([fert, waterTicks, mixKind, extra]) => {
      S.containers = [{ id: 'g1', type: 'round', name: 'Bag 3', diameter: 40, depth: 35, margin: 2, history: [], mixLog: [{ date: mixKind === 'fresh' ? '2026-10-05' : '2026-03-01', kind: 'touikawa', fresh: mixKind === 'fresh' }] }];
      S.plantings = [{ id: 'ga', containerId: 'g1', cropId: 'garlic', method: 'seedling', layout: 'center', from: 0, to: 40, rowSp: 15, plantSp: 15, sowDate: '2026-10-10', status: 'active', photos: {}, series: [], harvests: [], fert: [{ product: 'Chemical fertiliser 8-8-8', amount: fert, unit: 'g' }, ...extra] }]; const d0 = { cropId: 'garlic', sowDate: '2026-10-10', method: 'seedling', containerId: 'g1', daysHarvest: crop('garlic').daysHarvest }; recalc(d0); S.plantings[0].harvestDate = d0.harvestDate;
      S.tasks = [];
      if (waterTicks) for (let d = '2026-10-10'; d < todayStr(); d = addDays(d, 3)) S.tasks.push({ id: uid(), kind: 'water', title: 'Water', due: d, done: true, doneOn: d });
      syncTasks(S.plantings[0]);
      const p = S.plantings[0], L = feedLedger(p), sim = feedSim(p, L), leach = leachFn(L);
      const lines = L.lines.map(l => `${l.name} ${l.n.toFixed(2)}`);
      const rows = []; const tf = tempFor(p.containerId);
      for (const d of ['2026-10-15', '2026-11-01', '2026-11-17', '2026-12-15', '2027-01-15', '2027-02-15', '2027-03-15', '2027-04-15', '2027-05-15', '2027-06-01']) if (sim.poolAt[d] != null) rows.push(`${d} pool ${sim.poolAt[d].toFixed(2)} g  leach/day ${(leach(d) * 100).toFixed(1)}%  temp ${(tf ? tf(d) : dayTemp(d)).toFixed(1)}  grow ${growUnits('garlic', tf ? tf(d) : dayTemp(d)).toFixed(2)}`);
      return { hv: p.harvestDate, need: L.need, total: L.total, lines, shortFrom: sim.shortFrom, end: sim.end, lost: sim.lost, taken: sim.taken, rows, interval: waterInterval(pd('2026-12-15')) };
    }, [fert, waterTicks, mixKind, extra]);
    console.log('\n==', label); console.log(JSON.stringify({ hv: out.hv, need: out.need, total: out.total, shortFrom: out.shortFrom, end: out.end, leached: out.lost.toFixed(1), taken: out.taken.toFixed(1), winterInterval: out.interval }));
    console.log(out.lines.join(' | ')); out.rows.forEach(r => console.log('  ' + r));
  }
  console.log('errs', errs); await b.close();
})();
