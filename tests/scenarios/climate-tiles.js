// The app's own climate tiles (ERA5, 2016–2025), read as the app reads them: spot checks around the world — both
// hemispheres, the tropics, high towns, coasts and a cold north — to compare by eye with long-term station normals
// (a 28 km grid isn't a weather station: within a degree or so). Each place: one small download. Also: a garden higher
// than the grid is colder and frostier, open sea and Antarctica have no tile (the app keeps its fallback), and a
// location picked from the search gets its climate from the tile with the place's height.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
const PLACES = [   // name, lat, lon, height (m)
  ['Sydney', -33.87, 151.21, 39], ['Higashiyamato', 35.75, 139.42, 90], ['Oslo', 59.91, 10.75, 23], ['Denver', 39.74, -104.99, 1609],
  ['Johannesburg', -26.2, 28.05, 1753], ['Nairobi', -1.29, 36.82, 1795], ['London', 51.51, -0.13, 11], ['Reykjavik', 64.15, -21.94, 30],
  ['Quito', -0.22, -78.51, 2850], ['Singapore', 1.35, 103.82, 15], ['Christchurch', -43.53, 172.64, 10], ['Phoenix', 33.45, -112.07, 340],
  ['Winnipeg', 49.9, -97.14, 239], ['Cape Town', -33.92, 18.42, 25], ['Hobart', -42.88, 147.33, 10], ['Fairbanks', 64.84, -147.72, 136]];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  let tiles = 0, bytes = 0;
  await ctx.route(u => /\/climate\/\d+_\d+\.bin$/.test(u.pathname), async r => { tiles++; const res = await r.fetch(); bytes += (await res.body()).length; r.fulfill({ response: res }); });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  for (const [name, lat, lon, elev] of PLACES) {
    const r = await pg.evaluate(async ([lat, lon, elev]) => { const base = await climateAt(lat, lon), c = forHeight(base, elev), f = c.frost;
      const fd = o => o == null ? '—' : shortDate(addDays(f.south ? '2026-01-01' : '2026-07-01', o));
      return `Jan ${c.t[0].toFixed(1)}° Jul ${c.t[6].toFixed(1)}° · rain ${c.rain.reduce((a, x) => a + x, 0)} mm/yr · grid ${base.elev} m · frost ${f.frosty}/${f.winters} winters ${fd(f.first)}–${fd(f.last)}`; }, [lat, lon, elev]);
    console.log(`${name.padEnd(13)} ${r}`);
  }
  console.log(`${tiles} tiles fetched, ${Math.round(bytes / tiles / 1024)} kB each on average`);
  // the same place higher up: colder, and frost on more nights (Denver's grid point, a garden 300 m above it)
  console.log('Denver +300 m:', await pg.evaluate(async () => { const base = await climateAt(39.74, -104.99), lo = forHeight(base, base.elev), hi = forHeight(base, base.elev + 300);
    return `Jan ${lo.t[0]}° → ${hi.t[0]}°, frost ${lo.frost.first}–${lo.frost.last} → ${hi.frost.first}–${hi.frost.last} (days from 1 July)`; }));
  console.log('open sea / Antarctica:', await pg.evaluate(async () => Promise.all([[-30, -140], [-75, 0]].map(([a, o]) => climateAt(a, o).then(() => 'tile', e => e.message)))));
  // picking a place: its climate comes from the tile, with the height the place search gives
  await pg.evaluate(async () => { S.weather = { lat: -26.2, lon: 28.05, name: 'Johannesburg', elev: 1753 }; delete S.climate; await save(); await ensureClimate(true); });
  console.log('picked:', await pg.evaluate(() => { const c = S.climate; return `${c.name} ${c.years} src ${c.src} · Jan ${c.t[0]}° Jul ${c.t[6]}° · frost ${JSON.stringify(c.frost)} · pending ${climatePending()}`; }));
  console.log('frost text:', await pg.evaluate(() => frostText().replace(/<[^>]+>/g, '')));
  // the forecast then says the garden is 200 m higher than the search did: the climate follows, without a download
  const before = tiles;
  await pg.evaluate(() => climateForHeight(1953));
  console.log('height 1953 m:', await pg.evaluate(() => `Jan ${S.climate.t[0]}° Jul ${S.climate.t[6]}°`), '| downloads', tiles - before);
  console.log('errs', errs); await b.close();
})();
