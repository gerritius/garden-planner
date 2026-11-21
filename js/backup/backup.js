// Backups on this phone: a daily snapshot, export to a file and restore from one.

import { DB } from '../core/db.js';
import { blobToDataURL, photoURLs } from '../core/photos.js';
import { A, render } from '../core/router.js';
import { blank, S, save, setState } from '../core/state.js';
import { applyTheme } from '../core/theme.js';
import { confirmBox } from '../core/ui.js';
import { $, go, niceDate, todayStr } from '../core/util.js';

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
export async function snapshotSection() {
  const el = $('#snaps'); if (!el) return;
  const list = ((await DB.get('snaps')) || []).slice().reverse();
  el.innerHTML = list.length ? `<p class="small">The app also keeps a copy of your records from each of the last ${SNAP_KEEP} days you used it, on this phone — handy if something gets deleted by mistake. (They don’t help if the phone is lost — that’s what the exported backup is for.)</p>
    <ul class="plist">${list.map(s => `<li><span class="grow">${niceDate(s.date)}<small>${s.plantings} plantings · ${s.tasks} job${s.tasks === 1 ? "" : "s"}</small></span><button class="btn small" data-act="restoreSnap" data-d="${s.date}">Restore</button></li>`).join('')}</ul>` : '';
  A.restoreSnap = async b => {
    const snap = await DB.get('snap:' + b.dataset.d); if (!snap) return alert('That copy is no longer available.');
    if (!await confirmBox(`Go back to your records as they were on <b>${niceDate(b.dataset.d)}</b>?<br>Anything added since is lost (photos are kept).`, 'Restore', true)) return;
    const keep = { lastBackup: S.lastBackup };
    setState(Object.assign(blank(), snap, keep)); await save(); alert('Restored.'); go('#/');
  };
}

// ---------- export to a file, restore from one ----------
export async function exportBackup() {
  const photos = {};
  for (const k of await DB.photoKeys()) { const b = await DB.getPhoto(k); if (b) photos[k] = await blobToDataURL(b); }
  const name = `garden-backup-${todayStr()}.json`;
  const data = JSON.stringify({ app: 'garden-planner', format: 1, exported: new Date().toISOString(), state: S, photos });
  const markDone = async () => { S.lastBackup = todayStr(); await save(); render(); };
  const file = new File([data], name, { type: 'application/json' });
  const txt = new File([data], name.replace('.json', '.txt'), { type: 'text/plain' });
  for (const f of [file, txt]) {
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], title: name }); return markDone(); }
      catch (e) { if (e.name === 'AbortError') return; }
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  markDone();
}
export async function importBackup(file) {
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { return alert('That file is not a Garden Planner backup.'); }
  if (!data || data.app !== 'garden-planner' || !data.state) return alert('That file is not a Garden Planner backup.');
  if (!await confirmBox(`Restore the backup from <b>${new Date(data.exported).toLocaleString('en-GB')}</b>?<br>This replaces everything currently in the app.`, 'Restore', true)) return;
  await DB.clearPhotos();
  for (const k of Object.keys(photoURLs)) delete photoURLs[k];
  for (const [k, u] of Object.entries(data.photos || {})) { const b = await (await fetch(u)).blob(); await DB.putPhoto(k, b); }
  setState(Object.assign(blank(), data.state));
  applyTheme();
  await save(); alert('Backup restored.'); go('#/');
}
