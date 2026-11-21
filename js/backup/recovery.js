// The recovery screen: what to do when the saved garden can't be loaded (or anything looks wrong). Nothing here deletes
// anything without keeping a copy, and while the garden can't be loaded nothing is saved over it.

import { DB } from '../core/db.js';
import { DATA_VERSION, dataProblem } from '../core/migrate.js';
import { A, setChrome } from '../core/router.js';
import { blank, setState } from '../core/state.js';
import { confirmBox } from '../core/ui.js';
import { $, esc, niceDate } from '../core/util.js';
import { photosForBackup, readBackupFile, restoreGarden, restoreSnapshot, shareOrDownload, snapshotList } from './backup.js';

// Why the garden couldn't be loaded — set at start-up; while it's set, every page shows this screen.
// { kind: 'storage' | 'data' | 'start', error }
export let failure = null;
export function setFailure(f) { failure = f; }

const WHY = {
  storage: e => `The app couldn’t open its storage on this phone${e ? ` (${esc(e.message || e)})` : ''}. Your garden is probably still there: this can happen while the browser is updating, in a private window, or when the phone is very short of space.`,
  data: e => `Your saved garden couldn’t be loaded: ${esc(e.message || e)}. Nothing has been changed or deleted.`,
  start: e => `The app stopped while starting (${esc(e.message || e)}). Your saved garden hasn’t been changed.`,
};
const card = (title, body) => `<section><h3>${title}</h3>${body}</section>`;

export function pageRecovery() {
  setChrome('Recovery', { back: !failure, kicker: failure ? 'Something went wrong' : 'Tools' });
  const f = failure;
  const html = `${f ? `<p class="banner warn">${WHY[f.kind] ? WHY[f.kind](f.error) : esc(String(f.error))}</p>` : `<p class="hint">For when something looks wrong with your records. Nothing here deletes anything without keeping a copy first.</p>`}
    ${card('Try again', `<p class="small">Often enough after a browser update, or once the phone has some space again.</p><button class="btn primary wide" data-act="rcRetry">Try again</button>`)}
    ${f && f.kind === 'storage' ? '' : card('Keep a copy of what’s stored', `<p class="small">Saves your garden exactly as it’s stored on this phone — even if it can’t be loaded — as a backup file. Do this first; it can be repaired or restored later.</p><button class="btn wide" data-act="rcKeep">Save a copy</button>`)}
    ${card('Go back to an earlier copy', '<div id="rcCopies"><p class="small muted">Looking for copies on this phone…</p></div>')}
    ${card('Restore from a backup file', `<p class="small">A file you exported, or one saved to Google Drive (download it first).</p><button class="btn wide" data-act="rcFile">Choose backup file…</button><input type="file" id="rcf" accept=".json,application/json,text/plain" hidden>`)}
    ${f && f.kind === 'storage' ? card('Use the app without saving', `<p class="small">Look things up or try things out; nothing you do is saved, and your stored garden isn’t touched.</p><button class="btn wide" data-act="rcNoSave">Continue without saving</button>`) : ''}
    ${f && f.kind !== 'storage' ? card('Start again with an empty garden', `<p class="small">Only if nothing above works. Your stored garden is kept on this phone as a copy first (it shows up under earlier copies).</p><button class="btn danger wide" data-act="rcFresh">Start with an empty garden</button>`) : ''}
    ${f && f.error && f.error.stack ? `<details class="small"><summary>Details for a bug report</summary><pre class="mono">${esc(String(f.error.stack))}</pre></details>` : ''}`;
  const after = async () => {
    A.rcRetry = () => { location.hash = '#/'; location.reload(); };
    A.rcKeep = async () => {
      try {
        const raw = await DB.get('state');
        await shareOrDownload(`garden-stored-copy-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: 'garden-planner', format: 1, exported: new Date().toISOString(), note: 'stored copy saved from the recovery screen', state: raw, photos: await photosForBackup() }));
      } catch (e) { alert('Couldn’t read the stored garden: ' + e.message); }
    };
    A.rcFile = () => $('#rcf').click();
    $('#rcf').addEventListener('change', async e => {
      const data = e.target.files[0] && await readBackupFile(e.target.files[0]); if (!data) return;
      const why = dataProblem(data.state); if (why) return alert(`This backup can’t be used either: ${why}.`);
      if (!await confirmBox(`Restore the backup from <b>${new Date(data.exported).toLocaleString('en-GB')}</b>?`, 'Restore', true)) return;
      try { await restoreGarden(data.state, { label: 'a backup file', photos: data.photos }); } catch (er) { return alert('Restore didn’t work: ' + er.message); }
      done('Backup restored.');
    });
    A.rcNoSave = () => { setState(blank()); failure = null; location.hash = '#/'; window.dispatchEvent(new HashChangeEvent('hashchange')); };
    A.rcFresh = async () => {
      if (!await confirmBox('Start again with an empty garden?<br>Your stored garden is kept on this phone as a copy first.', 'Start empty', true)) return;
      try { await restoreGarden(blank(), { label: 'an empty garden' }); } catch (e) { return alert('Couldn’t keep a copy first, so nothing was changed: ' + e.message); }
      done('Started with an empty garden. Your old one is kept under earlier copies.');
    };
    // earlier copies: daily snapshots, the garden before the last restore, before the last format update, kept copies
    const box = $('#rcCopies'); if (!box) return;
    let snaps = [], before = null, others = [];
    try {
      snaps = await snapshotList(); before = await DB.get('state.beforeRestore');
      for (let v = 1; v < DATA_VERSION; v++) { const x = await DB.get('state.v' + v); if (x) others.push({ key: 'state.v' + v, label: `As it was before this version updated it (data format ${v})` }); }
      for (const k of await DB.kvKeys()) if (/^state\.kept\./.test(k)) others.push({ key: k, label: `Kept when starting again on ${new Date(k.slice(11)).toLocaleString('en-GB')}` });
    } catch (e) { box.innerHTML = `<p class="small muted">The phone’s storage can’t be read right now.</p>`; return; }
    const rows = [
      ...snaps.map(s => `<li><span class="grow">${niceDate(s.date)}<small>${s.plantings} planting${s.plantings === 1 ? '' : 's'} · ${s.tasks} job${s.tasks === 1 ? '' : 's'}</small></span><button class="btn small" data-act="rcSnap" data-d="${s.date}">Restore</button></li>`),
      before && before.state ? `<li><span class="grow">Before restoring ${esc(before.label)}<small>${new Date(before.date).toLocaleString('en-GB')}</small></span><button class="btn small" data-act="rcKey" data-k="state.beforeRestore">Restore</button></li>` : '',
      ...others.map(o => `<li><span class="grow">${esc(o.label)}</span><button class="btn small" data-act="rcKey" data-k="${esc(o.key)}">Restore</button></li>`),
    ].filter(Boolean);
    box.innerHTML = rows.length ? `<p class="small">Copies kept on this phone:</p><ul class="plist">${rows.join('')}</ul>` : '<p class="small muted">No earlier copies on this phone.</p>';
    A.rcSnap = async el => { if (await restoreSnapshot(el.dataset.d)) done('Restored.'); };
    A.rcKey = async el => {
      let raw = await DB.get(el.dataset.k); if (raw && raw.state && el.dataset.k === 'state.beforeRestore') raw = raw.state;
      if (!raw) return alert('That copy is no longer available.');
      if (!await confirmBox('Go back to that copy? What’s there now is kept, so you can undo it.', 'Restore', true)) return;
      try { await restoreGarden(raw, { label: 'an earlier copy' }); } catch (e) { return alert('That copy can’t be used: ' + e.message + '. Nothing was changed.'); }
      done('Restored.');
    };
  };
  return { html, after };
}
// after a restore from here: start the app afresh with the restored garden
function done(msg) { alert(msg); location.hash = '#/'; location.reload(); }

// draw this screen directly (while the garden isn't loaded, the normal pages can't be drawn)
export function showRecovery(info) {
  if (info) failure = info;
  const { html, after } = pageRecovery();
  for (const k of Object.keys(A)) delete A[k];
  $('#view').innerHTML = html; after();
}
