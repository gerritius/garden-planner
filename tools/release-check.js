#!/usr/bin/env node
// Before the main branch goes live: if this version was already released (tagged), the app's files mustn't have
// changed since — otherwise phones wouldn't be told about the update. Raise the version (js/version.js, VERSION in
// sw.js, and releases.json with notes) for any change to the app itself; tests, tools and docs don't need it.
'use strict';
const { execFileSync } = require('child_process'), fs = require('fs');
const FILES = require('./app-files');
const V = (fs.readFileSync('js/version.js', 'utf8').match(/APP_VERSION = '([^']+)'/) || [])[1];
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
if (!git('tag', '-l', 'v' + V)) { console.log(`v${V} is a new version: it will be tagged and released once it's live.`); process.exit(0); }
const changed = git('diff', '--name-only', 'v' + V, 'HEAD', '--', ...FILES).split('\n').filter(Boolean);
if (!changed.length) { console.log(`No changes to the app since v${V} (only tests, tools or docs): nothing new to release.`); process.exit(0); }
console.error(`The app changed since v${V} was released, but its version wasn't raised:\n  ${changed.join('\n  ')}\n` +
  'Raise it in js/version.js, VERSION in sw.js, and releases.json (with what changed).');
process.exit(1);
