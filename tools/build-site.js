#!/usr/bin/env node
// Puts the site together for GitHub Pages: the real app (from the main branch) at the top, and the test site (from the
// test branch) under test/, named and coloured so it's never mistaken for the real one.
//   node tools/build-site.js <main checkout> <test checkout, or -> <output folder>
'use strict';
const fs = require('fs'), path = require('path');
const FILES = require('./app-files');
const [mainDir, testDir, out] = process.argv.slice(2);
if (!mainDir || !testDir || !out) { console.error('usage: build-site.js <main dir> <test dir or -> <out dir>'); process.exit(2); }
const copy = (from, to) => { for (const f of FILES) { const src = path.join(from, f); if (fs.existsSync(src)) fs.cpSync(src, path.join(to, f), { recursive: true }); } };
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
copy(mainDir, out);
if (testDir !== '-') {
  const t = path.join(out, 'test'); copy(testDir, t);
  const mf = path.join(t, 'manifest.webmanifest'), m = JSON.parse(fs.readFileSync(mf, 'utf8'));
  // its own app, not part of the real one: its own identity (the real app's scope is just its index.html, so the test
  // folder is outside it — Chrome offers to install the test site separately)
  Object.assign(m, { id: (m.id || '/garden-planner/').replace(/\/?$/, '/') + 'test/', name: 'Garden Planner (test)', short_name: 'Garden test', theme_color: '#4b3866' });
  fs.writeFileSync(mf, JSON.stringify(m, null, 2) + '\n');
  const ix = path.join(t, 'index.html');
  fs.writeFileSync(ix, fs.readFileSync(ix, 'utf8').replace('<title>Garden Planner</title>', '<title>Garden Planner (test)</title>').replace(/(<meta name="theme-color" content=")[^"]*/, '$1#4b3866'));
}
const v = dir => (fs.readFileSync(path.join(dir, 'js', 'version.js'), 'utf8').match(/APP_VERSION = '([^']+)'/) || [])[1];
console.log(`site: main ${v(out)}${testDir !== '-' ? `, test ${v(path.join(out, 'test'))}` : ' (no test branch)'} → ${out}`);
