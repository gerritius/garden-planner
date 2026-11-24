// Setting a location fetches that place's usual weather straight away (not on the next visit), and until it's in, the
// home screen says sowing and growth times are still on the built-in Tokyo climate. A climate fetched for another place
// doesn't count once the location moves. South of the equator: no Japanese solar terms, and no "slow winter" in January.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const syd = [23.0, 23.0, 21.8, 19.2, 16.2, 13.7, 12.9, 14.0, 16.4, 18.6, 20.2, 21.9], sydR = [100, 120, 130, 125, 100, 130, 75, 80, 65, 75, 85, 75];
  let archiveUp = false, calls = 0;
  await ctx.route('**/archive-api.open-meteo.com/**', r => { calls++; if (!archiveUp) return r.abort();
    const time = [], t = [], p = [];
    for (let y = 2016; y <= 2025; y++) for (let m = 1; m <= 12; m++) { const n = new Date(y, m, 0).getDate(); for (let d = 1; d <= n; d++) { time.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`); t.push(syd[m - 1]); p.push(sydR[m - 1] / n); } }
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ daily: { time, temperature_2m_mean: t, precipitation_sum: p } }) }); });
  await ctx.route('**/geocoding-api.open-meteo.com/**', r => { const q = new URL(r.request().url()).searchParams.get('name');
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ results: [q === 'Sydney' ? { name: 'Sydney', admin1: 'New South Wales', country: 'Australia', latitude: -33.87, longitude: 151.21 } : { name: 'Higashiyamato', admin1: 'Tokyo', country: 'Japan', latitude: 35.75, longitude: 139.42 }] }) }); });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => { delete S.climate; S.weather = null; S.plantings = []; S.tasks = [];
    S.containers = [{ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 160, margin: 10, history: [], covers: [] }]; await save(); });
  const pick = async name => { await pg.goto(U + '#/settings'); await pg.waitForTimeout(300); await pg.evaluate(() => document.querySelectorAll('details.set').forEach(d => d.open = true));
    await pg.fill('#wxq', name); await pg.click('[data-act=wxSearch]'); await pg.waitForTimeout(300); await pg.click('[data-act=wxPick]'); await pg.waitForTimeout(600); };
  const home = async () => { await pg.goto(U + '#/'); await pg.waitForTimeout(400);
    return { notice: (await pg.evaluate(() => { const n = document.querySelector('.banner.warn'); return n ? n.textContent.replace(/\s+/g, ' ').trim() : '—'; })), sub: await pg.textContent('#sub').catch(() => '') }; };
  const T = () => pg.evaluate(() => `Jan ${normalT('2026-01-15')}° Jul ${normalT('2026-07-15')}° · spinach sown ${crop('spinach').sow.join(',')}`);

  // 1. offline for the archive: picking Sydney tries at once, and the home screen says it's still on Tokyo
  await pick('Sydney');
  console.log('picked Sydney, archive down — tries:', calls, '|', await T());
  console.log('  home:', JSON.stringify(await home()));
  // 2. back online: "Get it now" fetches it
  archiveUp = true; await pg.click('[data-act=climRetry]'); await pg.waitForTimeout(1200);
  console.log('got it — tries:', calls, '|', await T(), '| climate', JSON.stringify(await pg.evaluate(() => S.climate && [S.climate.name, S.climate.t.slice(0, 2)])));
  console.log('  home:', JSON.stringify(await home()));
  // spinach sown now (late spring there) — its feeding isn't a "slow winter stretch" in January
  await pg.evaluate(async () => { S.plantings.push({ id: 'sp', cropId: 'spinach', containerId: 'b1', from: 0, to: 160, layout: 'rows', rowSp: 15, plantSp: 5, method: 'seed', sowDate: '2026-11-18', status: 'active', photos: {}, series: [], harvests: [] }); await save(); });
  await pg.goto(U + '#/plant/sp'); await pg.waitForTimeout(400);
  console.log('spinach:', (await pg.textContent('.datebar')).replace(/\s+/g, ' ').trim(), '| feeding:', await pg.evaluate(() => { const f = document.querySelector('section.feeding'); return f ? f.textContent.replace(/\s+/g, ' ').slice(0, 200) : '—'; }));
  console.log('  says winter?', await pg.evaluate(() => /winter/i.test(document.querySelector('main').textContent)));
  // 3. moving the garden to Tokyo: Sydney's climate no longer counts, and Tokyo's is fetched at once
  archiveUp = false; await pick('Higashiyamato');
  console.log('moved to Higashiyamato — tries:', calls, '|', await T(), '| climate kept for', await pg.evaluate(() => S.climate && S.climate.name));
  console.log('  home:', JSON.stringify(await home()));
  console.log('errs', errs); await b.close();
})();
