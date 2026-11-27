// The service worker keeps a list of files to save for offline use (ASSETS in sw.js). Every file the app loads must be
// on it, and every file on it must exist — one missing file and the phone can't install the app for offline use.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const U = 'http://localhost:8765/';
(async () => {
  const sw = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');
  const list = sw.slice(sw.indexOf('const ASSETS'), sw.indexOf('];', sw.indexOf('const ASSETS'))).replace(/\/\/.*$/gm, '');
  const assets = [...list.matchAll(/'([^']+)'/g)].map(m => m[1]);
  const b = await chromium.launch(); const ctx = await newContext(b); const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  const loaded = new Set();
  pg.on('request', r => { const u = new URL(r.url()); if (u.host === 'localhost:8765' && u.pathname !== '/__test_bridge.js') loaded.add(u.pathname === '/' ? './' : u.pathname.slice(1)); });
  await pg.goto(U); await pg.waitForTimeout(800);
  for (const h of ['#/settings', '#/cal', '#/log', '#/sow', '#/products']) { await pg.goto(U + h); await pg.waitForTimeout(150); }
  const notListed = [...loaded].filter(f => !assets.includes(f) && f !== 'sw.js').sort();
  console.log('every file the app loads is on the offline list:', notListed.length === 0, notListed);
  const missing = [];
  for (const f of assets) { const r = await pg.request.get(U + (f === './' ? '' : f)); if (r.status() !== 200) missing.push(f); }
  console.log('every file on the offline list exists:', missing.length === 0, missing);
  console.log('errs', errs); await b.close();
})();
