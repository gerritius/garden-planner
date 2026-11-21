// Google Drive backup.
// - Daily, when the app opens: your records go to a "Garden Planner backups" folder in your Drive as a small dated file;
//   photos go to a "photos" folder inside it, each uploaded once (so a daily backup only sends new photos).
// - Keeps the last 14 daily backups plus one per month for a year; older ones are removed. Photos are kept.
// - Sign-in: Google gives an app with no server about an hour of access at a time, so when a backup is due the app hops
//   to Google and straight back. If Google wants you to confirm, a banner asks for a tap.
// - Access is limited to files this app creates (drive.file).

import { DB } from '../core/db.js';
import { photoURLs } from '../core/photos.js';
import { A, render } from '../core/router.js';
import { blank, S, save, setState } from '../core/state.js';
import { applyTheme } from '../core/theme.js';
import { confirmBox, modal } from '../core/ui.js';
import { $, esc, go, niceDate, todayStr, uid } from '../core/util.js';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_ROOT = 'Garden Planner backups';
const DRIVE_CLIENT_ID_DEFAULT = '';   // a published app would put its own Google sign-in ID here; for now it's pasted in Tools
const appURL = () => location.origin + location.pathname.replace(/index\.html$/, '');
const driveClientId = () => (S && S.drive && S.drive.clientId) || DRIVE_CLIENT_ID_DEFAULT;
export const driveOn = () => !!(S && S.drive && S.drive.connected && driveClientId());
function driveToken() { try { const t = JSON.parse(localStorage.getItem('gp.driveTok') || 'null'); return t && t.exp > Date.now() + 60000 ? t.tok : null; } catch (e) { return null; } }
// back from Google: take the token out of the address and put the page back where it was (runs before the app starts)
let driveReturned = null;   // what Google said when it sent us back (read once by driveTick)
(function driveReturn() {
  const h = location.hash; if (!/(^#|&)(access_token|error)=/.test(h)) return;
  const q = new URLSearchParams(h.slice(1)); let st = {};
  try { st = JSON.parse(localStorage.getItem('gp.driveState') || '{}'); } catch (e) { /* ignore */ }
  const ok = q.get('state') && q.get('state') === st.state;
  if (ok && q.get('access_token')) localStorage.setItem('gp.driveTok', JSON.stringify({ tok: q.get('access_token'), exp: Date.now() + (+q.get('expires_in') || 3600) * 1000 }));
  localStorage.removeItem('gp.driveState');
  history.replaceState(null, '', location.pathname + location.search + (st.back || '#/'));
  driveReturned = ok ? { ok: !!q.get('access_token'), err: q.get('error'), why: st.why } : null;
})();
// off to Google for access (silent: no screens unless Google needs you)
function driveAuth(why, silent) {
  const id = driveClientId(); if (!id) return false;
  const state = uid();
  try { localStorage.setItem('gp.driveState', JSON.stringify({ state, back: location.hash && !/access_token|error=/.test(location.hash) ? location.hash : '#/', why })); } catch (e) { return false; }
  const p = new URLSearchParams({ client_id: id, redirect_uri: appURL(), response_type: 'token', scope: DRIVE_SCOPE, include_granted_scopes: 'true', state });
  if (silent) p.set('prompt', 'none');
  if (S.drive && S.drive.email) p.set('login_hint', S.drive.email);
  location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + p.toString());
  return true;
}

// ---------- Drive calls ----------
async function gd(path, opts = {}) {
  const tok = driveToken(); if (!tok) throw Object.assign(new Error('Not signed in to Google'), { auth: true });
  const url = /^https:/.test(path) ? path : 'https://www.googleapis.com/drive/v3/' + path;
  const r = await fetch(url, Object.assign({}, opts, { headers: Object.assign({ Authorization: 'Bearer ' + tok }, opts.headers || {}) }));
  if (r.status === 401) { localStorage.removeItem('gp.driveTok'); throw Object.assign(new Error('Google access expired'), { auth: true }); }
  if (!r.ok) throw new Error(`Drive said ${r.status}: ${(await r.text()).slice(0, 160)}`);
  if (opts.raw) return r;
  return r.status === 204 ? null : r.json();
}
const qq = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
async function gdList(q, fields = 'id,name,size,createdTime,appProperties') {
  const out = []; let page = '';
  do {
    const r = await gd(`files?q=${encodeURIComponent(q)}&fields=nextPageToken,files(${fields})&pageSize=1000&orderBy=createdTime desc${page ? '&pageToken=' + page : ''}`);
    out.push(...(r.files || [])); page = r.nextPageToken || '';
  } while (page);
  return out;
}
async function gdFolder(name, parent) {
  const f = (await gdList(`name='${qq(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parent ? ` and '${parent}' in parents` : ''}`, 'id'))[0];
  if (f) return f.id;
  return (await gd('files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: parent ? [parent] : undefined }) })).id;
}
// one request: the file's details and its content
async function gdUpload(meta, blob, fileId) {
  const b = 'gp' + uid(), type = blob.type || 'application/octet-stream';
  const body = new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${type}\r\n\r\n`, blob, `\r\n--${b}--`]);
  return gd(`https://www.googleapis.com/upload/drive/v3/files${fileId ? '/' + fileId : ''}?uploadType=multipart&fields=id,name,size`, { method: fileId ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` }, body });
}

// ---------- back up ----------
let _driveBusy = false;
function driveStatus(t) { const el = document.getElementById('drivest'); if (el) el.textContent = t; }
async function driveBackup() {
  if (_driveBusy) return false; _driveBusy = true;
  try {
    driveStatus('Backing up to Google Drive…');
    const root = await gdFolder(DRIVE_ROOT), pf = await gdFolder('photos', root);
    // photos: only the ones not already there
    const have = new Set((await gdList(`'${pf}' in parents and trashed=false`, 'id,appProperties')).map(f => f.appProperties && f.appProperties.pid).filter(Boolean));
    const keys = (await DB.photoKeys()).filter(k => !have.has(k));
    let n = 0;
    for (const k of keys) { const blob = await DB.getPhoto(k); if (!blob) continue; await gdUpload({ name: `${k}.jpg`, parents: [pf], appProperties: { pid: k } }, blob); n++; driveStatus(`Backing up photos… ${n}/${keys.length}`); }
    // records: one file per day (today's is replaced if you back up again)
    const td = todayStr(), name = `garden-backup-${td}.json`;
    const data = new Blob([JSON.stringify({ app: 'garden-planner', format: 2, exported: new Date().toISOString(), state: S, photosIn: 'drive' })], { type: 'application/json' });
    const same = (await gdList(`'${root}' in parents and name='${name}' and trashed=false`, 'id'))[0];
    await gdUpload(same ? { name } : { name, parents: [root], appProperties: { gp: 'backup', date: td } }, data, same && same.id);
    // tidy: last 14 backups, plus the newest one of each month for a year
    const all = await gdList(`'${root}' in parents and name contains 'garden-backup-' and trashed=false`, 'id,name,createdTime');
    const keep = new Set(all.slice(0, 14).map(f => f.id)), months = {};
    for (const f of all) { const m = (f.name.match(/(\d{4}-\d{2})-\d{2}/) || [])[1]; if (m && !months[m] && Object.keys(months).length < 12) { months[m] = 1; keep.add(f.id); } }
    for (const f of all) if (!keep.has(f.id)) await gd(`files/${f.id}`, { method: 'DELETE' }).catch(() => {});
    Object.assign(S.drive, { lastDate: td, last: new Date().toISOString(), err: null, needTap: false, photos: have.size + n });
    S.lastBackup = td; await save();
    driveStatus(`Backed up ✓ ${n ? `(${n} new photo${n > 1 ? 's' : ''})` : ''}`);
    return true;
  } catch (e) {
    S.drive.err = e.auth ? null : e.message; if (e.auth) S.drive.needTap = true; await save();
    driveStatus(e.auth ? 'Google needs you to sign in again.' : 'Backup didn’t work: ' + e.message);
    throw e;
  } finally { _driveBusy = false; }
}
// when the app opens: back up if one is due
export async function driveTick() {
  if (!S.drive) return;
  const ret = driveReturned; driveReturned = null;
  if (ret && !ret.ok) {   // Google wants a tap (or it was cancelled)
    if (ret.why === 'connect') alert('Google Drive wasn’t connected' + (ret.err && ret.err !== 'access_denied' ? ` (${ret.err})` : '') + '.');
    else { S.drive.needTap = true; await save(); render(); }
    return;
  }
  if (ret && ret.ok && ret.why === 'connect') {
    S.drive.connected = true;
    try { const a = await gd('about?fields=user(emailAddress,displayName)'); S.drive.email = a.user && a.user.emailAddress; } catch (e) { /* not needed */ }
    await save();
  }
  if (!driveOn() || !navigator.onLine) return;
  const due = S.drive.lastDate !== todayStr(), asked = ret && ret.ok && ['now', 'connect', 'auto'].includes(ret.why);
  if (ret && ret.ok && ret.why === 'restore') return driveRestoreDialog();
  if (!due && !asked) return;
  if (driveToken()) { try { await driveBackup(); render(); } catch (e) { render(); } return; }
  if (S.drive.auto !== false && S.drive.lastTry !== todayStr()) { S.drive.lastTry = todayStr(); await save(); driveAuth('auto', true); return; }
  if (!S.drive.needTap) { S.drive.needTap = true; await save(); render(); }
}
export async function driveNow() {
  if (driveToken()) { try { await driveBackup(); } catch (e) { if (e.auth) driveAuth('now', false); } render(); return; }
  driveAuth('now', false);
}

// ---------- restore ----------
async function driveRestoreDialog() {
  if (!driveToken()) return driveAuth('restore', false);
  let list;
  try { const root = await gdFolder(DRIVE_ROOT); list = await gdList(`'${root}' in parents and name contains 'garden-backup-' and trashed=false`); }
  catch (e) { return alert('Couldn’t read your Drive backups: ' + e.message); }
  if (!list.length) return alert('No backups in Google Drive yet.');
  modal(`<h3>☁️ Restore from Google Drive</h3><p class="small muted">This replaces everything in the app with the backup you pick.</p>
    <ul class="plist">${list.map(f => `<li data-f="${f.id}"><span class="grow"><b>${niceDate((f.name.match(/\d{4}-\d{2}-\d{2}/) || [todayStr()])[0])}</b><small>${new Date(f.createdTime).toLocaleString('en-GB')} · ${Math.max(1, Math.round((+f.size || 0) / 1024))} KB</small></span>›</li>`).join('')}</ul>
    <div class="btns"><button class="btn" data-x="no">Cancel</button></div>`, (m, close) => {
    m.querySelector('[data-x=no]').onclick = close;
    m.querySelectorAll('[data-f]').forEach(li => li.onclick = async () => {
      const f = list.find(x => x.id === li.dataset.f);
      if (!await confirmBox(`Restore the backup from <b>${new Date(f.createdTime).toLocaleString('en-GB')}</b>?<br>This replaces everything currently in the app.`, 'Restore', true)) return;
      try {
        const data = await (await gd(`files/${f.id}?alt=media`, { raw: true })).json();
        if (!data || data.app !== 'garden-planner' || !data.state) return alert('That file isn’t a Garden Planner backup.');
        const txt = JSON.stringify(data.state), root = await gdFolder(DRIVE_ROOT), pf = await gdFolder('photos', root);
        const photos = (await gdList(`'${pf}' in parents and trashed=false`, 'id,appProperties')).filter(p => p.appProperties && p.appProperties.pid && txt.includes(p.appProperties.pid));
        const keepDrive = S.drive;
        await DB.clearPhotos(); for (const k of Object.keys(photoURLs)) delete photoURLs[k];
        let n = 0;
        for (const p of photos) { const b = await (await gd(`files/${p.id}?alt=media`, { raw: true })).blob(); await DB.putPhoto(p.appProperties.pid, b); n++; }
        for (const [k, u] of Object.entries(data.photos || {})) { const b = await (await fetch(u)).blob(); await DB.putPhoto(k, b); n++; }   // older backups had photos inside
        setState(Object.assign(blank(), data.state, { drive: keepDrive }));
        applyTheme(); await save(); alert(`Restored, with ${n} photo${n === 1 ? '' : 's'}.`); go('#/');
      } catch (e) { alert('Restore didn’t work: ' + e.message); }
    });
  });
}

// ---------- Tools → Backup ----------
export function driveSection() {
  const d = S.drive || {}, id = driveClientId();
  A.driveSetId = async () => { const v = ($('#gcid').value || '').trim(); if (!/\.apps\.googleusercontent\.com$/.test(v)) return alert('That doesn’t look like a Google client ID — it ends in .apps.googleusercontent.com'); S.drive = Object.assign({}, S.drive, { clientId: v }); await save(); render(); };
  A.driveConnect = () => { S.drive = Object.assign({ auto: true }, S.drive); save().then(() => driveAuth('connect', false)); };
  A.driveNow = () => driveNow();
  A.driveRestore = () => driveRestoreDialog();
  A.driveAuto = async () => { S.drive.auto = S.drive.auto === false; await save(); render(); };
  A.driveOff = async () => { if (!await confirmBox('Stop backing up to Google Drive? Your backups stay in your Drive.', 'Disconnect', true)) return; localStorage.removeItem('gp.driveTok'); S.drive = { clientId: S.drive.clientId }; await save(); render(); };
  if (!id) return `<section><h3>☁️ Google Drive</h3><p>Back up automatically to your own Google Drive every day. It needs a one-time setup in Google’s developer console (about 10 minutes) — I’ve sent the steps. You’ll need this app’s address:</p>
    <p class="mono small">${esc(appURL())}</p>
    <label>Google client ID<input id="gcid" placeholder="….apps.googleusercontent.com" autocomplete="off"></label>
    <div class="btnrow"><button class="btn small primary" data-act="driveSetId">Save</button></div></section>`;
  if (!d.connected) return `<section><h3>☁️ Google Drive</h3><p>Back up your records and photos to your own Google Drive automatically, once a day. The app can only see the files it makes there.</p>
    <div class="btnrow"><button class="btn primary" data-act="driveConnect">Connect Google Drive</button></div><p class="hint">Client ID set ✓ · Google may warn the app isn’t verified — that’s because it’s your own; choose Continue. If Google says “Access blocked … has not completed the Google verification process”, the account you picked isn’t a test user. Either add that exact address under Google Auth Platform → Audience → Test users, or (simplest, and needed anyway if the address is refused) tap Publish app on that same Audience page. Then try again; if Google says it hasn’t verified the app, tap Advanced → Go to Garden Planner.</p></section>`;
  const when = d.last ? new Date(d.last).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'not yet';
  return `<section><h3>☁️ Google Drive</h3>
    <p>${d.email ? `Connected as <b>${esc(d.email)}</b>. ` : 'Connected. '}Last backup: <b>${esc(when)}</b>${d.photos != null ? ` · ${d.photos} photo${d.photos === 1 ? '' : 's'} in Drive` : ''}.</p>
    ${d.err ? `<p class="banner warn small">Last try didn’t work: ${esc(d.err)}</p>` : ''}
    <label class="inl chkline"><input type="checkbox" data-act="driveAuto"${d.auto !== false ? ' checked' : ''}> <span>Back up by itself each day when the app opens <small>(it hops to Google and back; untick to be asked with a tap instead)</small></span></label>
    <p class="small muted" id="drivest"></p>
    <div class="btnrow"><button class="btn small primary" data-act="driveNow">☁️ Back up now</button><button class="btn small" data-act="driveRestore">Restore from Drive…</button></div>
    <div class="btnrow"><button class="link danger" data-act="driveOff" data-own-confirm>Disconnect</button></div>
    <p class="hint">Saved in “${DRIVE_ROOT}” in your Drive: the last 14 daily backups plus one a month for a year; photos are uploaded once. To remove the app’s access completely: Google Account → Security → Third-party connections.</p></section>`;
}
// home banner when Drive needs a tap
export function driveBanner() {
  if (!driveOn() || !S.drive.needTap) return '';
  A.driveNow = () => driveNow();
  return `<button class="banner" data-act="driveNow">☁️ Google Drive backup is due — tap to back up</button>`;
}
// the app can stay open in the background for days: check again whenever it comes back to the front
let _driveSeen = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !S || !driveOn() || Date.now() - _driveSeen < 30 * 60000) return;
  _driveSeen = Date.now(); driveTick().catch(e => console.warn('drive', e));
});
