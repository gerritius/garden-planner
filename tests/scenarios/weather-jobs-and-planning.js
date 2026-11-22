const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b, { openFolds: true });
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    const td = todayStr(), days = [-1,0,1,2,3,4,5,6].map(n => addDays(td, n));
    const rain = { [addDays(td,3)]: 55 }, gust = { [addDays(td,2)]: 62 };
    const hrs = []; days.forEach(d => { for (let h = 0; h < 24; h++) hrs.push(d + 'T' + String(h).padStart(2,'0') + ':00'); });
    const hr = t => ({ d: t.slice(0,10), h: +t.slice(11,13) });
    S.weather = { lat: 35, lon: 139, name: 'Test', fetched: Date.now(),
      daily: { time: days, weather_code: days.map(() => 3), temperature_2m_max: days.map(() => 16), temperature_2m_min: days.map(() => 7), precipitation_sum: days.map(d => rain[d] || 0), precipitation_probability_max: days.map(d => rain[d] ? 90 : 10), wind_speed_10m_max: days.map(d => gust[d] ? 35 : 10), wind_gusts_10m_max: days.map(d => gust[d] || 20) },
      hourly: { time: hrs, temperature_2m: hrs.map(t => 8 + Math.sin(hr(t).h / 24 * Math.PI) * 8),
        precipitation: hrs.map(t => { const {d,h} = hr(t); return rain[d] ? 3 : (d === addDays(td,1) && h >= 15 && h <= 17) ? 1 : 0; }),
        precipitation_probability: hrs.map(t => { const {d,h} = hr(t); return rain[d] ? 90 : (d === addDays(td,1) && h >= 15 && h <= 17) ? 70 : 5; }),
        wind_speed_10m: hrs.map(t => gust[hr(t).d] ? 30 : 6), wind_gusts_10m: hrs.map(t => gust[hr(t).d] ? 60 : 12) } };
    S.containers.push({ id: 'b1', type: 'bed', name: 'Bed 2', width: 100, length: 200, margin: 10, history: [] }, { id: 'g1', type: 'round', name: 'Bag 1', diameter: 40, depth: 35, margin: 2, history: [] });
    S.plantings.push({ id: 'hk', containerId: 'b1', cropId: 'hakusai', method: 'seed', layout: 'staggered', from: 0, to: 100, rowSp: 60, plantSp: 45, sowDate: '2026-09-01', harvestDate: '2026-11-25', spread: 50, status: 'active', thinned: true, photos: {}, series: [], harvests: [] });
    S.plantings.push({ id: 'tm', containerId: 'b1', cropId: 'snappea', method: 'seed', layout: 'rows', from: 100, to: 200, rowSp: 30, plantSp: 10, sowDate: '2026-11-01', harvestDate: '2027-04-20', spread: 30, status: 'active', photos: {}, series: [], harvests: [] });
    await save();
  });
  await pg.goto(U); await pg.waitForTimeout(400);
  console.log('wx tasks', JSON.stringify(await pg.evaluate(() => S.tasks.filter(t => t.kind === 'wx').map(t => [t.wx, t.due, t.title]))));
  console.log('spray line', await pg.textContent('.wxspray').catch(() => 'none'));
  await pg.screenshot({ path: SP + '/home19.png', fullPage: true });
  await pg.evaluate(() => taskDialog(S.tasks.find(t => t.kind === 'wx' && t.wx === 'wind'))); await pg.waitForTimeout(200);
  await pg.screenshot({ path: SP + '/wxdlg.png' }); await pg.click('[data-x=ok]');
  await pg.goto(U + '#/sprayday'); await pg.waitForTimeout(300); await pg.screenshot({ path: SP + '/sprayday.png', fullPage: true });
  await pg.goto(U + '#/plan'); await pg.waitForTimeout(300); await pg.screenshot({ path: SP + '/plan.png', fullPage: true });
  console.log('gaps', (await pg.$$eval('li.gap', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim()))).slice(0, 4));
  // plan cabbage after hakusai via chip
  const href = await pg.$eval('li.gap a.chip[href*="crop=cabbage"]', a => a.getAttribute('href')).catch(() => null);
  console.log('cabbage chip', href);
  await pg.goto(U + (href || '#/plant/new/b1?plan=1&from=0&to=100&date=2026-12-20&crop=cabbage')); await pg.waitForTimeout(500);
  await pg.click('[data-act=method][data-v=seedling]'); await pg.waitForTimeout(300);
  await pg.click('[data-act=raise][data-v=tray]'); await pg.waitForTimeout(300);
  console.log('harvest', await pg.inputValue('#pf input[name=harvestDate]'), 'rot', await pg.textContent('#rotWarn'));
  await pg.screenshot({ path: SP + '/planform.png', fullPage: true });
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(500);
  if (await pg.$('#modal [data-x=ok]')) { console.log('asked:', (await pg.textContent('#modal .msg')).slice(0, 120)); await pg.click('#modal [data-x=ok]'); await pg.waitForTimeout(500); }
  await pg.waitForURL(u => !/\/plant\/new\//.test(u), { timeout: 5000 }).catch(() => {});   // saving moves on to the new planting
  console.log('after save url', pg.url());
  console.log('plan', JSON.stringify(await pg.evaluate(() => { const p = S.plantings.find(p => p.cropId === 'cabbage'); return [p.status, p.sowDate, p.raise, p.harvestDate, S.tasks.filter(t => t.plantingId === p.id && !t.done).map(t => [t.kind, t.due, t.title])]; })));
  await pg.screenshot({ path: SP + '/planpage.png', fullPage: true });
  await pg.screenshot({ path: SP + '/planpage2.png', fullPage: false }); await pg.evaluate(() => window.scrollTo(0, 1800)); await pg.waitForTimeout(100); await pg.screenshot({ path: SP + '/planpage3.png' });
  // tick the tray sowing task
  const tt = await pg.evaluate(() => S.tasks.find(t => t.kind === 'plan_tray' && !t.done).id);
  await pg.evaluate(id => toggleTask(id, true), tt); await pg.waitForTimeout(300);
  console.log('preset count', await pg.inputValue('#sdf input[name=count]'));
  await pg.click('#sdf button.primary'); await pg.waitForTimeout(400);
  console.log('start', JSON.stringify(await pg.evaluate(() => { const s = S.starts[0]; return [s.cropId, s.count, s.planId ? 'linked' : 'no', S.tasks.filter(t => t.startId === s.id && !t.done).map(t => t.kind), S.tasks.find(t => t.kind === 'plan_tray').done]; })));
  // plant out into planned spot
  await pg.goto(U + '#/seedlings'); await pg.waitForTimeout(300);
  await pg.click('[data-act=plantOut]'); await pg.waitForTimeout(200); await pg.screenshot({ path: SP + '/plantout_plan.png' });
  await pg.click('[data-plan]'); await pg.waitForTimeout(500);
  console.log('activated', JSON.stringify(await pg.evaluate(() => { const p = S.plantings.find(p => p.cropId === 'cabbage'); const s = S.starts[0]; return [p.status, p.sowDate, p.harvestDate, s.status, startLeft(s), S.tasks.filter(t => t.plantingId === p.id && !t.done).map(t => t.kind)]; })));
  console.log('errs', errs); await b.close();
})();
