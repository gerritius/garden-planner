// No location: pick a climate type (Köppen–Geiger) and hemisphere instead of the built-in western Tokyo. The type's
// typical year sets sowing months, frost and seasons; setting a location later replaces it with that place's records.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  let up = false; const PER = [24.5, 24.8, 22.9, 19.8, 16.6, 14.2, 13.2, 13.6, 15.0, 17.3, 20.3, 22.6];   // Perth-like
  await ctx.route('**/archive-api.open-meteo.com/**', r => { if (!up) return r.abort(); const time = [], t = [], mn = [], p = [];
    for (let y = 2016; y <= 2025; y++) for (let m = 1; m <= 12; m++) { const n = new Date(y, m, 0).getDate(); for (let d = 1; d <= n; d++) { time.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`); t.push(PER[m - 1]); mn.push(PER[m - 1] - 7); p.push(2); } }
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ daily: { time, temperature_2m_mean: t, temperature_2m_min: mn, precipitation_sum: p } }) }); });
  await ctx.route('**/geocoding-api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ results: [{ name: 'Perth', admin1: 'Western Australia', country: 'Australia', latitude: -31.95, longitude: 115.86 }] }) }));
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => { S.weather = null; delete S.climate; await save(); });
  const tools = async () => { await pg.goto(U + '#/settings'); await pg.waitForTimeout(300); await pg.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true)); };
  const state = () => pg.evaluate(() => `${S.climate ? S.climate.name : 'built-in'} · Jan ${normalT('2026-01-15')}° Jul ${normalT('2026-07-15')}° · tomato ${crop('tomato').sow} · garlic ${crop('garlic').sow} · frost ${hasFrostDates() ? firstFrostAfter('2026-08-01') : 'none'} · south ${southern()} · solar term "${sekki(new Date('2026-11-18'))}"`);
  await tools();
  console.log('types:', await pg.$$eval('[data-act=climType] b', x => x.map(e => e.textContent).join(' | ')));
  console.log('start:', await state());
  await pg.click('[data-act=climType][data-id=Cfb]'); await pg.waitForTimeout(300);
  console.log('oceanic:', await state());
  console.log('  Tools says:', (await pg.textContent('.climrow')).replace(/\s+/g, ' ').trim().slice(0, 60), '|', await pg.evaluate(() => [...document.querySelectorAll('section p')].map(p => p.textContent).find(t => t.includes('usual weather for')) || ''));
  await tools(); await pg.click('[data-act=climHemi][data-v=s]'); await pg.waitForTimeout(300);
  console.log('oceanic, south:', await state());
  await tools(); await pg.click('[data-act=climType][data-id=Csa]'); await pg.waitForTimeout(300);
  console.log('mediterranean, south:', await state());
  // a location set while offline: the picked type still stands (and the home screen says so); once online, Perth's own
  await tools(); await pg.fill('#wxq', 'Perth'); await pg.click('[data-act=wxSearch]'); await pg.waitForTimeout(300); await pg.click('[data-act=wxPick]'); await pg.waitForTimeout(600);
  await pg.goto(U + '#/'); await pg.waitForTimeout(300);
  console.log('Perth, offline:', await state(), '\n  notice:', await pg.evaluate(() => { const n = document.querySelector('.banner.clim'); return n ? n.textContent.replace(/\s+/g, ' ').trim() : '—'; }));
  up = true; await pg.click('[data-act=climRetry]'); await pg.waitForTimeout(1200);
  console.log('Perth, online:', await state());
  // first run: the Where step offers the types too
  await pg.evaluate(async () => { S.weather = null; delete S.climate; S.firstRun = true; await save(); });
  await pg.goto(U + '#/welcome?s=2'); await pg.waitForTimeout(400);
  console.log('welcome step 2:', await pg.evaluate(() => !!document.querySelector('.welcome [data-act=climType]')), '|', await pg.textContent('.welcome .btncol .btn.primary'));
  await pg.click('summary:has-text("climate type")'); await pg.click('.welcome [data-act=climType][data-id=Af]'); await pg.waitForTimeout(300);
  console.log('  picked tropical:', await pg.textContent('.welcome .btncol .btn.primary'), '|', await state());
  await pg.goto(U + '#/settings'); await pg.waitForTimeout(300); await pg.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  await pg.evaluate(async () => { S.weather = null; S.climate = presetClimate('Cfb', true); applyClimate(true); await save(); render(); }); await pg.waitForTimeout(300); await pg.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  // swapping hemisphere redraws the page but keeps the open sections and the place on the page
  await pg.evaluate(() => { document.querySelectorAll('details').forEach(d => d.open = false); document.querySelector('details.climtypes').closest('details.set').open = true; document.querySelector('details.climtypes').open = true; });
  await pg.evaluate(() => document.querySelector('[data-act=climHemi][data-v=n]').scrollIntoView({ block: 'center' })); const y0 = await pg.evaluate(() => Math.round(scrollY));
  await pg.click('[data-act=climHemi][data-v=n]'); await pg.waitForTimeout(300);
  console.log('hemisphere swapped: open', await pg.$$eval('details[open]', x => x.map(d => d.className || d.querySelector('summary').textContent.trim().slice(0, 22)).join(', ')), '| scroll kept', Math.abs(await pg.evaluate(() => Math.round(scrollY)) - y0) <= 2, '|', await pg.evaluate(() => S.climate.name));
  // before a type is picked, the hemisphere alone changes nothing
  await pg.evaluate(async () => { S.climate = null; applyClimate(true); await save(); render(); }); await pg.waitForTimeout(200);
  await pg.click('[data-act=climHemi][data-v=s]'); await pg.waitForTimeout(300);
  console.log('hemisphere first:', await pg.evaluate(() => S.climate ? S.climate.name : 'still built-in'), '| southern tab on', await pg.evaluate(() => document.querySelector('[data-act=climHemi][data-v=s]').classList.contains('on')));
  await pg.click('[data-act=climType][data-id=Cfb]'); await pg.waitForTimeout(300);
  console.log('  then oceanic:', await pg.evaluate(() => S.climate.name));
  const el = await pg.$('details.climtypes'); if (el && process.argv[2]) await el.screenshot({ path: process.argv[2] + '/climtypes.png' });
  console.log('errs', errs); await b.close();
})();
