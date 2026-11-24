// South of the equator: growing seasons cross the new year, so the rotation plan names them "2026–27"; pest seasons
// (written for Japan) are six months on; and the Japanese solar terms aren't shown.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  const setPlace = (w, t) => pg.evaluate(async ({ w, t }) => { S.weather = w; S.climate = t ? { lat: w.lat, lon: w.lon, name: w.name, t, rain: Array(12).fill(80), years: 'test', fetched: '2026-11-01' } : null; applyClimate(true); await save(); }, { w, t });
  await pg.evaluate(async () => {
    S.plantings = []; S.tasks = [];
    S.containers = [{ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, covers: [],
      history: [{ id: 'h1', cropId: 'tomato', from: 0, to: 200, sowDate: '2025-10-01', harvestedOn: '2026-03-20' }, { id: 'h2', cropId: 'cabbage', from: 0, to: 200, sowDate: '2026-04-01', harvestedOn: '2026-08-10' }] }];
    await save();
  });
  const rot = async () => { await pg.goto(U + '#/rotation'); await pg.waitForTimeout(300);
    return `${await pg.textContent('#kicker')} | ${(await pg.textContent('.rotbed')).replace(/\s+/g, ' ').trim()}`; };
  const month = () => pg.evaluate(() => [1, 5, 11].map(m => `${m}→${seasonMonth(m)}`).join(' '));
  const sub = async () => { await pg.goto(U + '#/'); await pg.waitForTimeout(300); return (await pg.textContent('#sub').catch(() => '')).trim() || '(none)'; };
  // in Tokyo: calendar years
  await setPlace({ lat: 35.75, lon: 139.42, name: 'Higashiyamato' }, null);
  console.log('Tokyo — rotation:', await rot());
  console.log('  pest-season month:', await month(), '| solar term:', await sub());
  // in Sydney: seasons July–June
  await setPlace({ lat: -33.87, lon: 151.21, name: 'Sydney' }, [22.8, 22.8, 21.6, 19.0, 16.1, 13.6, 12.8, 13.9, 16.2, 18.4, 20.0, 21.7]);
  console.log('Sydney — rotation:', await rot());
  console.log('  pest-season month:', await month(), '| solar term:', await sub());
  // aphids are a spring/autumn pest: in Sydney's November (late spring) they count as in season, as in a Japanese May
  console.log('  November is like:', await pg.evaluate(() => seasonMonth(new Date().getMonth() + 1)), '(aphid months in Japan: 3–6, 9–11)');
  console.log('errs', errs); await b.close();
})();
