// Chrome's own verdict: the site put together as GitHub Pages gets it (real app at /garden-planner/, test site under
// test/), served locally, opened at the plain folder addresses a person types. Each must be installable by Chrome, as its
// own app, with the page inside its own app's scope (the identities are checked in install-scopes).
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { newContext } = require('../lib');
const ROOT = path.resolve(__dirname, '..', '..'), site = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-pages-')), PORT = 8766;
execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build-site.js'), ROOT, ROOT, site], { stdio: 'ignore' });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (!p.startsWith('/garden-planner/')) { r.writeHead(404); return r.end(); }
  p = p.slice('/garden-planner'.length); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(path.join(site, p), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
});
(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const b = await chromium.launch();
  for (const [name, url] of [['real app', `http://localhost:${PORT}/garden-planner/`], ['test site', `http://localhost:${PORT}/garden-planner/test/`]]) {
    const ctx = await newContext(b, { realAddress: true }); await ctx.route('**/*open-meteo.com/**', r => r.abort());
    const pg = await ctx.newPage(); await pg.goto(url); await pg.waitForTimeout(1500);
    const cdp = await ctx.newCDPSession(pg);
    const errs = (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors.map(e => e.errorId);
    const m = JSON.parse((await cdp.send('Page.getAppManifest')).data || '{}');
    const scope = new URL(m.scope, new URL('manifest.webmanifest', pg.url())).href;
    console.log(`${name}: opened ${url.replace(/:\d+/, '')} → address now ${pg.url().replace(/:\d+/, '')} | installable: ${errs.length ? 'no — ' + errs.join(', ') : 'yes'} | page inside its scope: ${pg.url().split('#')[0].startsWith(scope)}`);
    await ctx.close();
  }
  await b.close(); server.close(); fs.rmSync(site, { recursive: true, force: true });
})();
