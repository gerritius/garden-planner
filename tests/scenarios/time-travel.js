// Time travel on the test site: move the test garden to another date; the whole app sees that "today", the forecast is
// what the weather did on those days (records — from the latest year that has them, for days still to come), and
// "Back to today" returns, dropping the borrowed weather. The real site never moves.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/', T = U + 'test/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());   // the real forecast: not used while travelling
  const asked = [];
  await ctx.route('**/archive-api.open-meteo.com/**', r => { const q = new URL(r.request().url()).searchParams;
    if (!q.get('hourly')) return r.abort();   // (the 10-year climate: not needed here)
    asked.push(`${q.get('start_date')}…${q.get('end_date')}`);
    const days = 14, time = [], tmax = [], tmin = [], rain = [], code = [], wind = [], gust = [], ht = [], hT = [], hp = [], hw = [], hg = [], soil = [];
    for (let i = 0; i < days; i++) { const d = new Date(q.get('start_date') + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + i); const ds = d.toISOString().slice(0, 10);
      time.push(ds); tmax.push(14 + i * 0.5); tmin.push(4 + i * 0.5); rain.push(i === 9 ? 12 : 0); code.push(i === 9 ? 63 : 1); wind.push(10); gust.push(20);
      for (let h = 0; h < 24; h++) { ht.push(`${ds}T${String(h).padStart(2, '0')}:00`); hT.push(9 + i * 0.5); hp.push(i === 9 ? 0.5 : 0); hw.push(10); hg.push(20); soil.push(10 + i * 0.4); } }
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ daily: { time, weather_code: code, temperature_2m_max: tmax, temperature_2m_min: tmin, precipitation_sum: rain, wind_speed_10m_max: wind, wind_gusts_10m_max: gust },
      hourly: { time: ht, temperature_2m: hT, precipitation: hp, wind_speed_10m: hw, wind_gusts_10m: hg, soil_temperature_0_to_7cm: soil } }) }); });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(T); await pg.waitForTimeout(500);
  await pg.evaluate(async () => {
    S.weather = { lat: 35.75, lon: 139.42, name: 'Higashiyamato' };
    S.containers = [{ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 160, margin: 10, history: [], covers: [] }];
    S.plantings = [{ id: 'sp', cropId: 'spinach', containerId: 'b1', from: 0, to: 80, layout: 'rows', rowSp: 15, plantSp: 5, method: 'seed', sowDate: '2026-11-08', status: 'active', photos: {}, series: [], harvests: [] }];
    S.tempHist = { '2026-11-10': 11 }; await save();
  });
  const now = () => pg.evaluate(() => `today ${todayStr()} (really ${realToday()}) · shift ${timeShift()} · badge "${document.querySelector('.sitebadge').textContent}"`);
  console.log('start:', await now());
  // +30 days
  await pg.goto(T + '#/settings'); await pg.waitForTimeout(300);
  await pg.click('[data-act=ttStep][data-d="30"]'); await pg.waitForLoadState('load'); await pg.waitForTimeout(1200);
  console.log('+30 d:', await now());
  console.log('  records asked for:', asked.join(', '));
  await pg.goto(T + '#/'); await pg.waitForTimeout(500);
  console.log('  forecast:', await pg.evaluate(() => [...document.querySelectorAll('.wxd')].map(d => d.textContent.replace(/\s+/g, ' ').trim()).slice(0, 4).join(' | ')), '|', await pg.textContent('.wxfoot'));
  console.log('  spinach harvest', await pg.evaluate(() => planting('sp').harvestDate), '| jobs today:', await pg.evaluate(() => S.tasks.filter(t => !t.done && t.due <= todayStr()).map(t => t.title).slice(0, 4).join('; ')));
  // go to a date in the past: that year's own records
  await pg.goto(T + '#/settings'); await pg.waitForTimeout(300);
  await pg.fill('#ttDate', '2026-06-10'); await pg.click('[data-act=ttGo]'); await pg.waitForLoadState('load'); await pg.waitForTimeout(1200);
  console.log('to 10 Jun:', await now(), '| records', asked[asked.length - 1]);
  await pg.goto(T + '#/settings'); await pg.waitForTimeout(300);
  console.log('  Tools:', await pg.evaluate(() => document.querySelector('.timetravel p').textContent.replace(/\s+/g, ' ')));
  // back to today: borrowed weather for days still to come is dropped
  await pg.click('[data-act=ttStep][data-d="30"]'); await pg.waitForLoadState('load'); await pg.waitForTimeout(1200);   // (10 July: records kept as "what happened")
  await pg.goto(T + '#/settings'); await pg.waitForTimeout(300);
  await pg.fill('#ttDate', '2027-01-20'); await pg.click('[data-act=ttGo]'); await pg.waitForLoadState('load'); await pg.waitForTimeout(1200);
  console.log('to 20 Jan 2027: records', asked[asked.length - 1], '| weather days after real today held:', await pg.evaluate(() => Object.keys(S.tempHist).filter(d => d >= realToday()).length));
  await pg.goto(T + '#/settings'); await pg.waitForTimeout(300);
  await pg.click('[data-act=ttBack]'); await pg.waitForLoadState('load'); await pg.waitForTimeout(1200);
  console.log('back:', await now(), '| weather days after real today held:', await pg.evaluate(() => Object.keys(S.tempHist).filter(d => d >= realToday()).length), '| from records?', await pg.evaluate(() => !!S.weather.from));
  // the real site ignores it
  await pg.evaluate(() => localStorage.setItem('gp.timeShift', '30'));
  await pg.goto(U); await pg.waitForTimeout(500);
  console.log('real site:', await pg.evaluate(() => `today ${todayStr()} · shift ${timeShift()} · time travel in Tools ${!!document.querySelector('.timetravel')}`));
  console.log('errs', errs); await b.close();
})();
