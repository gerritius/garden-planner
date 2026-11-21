// New versions: a notice when a newer version of the app is out (with what changed), and, after an update, what's new
// — once. Versions and notes come from releases.json, which every release adds to (newest first).

import { APP_VERSION } from '../version.js';
import { lsKey } from './site.js';
import { S } from './state.js';
import { modal } from './ui.js';
import { $, esc, niceDate } from './util.js';

const parts = v => String(v).split('.').map(n => +n || 0);
export const newer = (a, b) => { const x = parts(a), y = parts(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
let releases = null;
async function loadReleases(fresh) {
  try { const r = await fetch('releases.json', { cache: fresh ? 'no-store' : 'default' }); if (r.ok) releases = await r.json(); } catch (e) { /* offline */ }
  return Array.isArray(releases) ? releases : [];
}

export function releaseNotesDialog(list, title = 'What’s new') {
  modal(`<h3>${esc(title)}</h3><div class="relnotes">${list.map(r => `<h4>${esc(r.version)} <small>${r.date ? niceDate(r.date) : ''}</small></h4><ul>${(r.notes || []).map(n => `<li>${esc(n)}</li>`).join('')}</ul>`).join('') || '<p class="muted">No notes.</p>'}</div>
    <div class="btns"><button class="btn primary" data-x="no">OK</button></div>`, (m, close) => { m.querySelector('[data-x=no]').onclick = close; });
}
export async function allReleaseNotes() { releaseNotesDialog(await loadReleases(false), 'What’s new'); }

// the strip under the header
function notice(html, actions) {
  const el = $('#notice'); if (!el) return;
  el.innerHTML = html + '<button type="button" class="nx" data-n="close" aria-label="Close">✕</button>'; el.hidden = false;
  el.onclick = e => { const b = e.target.closest('[data-n]'); if (!b) return; if (b.dataset.n === 'close') el.hidden = true; else actions[b.dataset.n](); };
}

// Is a newer version out? Checked at start, when the app comes back to the front, and every few hours while it's open.
let lastCheck = 0;
export async function checkForUpdate() {
  if (Date.now() - lastCheck < 30 * 60000) return; lastCheck = Date.now();
  const list = await loadReleases(true), latest = list[0];
  if (!latest || !newer(latest.version, APP_VERSION)) return;
  const news = list.filter(r => newer(r.version, APP_VERSION));
  notice(`<span class="grow"><b>Version ${esc(latest.version)} is ready.</b></span><button type="button" class="btn small" data-n="notes">What’s new</button><button type="button" class="btn small primary" data-n="reload">Update now</button>`,
    { notes: () => releaseNotesDialog(news, `New in ${latest.version}`), reload: () => location.reload() });
}

// After an update: what's new, once. A new install has nothing to tell (but a garden from before these notes existed
// hears about this version).
export async function whatsNewOnce() {
  const k = lsKey('seenVersion'); let seen = null;
  try { seen = localStorage.getItem(k); localStorage.setItem(k, APP_VERSION); } catch (e) { return; }
  if (seen === APP_VERSION) return;
  if (!seen && !(S && S.plantings && S.plantings.length)) return;
  if (seen && !newer(APP_VERSION, seen)) return;   // went back to an older version
  const list = (await loadReleases(false)).filter(r => (!seen || newer(r.version, seen)) && !newer(r.version, APP_VERSION)).slice(0, seen ? 99 : 1);
  if (!list.length) return;
  notice(`<span class="grow">Updated to <b>${esc(APP_VERSION)}</b>.</span><button type="button" class="btn small primary" data-n="notes">What’s new</button>`,
    { notes: () => { $('#notice').hidden = true; releaseNotesDialog(list, `New in ${APP_VERSION}`); } });
}
