// Starts the app: loads the saved garden, wires up the page-wide listeners and draws the first page.

import { DB } from './core/db.js';
import { A, render } from './core/router.js';
import { blank, S, setState } from './core/state.js';
import { applyTheme } from './core/theme.js';
import { $, go, todayStr } from './core/util.js';
import { taskDialog, toggleTask } from './garden/tasks.js';

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
(async () => {
  try { setState(Object.assign(blank(), await DB.get('state') || {})); }
  catch (e) { setState(blank()); alert('Storage is unavailable in this browser mode — changes will not be saved.'); }
  applyTheme();
  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
