#!/usr/bin/env node
// Runs every scenario in tests/scenarios against the app, and compares what each one prints with its expected
// output in tests/expected. A scenario fails if it crashes, times out, reports page errors, or its output changed.
//
//   npm test                    run everything
//   npm test -- feeding        run scenarios whose name contains "feeding"
//   npm run test:update         accept the current output as the new expected output (after checking the changes!)
//
// Screenshots the scenarios take go to tests/output (not kept in git).
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..'), DIR = __dirname, PORT = 8765;
const args = process.argv.slice(2), UPDATE = args.includes('--update'), filter = args.filter(a => !a.startsWith('--'));
const JOBS = +(process.env.TEST_JOBS || 3), TIMEOUT = +(process.env.TEST_TIMEOUT || 180) * 1000;
const { FIXED_NOW } = require('./lib');

// a tiny static server for the app
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  if (p.startsWith('/test/')) p = p.slice(5);   // the test site: the same files under /test/, as on GitHub Pages
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => { if (err) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(data); });
});

// things that differ from run to run, masked before comparing
const idPrefix = FIXED_NOW.getTime().toString(36);
const normalise = s => s
  .replace(new RegExp(idPrefix + '[a-z0-9]{1,6}', 'g'), 'ID')
  .replace(/\b\d+(\.\d+)? ms\b/g, 'N ms')
  .replace(/\bv\d+\.\d+\.\d+\b/g, 'vX.Y.Z')
  .replace(new RegExp(ROOT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '<repo>')
  .replace(/\r/g, '').trimEnd() + '\n';

function runOne(file) {
  return new Promise(resolve => {
    const out = path.join(DIR, 'output', path.basename(file, '.js')); fs.mkdirSync(out, { recursive: true });
    const t0 = Date.now(), p = spawn(process.execPath, [file, out], { cwd: path.dirname(file) });
    let text = '', timedOut = false;
    p.stdout.on('data', d => { text += d; }); p.stderr.on('data', d => { text += d; });
    const timer = setTimeout(() => { timedOut = true; p.kill('SIGKILL'); }, TIMEOUT);
    p.on('close', code => { clearTimeout(timer); resolve({ file, code, timedOut, text: normalise(text), secs: Math.round((Date.now() - t0) / 1000) }); });
  });
}
function firstDiff(a, b) {
  const x = a.split('\n'), y = b.split('\n');
  for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) return `line ${i + 1}\n    expected: ${(x[i] ?? '(nothing)').slice(0, 300)}\n    got:      ${(y[i] ?? '(nothing)').slice(0, 300)}`;
  return '';
}

(async () => {
  await new Promise((res, rej) => server.once('error', rej).listen(PORT, '127.0.0.1', res)).catch(e => { console.error(`Can't serve the app on port ${PORT}: ${e.message}`); process.exit(2); });
  const files = fs.readdirSync(path.join(DIR, 'scenarios')).filter(f => f.endsWith('.js') && (!filter.length || filter.some(q => f.includes(q)))).sort().map(f => path.join(DIR, 'scenarios', f));
  if (!files.length) { console.log('No scenarios match.'); process.exit(1); }
  fs.mkdirSync(path.join(DIR, 'expected'), { recursive: true });
  console.log(`Running ${files.length} scenario${files.length > 1 ? 's' : ''} (${JOBS} at a time)…\n`);
  const queue = files.slice(), results = [];
  await Promise.all(Array.from({ length: JOBS }, async () => {
    while (queue.length) {
      const r = await runOne(queue.shift()), name = path.basename(r.file, '.js'), expFile = path.join(DIR, 'expected', name + '.txt');
      const exp = fs.existsSync(expFile) ? fs.readFileSync(expFile, 'utf8') : null;
      const errLine = r.text.match(/^errs \[([\s\S]*?)\]$/m), pageErrs = errLine && errLine[1].trim();
      let status = 'pass', why = '';
      if (r.timedOut) { status = 'FAIL'; why = `timed out after ${TIMEOUT / 1000}s`; }
      else if (r.code !== 0) { status = 'FAIL'; why = 'crashed:\n    ' + r.text.split('\n').filter(l => l.trim()).slice(-8).join('\n    '); }
      else if (pageErrs) { status = 'FAIL'; why = 'errors in the page: ' + pageErrs.slice(0, 300); }
      else if (UPDATE || exp === null) { fs.writeFileSync(expFile, r.text); status = exp === null ? 'new' : (exp === r.text ? 'pass' : 'updated'); }
      else if (exp !== r.text) { status = 'FAIL'; why = 'output changed at ' + firstDiff(exp, r.text); fs.writeFileSync(path.join(DIR, 'output', name + '.actual.txt'), r.text); }
      results.push({ name, status, why, secs: r.secs });
      console.log(`${status === 'FAIL' ? '✗' : '✓'} ${name.padEnd(34)} ${status.padEnd(8)} ${r.secs}s${why ? '\n  ' + why : ''}`);
    }
  }));
  server.close();
  const failed = results.filter(r => r.status === 'FAIL');
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed${results.some(r => r.status === 'new' || r.status === 'updated') ? ' (expected output written for new/updated ones)' : ''}.`);
  if (failed.length) console.log('For a changed output, compare tests/expected/<name>.txt with tests/output/<name>.actual.txt. If the change is right, run: npm run test:update');
  process.exit(failed.length ? 1 : 0);
})();
