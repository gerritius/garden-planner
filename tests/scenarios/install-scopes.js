// The real app and the test site install as two separate apps: the site is put together as GitHub Pages gets it (real
// app at the top, test site under test/), and the test site must be outside the real app's scope, with its own identity —
// while the real app keeps the identity it had (/garden-planner/), so an installed copy updates instead of duplicating.
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..'), out = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-site-'));
execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build-site.js'), ROOT, ROOT, out], { stdio: 'ignore' });
const SITE = 'https://gerritius.github.io/garden-planner/';
const app = (dir, url) => {
  const m = JSON.parse(fs.readFileSync(path.join(out, dir, 'manifest.webmanifest'), 'utf8')), base = new URL('manifest.webmanifest', url);
  const start = new URL(m.start_url, base).href, scope = new URL(m.scope || '.', base).href;
  return { name: m.name, id: new URL(m.id || start, new URL(start).origin).href, start, scope };
};
const real = app('.', SITE), test = app('test', SITE + 'test/');
const inScope = (u, a) => u.startsWith(a.scope);
console.log('real app:', JSON.stringify(real));
console.log('test site:', JSON.stringify(test));
console.log('real app keeps its identity (as before: the folder address):', real.id === SITE);
console.log('test site has its own identity:', test.id !== real.id);
console.log('test site is outside the real app (so Chrome offers to install it):', !inScope(SITE + 'test/', real) && !inScope(SITE + 'test/index.html', real));
console.log('the real app\'s own pages are inside it:', inScope(real.start, real) && inScope(SITE + 'index.html#/seedlings', real));
fs.rmSync(out, { recursive: true, force: true });
