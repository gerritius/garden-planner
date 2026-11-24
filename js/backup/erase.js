// Tools → Delete all my data: wipes this site's garden from this phone — beds, plantings, records, photos, settings,
// and the daily copies kept for recovery — and starts again from the welcome screen. Two steps: first a reminder to
// back up (with the button to do it), then typing DELETE. Backups already saved (files, Google Drive) aren't touched.

import { A } from '../core/router.js';
import { DB } from '../core/db.js';
import { IS_TEST, lsKey } from '../core/site.js';
import { S, stopSaving } from '../core/state.js';
import { modal } from '../core/ui.js';
import { $, niceDate } from '../core/util.js';
import { exportBackup } from './backup.js';

export function eraseSection() {
  A.eraseAll = () => eraseStep1();
  return `<details class="set erase"><summary>⚠️ Delete all my data</summary><section><h3>Delete all my data</h3>
    <p>Removes your ${IS_TEST ? 'test-site ' : ''}garden from this phone: beds and pots, plantings, records, photos, products, settings and the daily copies kept for recovery. The app starts again as new.${IS_TEST ? ' Your real garden (the main site) isn’t touched.' : ''}</p>
    <button type="button" class="btn danger wide" data-act="eraseAll">Delete all my data…</button></section></details>`;
}
function eraseStep1() {
  const last = S.lastBackup;
  modal(`<h3>Back up first?</h3>
    <p class="msg">Deleting can’t be undone. ${last ? `Your last backup was <b>${niceDate(last)}</b> — anything since then would be lost.` : '<b>You’ve never made a backup</b> — without one, your garden is gone for good.'}</p>
    <p class="small muted">A backup file can be restored later (Tools → Backup → Restore).</p>
    <div class="btncol"><button class="btn primary wide" data-x="backup">💾 Export a backup now</button>
      <button class="btn wide" data-x="next">${last ? 'I have a backup — continue' : 'Continue without a backup'}</button>
      <button class="btn wide" data-x="no">Cancel</button></div>`, (m, close) => {
    m.querySelector('[data-x=backup]').onclick = async () => { await exportBackup(); const b = m.querySelector('[data-x=next]'); if (b) b.textContent = 'Backed up — continue'; };
    m.querySelector('[data-x=next]').onclick = () => eraseStep2(m, close);   // (the same pop-up, next step)
    m.querySelector('[data-x=no]').onclick = () => close();
  });
}
function eraseStep2(m, close) {
  m.querySelector('.sheet').innerHTML = `<h3>Delete everything?</h3>
    <p class="msg">This deletes your whole ${IS_TEST ? 'test-site ' : ''}garden from this phone, including photos. Backup files you’ve saved${IS_TEST ? '' : ' and backups in Google Drive'} are kept.</p>
    <label>Type <b>DELETE</b> to confirm<input id="eraseWord" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="DELETE"></label>
    <div class="btns"><button class="btn" data-x="no">Cancel</button><button class="btn danger" data-x="ok" disabled>Delete everything</button></div>`;
  const inp = m.querySelector('#eraseWord'), ok = m.querySelector('[data-x=ok]');
  inp.oninput = () => { ok.disabled = inp.value.trim().toLowerCase() !== 'delete'; };
  m.querySelector('[data-x=no]').onclick = () => close();
  ok.onclick = async () => { if (inp.value.trim().toLowerCase() !== 'delete') return; ok.disabled = true; ok.textContent = 'Deleting…'; await eraseEverything(); };
  setTimeout(() => inp.focus(), 50);
}
async function eraseEverything() {
  stopSaving();   // nothing still running may write the garden back
  try { await DB.clearAll(); } catch (e) { alert('Couldn’t delete everything: ' + e.message); return location.reload(); }
  try { const pre = lsKey(''); for (const k of Object.keys(localStorage)) if (k.startsWith(pre)) localStorage.removeItem(k); } catch (e) { /* no local storage */ }
  try { const reg = await navigator.serviceWorker.ready; if (reg.periodicSync) await reg.periodicSync.unregister('morning'); } catch (e) { /* no morning reminder */ }
  const el = $('#view'); if (el) el.innerHTML = '<div class="empty-state">All deleted. Starting again…</div>';
  location.replace(location.pathname + '#/'); location.reload();
}
