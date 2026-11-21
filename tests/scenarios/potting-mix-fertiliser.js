const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  const out = await pg.evaluate(() => {
    S.containers.push({ id: 'g1', type: 'round', name: 'Bag T', diameter: 40, depth: 35, margin: 2, history: [], mixLog: [{ id: 'm', date: '2026-09-10', kind: 'touikawa', fresh: true }] },
      { id: 'g2', type: 'round', name: 'Bag I', diameter: 40, depth: 35, margin: 2, history: [], mixLog: [{ id: 'm2', date: '2026-10-01', kind: 'iris', fresh: true }] },
      { id: 'g3', type: 'round', name: 'Bag I2', diameter: 40, depth: 35, margin: 2, history: [], mixLog: [{ id: 'm3', date: '2026-09-15', kind: 'iris', fresh: true }] });
    const P = (id, cid, cropId, sow, fert) => { const p = { id, containerId: cid, cropId, method: 'seedling', layout: 'center', from: 0, to: 40, rowSp: 20, plantSp: 20, sowDate: sow, status: 'active', photos: {}, series: [], harvests: [], fert: fert || [] }; p.harvestDate = harvestEstimate(p); S.plantings.push(p); return p; };
    const ce = P('ce', 'g1', 'celery', '2026-09-15', [{ product: '化成肥料 8-8-8', amount: 120, unit: 'g' }]);
    const le = P('le', 'g2', 'lettuce', '2026-10-03');
    const ko = P('ko', 'g3', 'komatsuna', '2026-11-15');
    const show = p => { const L = feedLedger(p), sim = feedSim(p, L), soil = L.lines.find(l => l.g === 'soil');
      return `${p.cropId}: soil line "${soil.label}" N ${soil.n.toFixed(2)} P ${soil.p.toFixed(2)} K ${soil.k.toFixed(2)} | need N ${L.need.toFixed(1)} P ${L.needP.toFixed(1)} | ${sim.shortFrom ? 'fed until ' + sim.shortFrom : 'fed to ' + sim.end} | base plan ${JSON.stringify(baseFertPlan(p.cropId, container(p.containerId), 0, 40, p.sowDate))}`; };
    return [show(ce), show(le), show(ko), baseFertNote('lettuce', container('g2')), baseFertNote('celery', container('g1'))].join('\n');
  });
  console.log(out); console.log('errs', errs); await b.close();
})();
