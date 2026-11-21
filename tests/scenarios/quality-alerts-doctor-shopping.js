const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });   // external images can't load in tests
  pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    const td = todayStr(), days = [-7,-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6].map(n => addDays(td, n));
    const hrs = []; days.forEach(d => { for (let h = 0; h < 24; h++) hrs.push(d + 'T' + String(h).padStart(2,'0') + ':00'); });
    S.weather = { lat: 35, lon: 139, name: 'Test', fetched: Date.now(),
      daily: { time: days, weather_code: days.map(() => 3), temperature_2m_max: days.map((d,i) => i === 9 ? 29 : 15), temperature_2m_min: days.map((d,i) => i === 10 ? -3 : 6), precipitation_sum: days.map((d,i) => i === 11 ? 30 : 0), precipitation_probability_max: days.map((d,i) => i === 11 ? 90 : 5), wind_speed_10m_max: days.map(() => 8), wind_gusts_10m_max: days.map(() => 15) },
      hourly: { time: hrs, temperature_2m: hrs.map(() => 12), precipitation: hrs.map(() => 0), precipitation_probability: hrs.map(() => 5), wind_speed_10m: hrs.map(() => 4), wind_gusts_10m: hrs.map(() => 10), soil_temperature_6cm: hrs.map(() => 11) } };
    S.rainHist = {}; for (let i = 1; i <= 6; i++) S.rainHist[addDays(td, -i)] = 0;
    S.containers.push({ id: 'b1', type: 'bed', name: 'Bed 2', width: 100, length: 200, margin: 10, history: [] });
    S.plantings.push({ id: 'hk', containerId: 'b1', cropId: 'hakusai', method: 'seed', layout: 'staggered', from: 0, to: 70, rowSp: 60, plantSp: 45, sowDate: '2026-09-01', harvestDate: addDays(td, 3), spread: 50, status: 'active', thinned: true, photos: {}, series: [], harvests: [] });
    S.plantings.push({ id: 'lt', containerId: 'b1', cropId: 'lettuce', variety: 'リーフ', method: 'seedling', layout: 'rows', from: 70, to: 120, rowSp: 25, plantSp: 25, sowDate: '2026-10-01', harvestDate: addDays(td, 2), spread: 25, status: 'active', photos: {}, series: [], harvests: [] });
    S.plantings.push({ id: 'pl', containerId: 'b1', cropId: 'cabbage', method: 'seedling', raise: 'buy', layout: 'staggered', from: 120, to: 200, rowSp: 45, plantSp: 45, sowDate: addDays(td, 20), harvestDate: addDays(td, 100), spread: 45, status: 'planned', photos: {}, series: [], harvests: [], fert: [{ product: 'Cow manure compost', amount: 1.5, unit: 'kg' }, { product: 'Bokashi', amount: 160, unit: 'g' }] });
    S.plantings.push({ id: 'pl2', containerId: 'b1', cropId: 'snappea', method: 'seed', layout: 'rows', from: 0, to: 70, rowSp: 30, plantSp: 10, sowDate: addDays(td, 25), harvestDate: addDays(td, 150), spread: 30, status: 'planned', photos: {}, series: [], harvests: [], fert: [{ product: 'Bokashi', amount: 100, unit: 'g' }] });
    await save();
  });
  await pg.goto(U); await pg.waitForTimeout(500);
  console.log('quality', await pg.$$eval('.wxalert.quality', x => x.map(e => e.textContent.trim())));
  console.log('sow chips', await pg.$$eval('.sowchips .chip', x => x.map(e => e.textContent.trim())));
  await pg.goto(U + '#/doctor?p=hk'); await pg.waitForTimeout(300);
  await pg.click('[data-s=holes]'); await pg.waitForTimeout(200); await pg.click('[data-s=frass]'); await pg.waitForTimeout(300);
  console.log('dx', await pg.$$eval('section.dx h3', x => x.map(e => e.textContent.trim())));
  console.log('sprays', (await pg.textContent('section.dx.top')).replace(/\s+/g, ' ').match(/Your sprays.*?(?=📝)/)?.[0]);
  await pg.screenshot({ path: SP + '/doctor.png', fullPage: true });
  await pg.click('section.dx.top [data-act=toDiary]'); await pg.waitForTimeout(200);
  console.log('diary', JSON.stringify(await pg.evaluate(() => planting('hk').diary)));
  await pg.goto(U + '#/shop'); await pg.waitForTimeout(300);
  console.log('shop', await pg.$$eval('.plist.shop li .grow', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim())));
  await pg.screenshot({ path: SP + '/shop.png', fullPage: true });
  await pg.click('.plist.shop li [data-act=shopBuy]'); await pg.waitForTimeout(200); await pg.fill('#buyf input[name=cost]', '980'); await pg.click('#buyf button.primary'); await pg.waitForTimeout(300);
  await pg.evaluate(() => purchaseDialog()); await pg.waitForTimeout(200);
  await pg.fill('#buyf input[name=item]', 'Insect netting 1.8 × 5 m'); await pg.selectOption('#buyf select[name=cat]', 'net'); await pg.fill('#buyf input[name=cost]', '1480'); await pg.check('#buyf input[name=nodate]'); await pg.click('#buyf button.primary'); await pg.waitForTimeout(300);
  await pg.evaluate(() => purchaseDialog()); await pg.waitForTimeout(200);
  await pg.fill('#buyf input[name=item]', 'Bokashi'); await pg.dispatchEvent('#buyf input[name=item]', 'change'); await pg.fill('#buyf input[name=cost]', '1280'); await pg.click('#buyf button.primary'); await pg.waitForTimeout(300);
  await pg.goto(U + '#/spend'); await pg.waitForTimeout(300);
  console.log('spend', (await pg.textContent('.spendtot')).trim(), JSON.stringify(await pg.evaluate(() => S.purchases.map(x => [x.item, x.cat, x.cost, x.date]))));
  await pg.screenshot({ path: SP + '/spend.png', fullPage: true });
  await pg.goto(U + '#/settings'); await pg.waitForTimeout(3800); await pg.goto(U + '#/'); await pg.goto(U + '#/settings'); await pg.waitForTimeout(500);
  console.log('snaps', await pg.$$eval('#snaps li', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim())));
  await pg.goto(U + '#/plant/new/b1?crop=spinach'); await pg.waitForTimeout(400);
  console.log('soil form', await pg.textContent('.hint.soil').catch(() => 'none'));
  console.log('errs', errs); await b.close();
})();
