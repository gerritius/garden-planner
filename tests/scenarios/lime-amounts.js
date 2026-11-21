const { newContext } = require('../lib');
// lime amounts scale with the space, and agree everywhere
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.goto(U); await pg.waitForTimeout(400);
  console.log(await pg.evaluate(async () => {
    const td = todayStr();
    S.containers = [
      { id: 'g1', type: 'round', name: 'Bag 1', diameter: 40, depth: 35, margin: 2, history: [{ cropId: 'kyuri', sowDate: '2026-05-01', harvestedOn: '2026-08-30', from: 0, to: 40 }], soil: [{ id: 'r1', date: td, from: 0, to: 40, ph: 5.5 }], mixLog: [{ id: 'm', date: '2026-03-01', kind: 'touikawa', fresh: false }] },
      { id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [], soil: [{ id: 'r2', date: td, from: 0, to: 200, ph: 5.5 }] },
      { id: 'b2', type: 'bed', name: 'Plot B', width: 100, length: 200, margin: 10, history: [], soil: [{ id: 'r3', date: td, from: 0, to: 200, ph: 7.4 }] }];
    S.plantings = []; await save();
    const lime = l => (l.find(f => /lime/i.test(f.product)) || {}).amount;
    const rows = [];
    for (const [cid, from, to] of [['g1', 0, 40], ['b1', 0, 90], ['b1', 0, 200], ['b2', 0, 200]]) {
      const c = container(cid), adv = soilReadingAdvice(c, from, to, 'spinach');
      rows.push(`${c.name} ${from}–${to}: advice "${adv.bits[0]}" | starting fertiliser lime ${lime(baseFertPlan('spinach', c, from, to, td)) ?? 'none'} g`);
    }
    return rows.join('\n');
  }));
  for (const cid of ['g1', 'b1', 'b2']) {
    await pg.goto(U + '#/container/' + cid); await pg.waitForTimeout(300);
    await pg.evaluate(c => prepDialog(container(c)), cid); await pg.waitForTimeout(200);
    console.log(cid, 'prep:', (await pg.textContent('#modal .sheet')).replace(/\s+/g, ' ').slice(0, 260));
    await pg.click('#modal [data-x=no]').catch(() => {});
  }
  console.log('errs', errs); await b.close();
})();
