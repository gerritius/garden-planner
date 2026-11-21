const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  const setup = async (lastDone) => pg.evaluate(async (lastDone) => {
    const td = todayStr(), days = [-7,-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6].map(n => addDays(td, n));
    const rain = { [addDays(td,0)]: 21, [addDays(td,2)]: 5, [addDays(td,3)]: 20, [addDays(td,4)]: 0.4 };
    S.weather = { lat: 35, lon: 139, name: 'Test', fetched: Date.now(), daily: { time: days, weather_code: days.map(() => 61), temperature_2m_max: days.map(() => 15), temperature_2m_min: days.map(() => 8),
      precipitation_sum: days.map(d => rain[d] || 0), precipitation_probability_max: days.map(d => rain[d] ? 80 : 10), wind_speed_10m_max: days.map(() => 5) } };
    if (!S.containers.length) {
      S.containers.push({ id: 'g1', type: 'round', name: 'Bag 1', diameter: 40, depth: 35, margin: 2, history: [] }, { id: 'b1', type: 'bed', name: 'Bed 1', width: 100, length: 200, margin: 10, history: [] });
      S.plantings.push({ id: 'kom', containerId: 'g1', cropId: 'komatsuna', method: 'seed', layout: 'continuous', from: 0, to: 40, rowSp: 15, plantSp: 1, sowDate: '2026-10-20', harvestDate: '2026-11-25', spread: 15, status: 'active', photos: {}, series: [], harvests: [] });
    }
    S.water = { lastDone }; S.tasks = S.tasks.filter(t => t.kind !== 'water'); await save();
  }, lastDone);
  const w = () => pg.evaluate(() => { syncWater(); const t = S.tasks.find(t => t.kind === 'water' && !t.done); return t.due + ' | ' + t.note; });
  await setup('2026-11-15'); console.log('ticked today :', await w());
  await setup('2026-11-12'); console.log('last 12 Nov  :', await w());
  await setup(null); console.log('never        :', await w());
  await setup('2026-11-09'); console.log('last 9 Nov   :', await w());
  await pg.goto(U); await pg.waitForTimeout(300);
  await pg.evaluate(() => taskDialog(S.tasks.find(t => t.kind === 'water' && !t.done))); await pg.waitForTimeout(200);
  await pg.screenshot({ path: SP + '/waterdlg.png' }); await pg.click('[data-x=ok]');
  // seedlings
  await pg.click('.fab'); await pg.waitForTimeout(200); await pg.click('[data-q=start]'); await pg.waitForTimeout(200);
  await pg.selectOption('#sdf select[name=cropId]', 'hakusai'); await pg.fill('#sdf input[name=count]', '20'); await pg.fill('#sdf input[name=seeds]', '3'); await pg.fill('#sdf input[name=sowDate]', '2026-10-28');
  console.log('hint', await pg.textContent('#tpHint')); await pg.click('#sdf button.primary'); await pg.waitForTimeout(300);
  await pg.evaluate(() => startDialog()); await pg.waitForTimeout(200);
  await pg.selectOption('#sdf select[name=cropId]', 'lettuce'); await pg.fill('#sdf input[name=count]', '12'); await pg.click('#sdf button.primary'); await pg.waitForTimeout(300);
  await pg.evaluate(() => startDialog()); await pg.waitForTimeout(200);
  await pg.selectOption('#sdf select[name=cropId]', 'broccoli'); await pg.click('[data-k=pot]'); await pg.fill('#sdf input[name=count]', '4'); await pg.fill('#sdf input[name=sowDate]', '2026-10-10'); await pg.click('#sdf button.primary'); await pg.waitForTimeout(300);
  console.log('tasks', JSON.stringify(await pg.evaluate(() => S.tasks.filter(t => t.startId).map(t => [t.kind, t.due, t.title]))));
  await pg.screenshot({ path: SP + '/home_seed.png', fullPage: true });
  await pg.goto(U + '#/seedlings'); await pg.waitForTimeout(300); await pg.screenshot({ path: SP + '/seedlings.png', fullPage: true });
  // plant out 15 hakusai into Bed 1
  const hid = await pg.evaluate(() => S.starts.find(s => s.cropId === 'hakusai').id);
  await pg.click(`[data-act=plantOut][data-id="${hid}"]`); await pg.waitForTimeout(200); await pg.fill('#pof input[name=n]', '15'); await pg.click('[data-c=b1]'); await pg.waitForTimeout(500);
  console.log('form', pg.url()); await pg.screenshot({ path: SP + '/plantform.png', fullPage: true });
  await pg.click('#pf button.primary'); await pg.waitForTimeout(500);
  console.log('planting', JSON.stringify(await pg.evaluate(() => { const p = S.plantings.find(p => p.cropId === 'hakusai'); return p && [p.method, p.sowDate, p.harvestDate, p.plantSp, p.startId && 'linked', p.seededOn]; })));
  console.log('page rows', (await pg.textContent('#view')).match(/Raised from seed[^\n]{0,80}/)?.[0]);
  // discard 5 remaining hakusai
  await pg.goto(U + '#/seedlings'); await pg.waitForTimeout(300);
  await pg.click(`[data-act=binStart][data-id="${hid}"]`); await pg.waitForTimeout(200); await pg.click('.libchips label:nth-child(1)'); await pg.click('#dsf button.danger'); await pg.waitForTimeout(300);
  console.log('start', JSON.stringify(await pg.evaluate((id) => { const s = start(id); return [s.status, startLeft(s), s.events.map(e => e.type + e.n)]; }, hid)));
  await pg.screenshot({ path: SP + '/seedlings2.png', fullPage: true });
  await pg.goto(U + '#/log?f=sow'); await pg.waitForTimeout(300);
  console.log('log', (await pg.$$eval('.logi b', x => x.map(e => e.textContent))).slice(0, 6));
  // tick transplant task for lettuce -> opens plant out dialog
  await pg.goto(U + '#/cal'); await pg.waitForTimeout(300);
  console.log('errs', errs); await b.close();
})();
