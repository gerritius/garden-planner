const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  console.log(JSON.stringify(await pg.evaluate(async () => {
    const out = {};
    const mk = (cropId, sowDate, germ) => ({ cropId, sowDate, method: 'seed', germ: germ ? { result: 'good', date: germ } : null });
    out.snappea_old = addDays('2026-11-01', 20);
    out.snappea_up16Nov = thinEstimate(mk('snappea', '2026-11-01', '2026-11-16'));
    out.snappea_notup = thinEstimate(mk('snappea', '2026-11-01'));
    out.komatsuna_Nov10 = thinEstimate(mk('komatsuna', '2026-11-10'));
    out.komatsuna_Sep10 = thinEstimate(mk('komatsuna', '2026-09-10')) + ' (old: ' + addDays('2026-09-10', 14) + ')';
    out.hakusai_Aug25 = thinEstimate(mk('hakusai', '2026-08-25')) + ' (old: ' + addDays('2026-08-25', 25) + ')';
    out.spinach_Dec1 = thinEstimate(mk('spinach', '2026-12-01'));
    out.corn_May1 = thinEstimate(mk('corn', '2026-05-01')) + ' (old: ' + addDays('2026-05-01', 20) + ')';
    // live planting auto-updates, fixed one doesn't
    S.containers.push({ id: 'b1', type: 'bed', name: 'Bed 2', width: 100, length: 200, margin: 10, history: [] });
    S.plantings.push({ id: 'sp', containerId: 'b1', cropId: 'snappea', method: 'seed', layout: 'rows', from: 0, to: 100, rowSp: 30, plantSp: 10, thinSp: 25, thinStage: '本葉2–3枚で2本立ち', sowDate: '2026-11-01', thinDate: '2026-11-21', harvestDate: '2027-04-10', status: 'active', germ: { result: 'good', date: '2026-11-16' }, photos: {}, series: [], harvests: [] });
    S.plantings.push({ id: 'sp2', containerId: 'b1', cropId: 'snappea', method: 'seed', layout: 'rows', from: 100, to: 200, rowSp: 30, plantSp: 10, thinSp: 25, sowDate: '2026-11-01', thinDate: '2026-11-25', thinFixed: true, harvestDate: '2027-04-10', status: 'active', photos: {}, series: [], harvests: [] });
    syncTasks(planting('sp')); syncTasks(planting('sp2')); await save();
    return out;
  })));
  await pg.goto(U + '#/plant/sp'); await pg.waitForTimeout(400);
  console.log('tasks', JSON.stringify(await pg.evaluate(() => S.tasks.filter(t => t.kind === 'thin').map(t => [t.plantingId, t.due]))));
  console.log('row', (await pg.textContent('dl.details')).match(/Thinning.*?temperatures\)/)?.[0]);
  console.log('errs', errs); await b.close();
})();
