// Backups on this phone: a daily snapshot, export to a file, restore from one — and the one safe way every restore
// (file, snapshot, Google Drive, recovery screen) replaces the garden.

import { DB } from '../core/db.js';
import { upgrade } from '../core/migrate.js';
import { blobToDataURL, photoURLs } from '../core/photos.js';
import { A, render } from '../core/router.js';
import { MAIN_DB_NAME } from '../core/site.js';
import { allowSaving, S, save, setState } from '../core/state.js';
import { applyTheme } from '../core/theme.js';
import { confirmBox } from '../core/ui.js';
import { $, esc, go, niceDate, todayStr } from '../core/util.js';

// ---------- restoring ----------
// Replace the garden with restored data. The data is checked and brought up to this version's format first (a
// DataError, saying why, if it can't be used — then nothing changes). What you had is kept, so the restore can be
// undone (Tools → Backup), until the next restore. Photos from the backup are added; none are deleted.
export async function restoreGarden(raw, { label = 'a backup', photos = null, keep = {} } = {}) {
  const { state } = upgrade(raw);
  if (S) { try { await DB.set('state.beforeRestore', { date: new Date().toISOString(), label, state: S }); } catch (e) { console.warn('could not keep the garden before restoring', e); } }
  else {   // from the recovery screen: the stored garden couldn't be loaded — keep it as it is, or change nothing
    const raw = await DB.get('state'); if (raw != null) await DB.set('state.kept.' + new Date().toISOString(), raw);
  }
  for (const [k, u] of Object.entries(photos || {})) { await DB.putPhoto(k, typeof u === 'string' ? await (await fetch(u)).blob() : u); delete photoURLs[k]; }   // data URLs (file backups) or blobs (Drive)
  setState(Object.assign(state, keep)); allowSaving(); await save(); applyTheme();
}
export async function undoRestore() {
  const before = await DB.get('state.beforeRestore'); if (!before || !before.state) return alert('There’s no restore to undo.');
  if (!await confirmBox(`Go back to your garden as it was before restoring ${esc(before.label)} on <b>${new Date(before.date).toLocaleString('en-GB')}</b>?`, 'Undo restore', true)) return;
  try { await restoreGarden(before.state, { label: 'the undo' }); } catch (e) { return alert('That didn’t work: ' + e.message + '. Nothing was changed.'); }
  alert('Restore undone.'); go('#/');
}

// ---------- daily snapshots on this phone ----------
const SNAP_KEEP = 7;
export async function snapshotDaily() {
  try {
    const td = todayStr(), list = (await DB.get('snaps')) || [];
    if (list.some(s => s.date === td) || !S.plantings.length) return;
    await DB.set('snap:' + td, JSON.parse(JSON.stringify(S)));
    list.push({ date: td, plantings: S.plantings.length, tasks: S.tasks.length });
    while (list.length > SNAP_KEEP) { const old = list.shift(); await DB.set('snap:' + old.date, null); }
    await DB.set('snaps', list);
  } catch (e) { console.warn('snapshot', e); }
}
export const snapshotList = async () => ((await DB.get('snaps')) || []).slice().reverse();
export async function restoreSnapshot(date, keep = {}) {
  const snap = await DB.get('snap:' + date); if (!snap) return alert('That copy is no longer available.');
  if (!await confirmBox(`Go back to your records as they were on <b>${niceDate(date)}</b>?<br>Anything added since is lost (photos are kept). You can undo this.`, 'Restore', true)) return false;
  try { await restoreGarden(snap, { label: `the copy from ${niceDate(date)}`, keep }); } catch (e) { alert('That copy can’t be used: ' + e.message + '. Nothing was changed.'); return false; }
  return true;
}
export async function snapshotSection() {
  const el = $('#snaps'); if (!el) return;
  const list = await snapshotList(), before = await DB.get('state.beforeRestore');
  el.innerHTML = (list.length ? `<p class="small">The app also keeps a copy of your records from each of the last ${SNAP_KEEP} days you used it, on this phone — handy if something gets deleted by mistake. (They don’t help if the phone is lost — that’s what the file and Drive backups are for.)</p>
    <ul class="plist">${list.map(s => `<li><span class="grow">${niceDate(s.date)}<small>${s.plantings} planting${s.plantings === 1 ? '' : 's'} · ${s.tasks} job${s.tasks === 1 ? '' : 's'}</small></span><button class="btn small" data-act="restoreSnap" data-d="${s.date}">Restore</button></li>`).join('')}</ul>` : '')
    + (before && before.state ? `<p class="small">Restored ${esc(before.label)} by mistake? <button class="btn small" data-act="undoRestore">Undo that restore</button></p>` : '')
    + `<p class="small"><a href="#/recovery">Recovery and older copies…</a></p>`;
  A.restoreSnap = async b => { if (await restoreSnapshot(b.dataset.d, { lastBackup: S.lastBackup })) { alert('Restored.'); go('#/'); } };
  A.undoRestore = undoRestore;
}

// ---------- export to a file, restore from one ----------
// a file for the person to keep: the share sheet where there is one (it can go straight to Drive), else a download
export async function shareOrDownload(name, data) {
  const file = new File([data], name, { type: 'application/json' });
  const txt = new File([data], name.replace('.json', '.txt'), { type: 'text/plain' });
  for (const f of [file, txt]) {
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], title: name }); return true; }
      catch (e) { if (e.name === 'AbortError') return false; }
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  return true;
}
export async function photosForBackup() {
  const photos = {};
  for (const k of await DB.photoKeys()) { const b = await DB.getPhoto(k); if (b) photos[k] = await blobToDataURL(b); }
  return photos;
}
export async function exportBackup() {
  const data = JSON.stringify({ app: 'garden-planner', format: 1, exported: new Date().toISOString(), state: S, photos: await photosForBackup() });
  if (await shareOrDownload(`garden-backup-${todayStr()}.json`, data)) { S.lastBackup = todayStr(); await save(); render(); }
}
// a backup file → its data, or null (after saying what's wrong)
export async function readBackupFile(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { alert('That file is not a Garden Planner backup.'); return null; }
  if (!data || data.app !== 'garden-planner' || !data.state) { alert('That file is not a Garden Planner backup.'); return null; }
  return data;
}
export async function importBackup(file) {
  if (!file) return;
  const data = await readBackupFile(file); if (!data) return;
  try { upgrade(data.state); } catch (e) { return alert(`This backup can’t be restored: ${e.message}.`); }
  if (!await confirmBox(`Restore the backup from <b>${new Date(data.exported).toLocaleString('en-GB')}</b>?<br>This replaces everything currently in the app. You can undo it from Tools → Backup.`, 'Restore', true)) return;
  try { await restoreGarden(data.state, { label: `the backup from ${new Date(data.exported).toLocaleDateString('en-GB')}`, photos: data.photos }); }
  catch (e) { return alert('Restore didn’t work: ' + e.message + '. Nothing was changed.'); }
  alert('Backup restored.'); go('#/');
}

// ---------- test site: start from a copy of your real garden ----------
// Reads the real site's database without changing it (read-only, and it's never created if it isn't there), then
// restores that into the test site's own database.
export async function readMainGarden() {
  if (indexedDB.databases && !(await indexedDB.databases()).some(d => d.name === MAIN_DB_NAME)) return null;
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open(MAIN_DB_NAME, 1);
    r.onupgradeneeded = () => r.transaction.abort();   // it didn't exist: don't make an empty one
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error('no garden on the real site'));
  }).catch(() => null);
  if (!db) return null;
  try {
    const read = (store, fn) => new Promise((res, rej) => { const t = db.transaction(store, 'readonly'), q = fn(t.objectStore(store)); t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error); });
    const state = await read('kv', s => s.get('state'));
    const keys = await read('photos', s => s.getAllKeys()), blobs = await read('photos', s => s.getAll());
    return state ? { state, photos: Object.fromEntries(keys.map((k, i) => [k, blobs[i]])) } : null;
  } finally { db.close(); }
}
export async function copyFromMainSite() {
  const main = await readMainGarden().catch(e => { alert('Couldn’t read the real site’s garden: ' + e.message); return undefined; });
  if (main === undefined) return;
  if (!main) return alert('There’s no garden on the real site in this browser to copy.');
  if (!await confirmBox(`Copy your real garden (${main.state.plantings ? main.state.plantings.length : 0} plantings) into the test site?<br>This replaces the test site’s garden. Your real garden isn’t changed.`, 'Copy', true)) return;
  try { await restoreGarden(main.state, { label: 'the copy of your real garden', photos: main.photos, keep: { drive: null } }); }
  catch (e) { return alert('That didn’t work: ' + e.message + '. Nothing was changed.'); }
  alert('Copied. Changes here stay on the test site.'); go('#/');
}
