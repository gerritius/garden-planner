// Starts the app: loads the saved garden, wires up the page-wide listeners and draws the first page.

import { timeShift } from './core/clock.js';   // first: on the test site, time travel moves the clock before anything reads it
import { showRecovery } from './backup/recovery.js';
import './core/forms.js';   // drop-down lists and "are you sure?" before deleting: they set themselves up when loaded
import { DB } from './core/db.js';
import { DATA_VERSION, newGarden, upgrade } from './core/migrate.js';
import { A, render } from './core/router.js';
import { allowSaving, S, save, setState } from './core/state.js';
import { IS_TEST } from './core/site.js';
import { applyTheme } from './core/theme.js';
import { checkForUpdate, whatsNewOnce } from './core/updates.js';
import { freshenWeather } from './climate/weather.js';
import { $, go, shortDate, todayStr } from './core/util.js';
import { taskDialog, toggleTask } from './garden/tasks.js';

// The app lives at …/index.html — its install scope, so the test site under test/ is an app of its own. Arriving at the
// folder's address (typed in, an old link, back from Google sign-in) switches to it without reloading: a page outside its
// own scope can't be installed. (The tests keep the address they open.)
if (/\/$/.test(location.pathname) && location.protocol.startsWith('http') && !window.__keepAddress) history.replaceState(history.state, '', location.pathname + 'index.html' + location.search + location.hash);

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (el.dataset.act === 'editTask') { const t = S.tasks.find(x => x.id === el.dataset.id); if (t) taskDialog(t); return; }
  if (A[el.dataset.act]) { e.preventDefault(); A[el.dataset.act](el); }
});
document.addEventListener('keydown', e => { const el = e.key === 'Enter' && e.target.closest && e.target.closest('[data-enter]'); if (el && A[el.dataset.enter]) { e.preventDefault(); A[el.dataset.enter](el); } });
document.addEventListener('change', e => { if (e.target.matches('input[data-task]')) toggleTask(e.target.dataset.task, e.target.checked); });
$('#back').addEventListener('click', () => { if (history.length > 1) history.back(); else go('#/'); });
window.addEventListener('hashchange', render);
window.addEventListener('popstate', () => { const m = $('#modal'); if (!m.hidden && m._close) m._close(true); });
// re-render on a new day (tasks roll forward)
let lastDay = todayStr();
document.addEventListener('visibilitychange', () => { if (!document.hidden && todayStr() !== lastDay) { lastDay = todayStr(); render(); } });

// the test site looks different, so it's never mistaken for the real garden
// (and, when it has travelled in time, the badge says to which day)
if (IS_TEST) { document.body.classList.add('site-test'); $('#top .bar').insertAdjacentHTML('beforeend', `<a class="sitebadge" href="#/settings">TEST SITE${timeShift() ? ` · ⏩ ${shortDate(todayStr())}` : ''}</a>`); document.title = 'Garden Planner (test)'; }

// Load the garden. If it can't be read or used, the recovery screen takes over — and nothing is saved, so a garden that
// failed to load is never written over with an empty one. Older formats are brought up to date (a copy of the old one
// is kept first).
(async () => {
  let raw;
  try { raw = await DB.get('state'); }
  catch (e) { return showRecovery({ kind: 'storage', error: e }); }
  try {
    const { state, from } = upgrade(raw == null ? newGarden() : raw);
    setState(state);
    if (raw == null) S.firstRun = true;   // a new garden: the welcome steps (until they're finished or skipped)
    if (raw != null && from < DATA_VERSION) await DB.set('state.v' + from, raw).catch(e => console.warn('could not keep the old format', e));
    allowSaving();
    if (raw != null && from < DATA_VERSION) await save();
  } catch (e) { return showRecovery({ kind: 'data', error: e }); }
  // a new garden opens on the welcome steps (not over a link to somewhere else; the tests skip them)
  if (S.firstRun && !window.__noWelcome && (!location.hash || location.hash === '#/')) location.replace('#/welcome');
  try { applyTheme(); render(); }
  catch (e) { console.error(e); return showRecovery({ kind: 'start', error: e }); }
  // new versions: what changed in this one (once), and a notice when a newer one is out
  whatsNewOnce();
  setTimeout(checkForUpdate, 4000); setInterval(checkForUpdate, 6 * 3600e3);
  // the forecast: fresh at start, when the app comes back to the front, and hourly
  setTimeout(freshenWeather, 1000); setInterval(freshenWeather, 3600e3);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkForUpdate(); freshenWeather(); } });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
