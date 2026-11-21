// Every module in js/ must actually be loaded by the app: reached from js/main.js through its imports. (The test
// bridge loads every module itself, so a module the app forgot to load would still work in the other tests — that's
// how the drop-downs and "are you sure?" before deleting went missing in 1.26.0.) And without the bridge, as on a
// phone, the drop-downs are there.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..'), U = 'http://localhost:8765/';
(async () => {
  const all = []; (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (p.endsWith('.js')) all.push(path.relative(ROOT, p)); } })(path.join(ROOT, 'js'));
  const seen = new Set(), queue = ['js/main.js'];
  while (queue.length) {
    const f = queue.pop(); if (seen.has(f)) continue; seen.add(f);
    for (const m of fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/^\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm)) queue.push(path.normalize(path.join(path.dirname(f), m[1])));
  }
  const missing = all.filter(f => !seen.has(f));
  console.log('every module in js/ is loaded by the app:', missing.length === 0, missing.length ? missing : '');
  const b = await chromium.launch(); const ctx = await newContext(b, { bridge: false }); const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(500);
  await pg.goto(U + '#/container/new'); await pg.waitForTimeout(500);
  await pg.click('[data-act=type][data-v=round]'); await pg.waitForTimeout(400);   // a pot's form has a select (potting mix)
  console.log('the form has a select:', await pg.$$eval('#cf select', x => x.length > 0));
  console.log('without the test bridge, selects become in-page drop-downs:', await pg.$$eval('.dd-field', x => x.length > 0));
  console.log('errs', errs); await b.close();
})();
