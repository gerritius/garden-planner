const { newContext, FIXED_NOW } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const pg = await (await newContext(b, { products: true })).newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.route('**/api.open-meteo.com/**', r => r.abort());
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    const td = todayStr(), D = n => addDays(td, n);
    S.weather = { lat: 35.6, lon: 139.6, name: 'Tokyo', fetched: Date.now(), daily: { time: [D(-1), D(0), D(1), D(2), D(3), D(4), D(5)], weather_code: [0, 0, 0, 0, 0, 0, 0], temperature_2m_max: [14, 13, 10, 9, 12, 13, 14], temperature_2m_min: [6, 5, 3, -2, 4, 5, 6], precipitation_sum: [0, 0, 0, 0, 0, 0, 0], precipitation_probability_max: [0, 0, 0, 0, 0, 0, 0], wind_speed_10m_max: [5, 5, 5, 5, 5, 5, 5] } };
    S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [{ id: 'hx', manual: true, cropId: 'edamame', from: 0, to: 200, sowDate: '2026-05-01', harvestedOn: '2026-08-31' }] },
      { id: 'g1', type: 'round', name: 'Bag 1', diameter: 40, depth: 35, margin: 2, history: [{ id: 'hy', manual: true, cropId: 'minitomato', from: 0, to: 40, sowDate: '2026-04-01', harvestedOn: '2026-09-30' }] },
      { id: 'g2', type: 'round', name: 'Bag 2', diameter: 40, depth: 35, margin: 2, history: [] });
    S.plantings.push({ id: 'hk', containerId: 'b1', cropId: 'hakusai', method: 'seed', layout: 'staggered', from: 0, to: 200, rowSp: 45, plantSp: 45, thinSp: 45, sowDate: '2026-09-05', thinDate: '2026-09-30', harvestDate: '2026-11-25', spread: 50, status: 'active', photos: {}, harvests: [],
      series: [{ id: 's1', title: 'Side-dress', product: '化成肥料 8-8-8', amount: 30, unit: 'g', every: 2, per: 'week', start: '2026-10-01' }] });
    S.plantings.push({ id: 'lt', containerId: 'g2', cropId: 'lettuce', method: 'seedling', layout: 'center', from: 0, to: 40, plantSp: 25, sowDate: '2026-10-15', harvestDate: '2026-12-10', spread: 25, status: 'active', photos: {}, series: [], harvests: [] });
    syncTasks(planting('hk')); syncTasks(planting('lt'));
    S.tasks.filter(t => t.seriesId === 's1').forEach(t => { t.done = true; t.doneOn = '2026-10-01'; });
    S.tasks.push({ id: 'sx', plantingId: 'hk', kind: 'series', seriesId: 's1', title: 'Side-dress', due: '2026-10-15', done: true, doneOn: '2026-10-15' });
    S.log = [{ id: 'l1', date: '2026-10-20', kind: 'fert', product: 'Bokashi', amount: 2, unit: 'handful', cids: ['b1', 'g1', 'g2'], pids: [], per: 'each' },
             { id: 'l2', date: '2026-11-01', kind: 'fert', product: 'Bokashi', amount: 300, unit: 'g', cids: ['b1', 'g1'], pids: [], per: 'total' }];
    await save();
  });
  // spray with PHI via dialog
  await pg.goto(U + '#/log'); await pg.waitForTimeout(300);
  await pg.click('button[data-act=newLog]'); await pg.waitForTimeout(200);
  await pg.selectOption('#lf select[name=kind]', 'spray'); await pg.fill('#lf input[name=product]', 'Sumithion'); await pg.fill('#lf input[name=amount]', '1'); await pg.selectOption('#lf select[name=unit]', 'mL');
  await pg.fill('#lf input[name=phi]', '14'); await pg.fill('#lf input[name=date]', addDaysLocal(-3));
  await pg.click('#lf label.chip.tog:has(input[value=b1])'); await pg.click('#lf label.chip.tog:has(input[value=g1])');
  console.log('per row visible', await pg.isVisible('#perrow'));
  await pg.click('#lf button.primary'); await pg.waitForTimeout(300);
  console.log('phi mem', await pg.evaluate(() => S.phi));
  await pg.goto(U); await pg.waitForTimeout(400); await pg.screenshot({ path: SP + '/home14.png', fullPage: true });
  console.log('frost task', await pg.evaluate(() => S.tasks.filter(t => t.kind === 'frost').map(t => [t.title, t.due])));
  console.log('alerts', await pg.evaluate(() => Weather.alerts().map(a => a[1])));
  console.log('spray alert', await pg.textContent('.banner.warn:not(.clim)').catch(() => null));
  await pg.goto(U + '#/plant/hk'); await pg.waitForTimeout(300); const tx = await pg.textContent('main');
  console.log('banner', tx.match(/Sprayed.*?wait\)/)?.[0]); console.log('soil', tx.match(/Soil.{0,160}/)?.[0]);
  await pg.click('[data-act=logHarvest]'); await pg.waitForTimeout(200); console.log('harvest dlg warn', !!(await pg.$('#modal .banner.warn')));
  await pg.goto(U + '#/totals'); await pg.waitForTimeout(300); await pg.screenshot({ path: SP + '/tot14.png', fullPage: true });
  console.log('totals', (await pg.textContent('main')).replace(/\s+/g, ' ').slice(0, 400));
  await pg.goto(U + '#/container/b1'); await pg.waitForTimeout(300); await pg.click('[data-act=bedMore]'); await pg.waitForTimeout(150); await pg.click('[data-m=prep]'); await pg.waitForTimeout(200);
  console.log('prep', (await pg.textContent('#modal')).replace(/\s+/g, ' ').slice(0, 300));
  // plant form soil note: carrot after edamame
  await pg.evaluate(async () => { S.plantings = S.plantings.filter(p => p.id !== 'hk'); await save(); }); await pg.goto(U + '#/plant/new/b1?crop=carrot'); await pg.waitForTimeout(300); console.log('form', await pg.textContent('#rotWarn'));
  await pg.goto(U + '#/plant/new/g1?crop=nasu'); await pg.waitForTimeout(300); console.log('form2', await pg.textContent('#rotWarn'));
  console.log('errs', errs); await b.close();
  function addDaysLocal(n) { const d = new Date(FIXED_NOW); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
})();
