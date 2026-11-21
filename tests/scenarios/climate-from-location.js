const { newContext } = require('../lib');
// climate from location (mocked archive), sowing calendar, editing months
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  // a fake 10-year archive for Melbourne-like weather
  const mel = [21.3, 21.4, 19.4, 16.6, 13.9, 11.6, 11.0, 11.9, 13.6, 15.6, 17.8, 19.8], melR = [47, 48, 50, 57, 56, 49, 47, 50, 58, 66, 60, 59];
  let calls = 0;
  await ctx.route('**/archive-api.open-meteo.com/**', r => { calls++; const time = [], t = [], p = [];
    for (let y = 2016; y <= 2025; y++) for (let m = 1; m <= 12; m++) { const n = new Date(y, m, 0).getDate(); for (let d = 1; d <= n; d++) { time.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`); t.push(mel[m - 1]); p.push(melR[m - 1] / n); } }
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ daily: { time, temperature_2m_mean: t, precipitation_sum: p } }) }); });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => { delete S.climate; S.weather = null; S.sowOverride = {}; S.plantings = []; S.tasks = []; await save(); });
  await pg.goto(U + '#/sow'); await pg.waitForTimeout(500);
  const row = async id => pg.evaluate(id => [...document.querySelectorAll(`.sowrow i[data-id=${id}]`)].map((e, i) => e.classList.contains('on') ? i + 1 : 0).filter(Boolean).join(','), id);
  console.log('kicker:', await pg.textContent('#kicker'), '| tomato', await row('tomato'), '| garlic', await row('garlic'), '| timing', await pg.evaluate(() => { const t0 = performance.now(); applyClimate(true); return Math.round(performance.now() - t0) + ' ms'; }));
  await pg.screenshot({ path: `${SP}/sowcal.png`, fullPage: true });
  // set a location → climate fetched automatically
  await pg.evaluate(async () => { S.weather = { lat: -37.81, lon: 144.96, name: 'Melbourne' }; await save(); });
  await pg.evaluate(() => ensureClimate()); await pg.waitForTimeout(1500);
  console.log('climate:', JSON.stringify(await pg.evaluate(() => S.climate && [S.climate.name, S.climate.years, S.climate.t.slice(0, 3), S.climate.rain.slice(0, 3)])), 'calls', calls);
  await pg.goto(U + '#/sow'); await pg.waitForTimeout(500);
  console.log('kicker:', await pg.textContent('#kicker'), '| tomato', await row('tomato'), '| garlic', await row('garlic'), '| normalT(Jul)', await pg.evaluate(() => normalT('2026-07-15')));
  // edit tomato months
  await pg.click('[data-act=sowEdit][data-id=tomato]'); await pg.waitForTimeout(200);
  await pg.locator('#modal .sheet').screenshot({ path: `${SP}/sowedit.png` });
  await pg.click('[data-mo="12"]'); await pg.click('[data-mo="8"]'); await pg.click('#modal [data-x=ok]'); await pg.waitForTimeout(300);
  console.log('after edit tomato', await row('tomato'), '| own mark', await pg.evaluate(() => document.querySelector('[data-act=sowEdit][data-id=tomato]').classList.contains('own')), JSON.stringify(await pg.evaluate(() => S.sowOverride)));
  await pg.click('[data-act=sowEdit][data-id=tomato]'); await pg.waitForTimeout(200); await pg.click('#modal [data-x=reset]'); await pg.waitForTimeout(300);
  console.log('after reset tomato', await row('tomato'));
  // settings show it; no second fetch
  await pg.goto(U + '#/settings'); await pg.waitForTimeout(400);
  console.log('settings:', (await pg.evaluate(() => document.querySelector('.climrow') && document.querySelector('.climrow').closest('section').textContent.replace(/\s+/g, ' ').slice(0, 220))), '| calls', calls);
  // back to no location: Tokyo again
  await pg.evaluate(async () => { delete S.climate; S.weather = null; await save(); applyClimate(); });
  console.log('back to Tokyo normalT(Jul)', await pg.evaluate(() => normalT('2026-07-15')), '| tomato', await pg.evaluate(() => crop('tomato').sow.join(',')));
  console.log('errs', errs); await b.close();
})();
