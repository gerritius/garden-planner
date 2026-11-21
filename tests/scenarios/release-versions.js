// A release has one version number in three places — js/version.js (the app), sw.js (its offline copy) and
// releases.json (the notes the app shows) — and they must agree, or phones won't pick up the update or its notes.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = (read('js/version.js').match(/APP_VERSION = '([^']+)'/) || [])[1];
const sw = (read('sw.js').match(/const VERSION = '([^']+)'/) || [])[1];
const rel = JSON.parse(read('releases.json'));
const parts = v => v.split('.').map(Number), newer = (a, b) => { const x = parts(a), y = parts(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
console.log('js/version.js, sw.js and releases.json have the same version:', !!app && app === sw && app === rel[0].version, app === sw && app === rel[0].version ? '' : `(${app} / ${sw} / ${rel[0].version})`);
console.log('versions look like 1.2.3:', rel.every(r => /^\d+\.\d+\.\d+$/.test(r.version)));
console.log('releases.json is newest first, each version once:', rel.every((r, i) => i === 0 || newer(rel[i - 1].version, r.version)));
console.log('every release has a date and notes:', rel.every(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Array.isArray(r.notes) && r.notes.length && r.notes.every(n => typeof n === 'string' && n.trim())));
console.log('errs []');
