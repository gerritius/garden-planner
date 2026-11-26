// Shared set-up for the scenarios: a phone-sized browser at a fixed date and time, with no outside network.
const fs = require('fs'), path = require('path');
const { devices } = require('playwright');
const FIXED_NOW = new Date('2026-11-18T10:00:00+09:00');
const ROOT = path.resolve(__dirname, '..');

// The app is made of ES modules, so its functions aren't globals. Scenarios still call them by name inside
// page.evaluate (e.g. `crop('tomato')`, `S.plantings`), so a small generated script imports every module and
// makes each export readable on window. Values stay live (S after a restore is the new S). Assigning to one only
// works where the module has a setter (S → setState).
function moduleFiles(dir = path.join(ROOT, 'js'), out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) moduleFiles(p, out); else if (f.name.endsWith('.js')) out.push(path.relative(ROOT, p).split(path.sep).join('/'));
  }
  return out.sort();
}
function bridgeSource() {
  // imported relative to the page, so they're the very modules the page runs (also on the test site, under /test/)
  // (a module an older version of the app doesn't have is skipped)
  return `const mods = await Promise.all(${JSON.stringify(moduleFiles())}.map(f => import(new URL(f, document.baseURI).href).catch(() => ({}))));
const setters = {}; for (const m of mods) for (const k of Object.keys(m)) if (/^set[A-Z]/.test(k)) setters[k] = m[k];
for (const m of mods) for (const k of Object.keys(m)) {
  const set = k === 'S' ? setters.setState : setters['set' + k.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())];
  Object.defineProperty(window, k, { configurable: true, get: () => m[k], set: v => { if (!set) throw new Error(k + ' is read-only from outside its module'); set(v); } });
}
window.__bridged = true;
`;
}

async function newContext(browser, extra = {}) {
  const { openFolds, bridge: useBridge = true, welcome = false, realAddress = false, products = false, ...opts } = extra;   // bridge: false for an old version of the app (plain scripts, no modules)
  const ctx = await browser.newContext(Object.assign({}, devices['Pixel 7'], { timezoneId: 'Asia/Tokyo' }, opts));
  await ctx.clock.setFixedTime(FIXED_NOW);
  await ctx.route(u => !['localhost', '127.0.0.1'].includes(u.hostname), r => r.abort());
  await ctx.route(u => /\/climate\/\d+_\d+\.bin$/.test(u.pathname), r => r.abort());   // no climate tiles unless a scenario serves its own (climateTile)
  if (!welcome) await ctx.addInitScript(() => { window.__noWelcome = true; });   // a new garden's welcome steps: only where a scenario asks for them
  if (!realAddress) await ctx.addInitScript(() => { window.__keepAddress = true; });   // the app moves …/ to …/index.html; scenarios keep the address they open
  if (openFolds) await ctx.addInitScript(() => setInterval(() => document.querySelectorAll('#pf details:not([open])').forEach(d => { d.open = true; }), 30));
  if (!useBridge) return ctx;
  const bridge = bridgeSource();
  await ctx.route(u => u.pathname === '/__test_bridge.js', r => r.fulfill({ contentType: 'text/javascript', body: bridge }));
  await ctx.addInitScript(() => { if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port === '8765') import('/__test_bridge.js'); });
  // after loading a page of the app, wait until the bridge is in place
  const ready = p => p.waitForFunction(() => window.__bridged === true, null, { timeout: 10000 }).catch(() => {});
  // products: true — the garden starts with the products and potting mixes older versions of the app came with (as a
  // garden from then has them), once per scenario: new gardens start with none
  let seeded = !products;
  const seed = async p => { if (seeded) return; seeded = true;
    await p.evaluate(async () => { if ((S.products || []).length) return; delete S.prodLib; S.products = []; migrateProducts(); migrateOwnRules();
      for (const m of OLD_MIXES) if (!S.products.some(p => p.id === m.id)) S.products.push(Object.assign(normProd(Object.assign({ kind: 'mix', maker: '' }, m)), { tpl: m.id }));
      await save(); }).catch(e => { seeded = false; throw e; }); };
  const wrap = p => {
    if (p._bridgeWrapped) return p; p._bridgeWrapped = true;
    for (const fn of ['goto', 'reload']) { const orig = p[fn].bind(p); p[fn] = async (...a) => { const r = await orig(...a); if (/:8765\//.test(p.url())) { await ready(p); await seed(p); } return r; }; }
    return p;
  };
  const newPage = ctx.newPage.bind(ctx);
  ctx.newPage = async () => wrap(await newPage());
  ctx.on('page', wrap);
  return ctx;
}
// A climate tile as tools/era5/build.py makes them, every point the same, from made-up daily records (the shape the app
// once fetched from a weather service): { time, temperature_2m_mean, temperature_2m_min?, precipitation_sum? }.
// Frost dates are worked out as the build does, for lows of −2…+4 °C. elev: the grid points' height (m).
function climateTile(daily, { south = false, elev = 0, land = 100 } = {}) {
  const tS = Array(12).fill(0), tN = Array(12).fill(0), rain = {};
  daily.time.forEach((ds, i) => { const m = +ds.slice(5, 7) - 1, t = daily.temperature_2m_mean[i], p = (daily.precipitation_sum || [])[i];
    if (t != null) { tS[m] += t; tN[m]++; } if (p != null) { const k = ds.slice(0, 7); rain[k] = (rain[k] || 0) + p; } });
  const rS = Array(12).fill(0), rN = Array(12).fill(0);
  Object.entries(rain).forEach(([k, v]) => { const m = +k.slice(5, 7) - 1; rS[m] += v; rN[m]++; });
  const day = ds => Date.UTC(+ds.slice(0, 4), +ds.slice(5, 7) - 1, +ds.slice(8, 10)) / 864e5;
  const startOf = ds => { const y = +ds.slice(0, 4), m = +ds.slice(5, 7); return south ? `${y}-01-01` : m >= 7 ? `${y}-07-01` : `${y - 1}-07-01`; };
  const wins = {}; daily.time.forEach(ds => { const k = startOf(ds); wins[k] = (wins[k] || 0) + 1; });
  const full = Object.keys(wins).filter(k => wins[k] >= 330), tmin = daily.temperature_2m_min || [];
  const frost = [-2, -1, 0, 1, 2, 3, 4].flatMap(th => {
    const hit = full.map(k => { const o = daily.time.map((ds, i) => startOf(ds) === k && tmin[i] != null && tmin[i] <= th ? day(ds) - day(k) : null).filter(x => x != null); return o.length ? [o[0], o[o.length - 1]] : null; }).filter(Boolean);
    const med = a => { const x = a.slice().sort((p, q) => p - q); return x[Math.floor(x.length / 2)]; };
    return hit.length ? [hit.length, med(hit.map(h => h[0])), med(hit.map(h => h[1]))] : [0, -1, -1]; });
  const pt = [...tS.map((s, i) => Math.round(s / tN[i] * 10)), ...rS.map((s, i) => Math.round(s / rN[i])), elev, land, full.length, ...frost];
  const buf = Buffer.alloc(21 * 21 * pt.length * 2);
  for (let k = 0; k < 21 * 21; k++) pt.forEach((v, j) => buf.writeInt16LE(v, (k * pt.length + j) * 2));
  return require('zlib').gzipSync(buf);
}
// serve that tile for whatever place the app asks about (until up() says no: then the request fails, as offline)
const serveClimate = (ctx, tile, up = () => true) => ctx.route(u => /\/climate\/\d+_\d+\.bin$/.test(u.pathname), r => up() ? r.fulfill({ contentType: 'application/octet-stream', body: typeof tile === 'function' ? tile(r.request().url()) : tile }) : r.abort());
module.exports = { newContext, FIXED_NOW, climateTile, serveClimate };
