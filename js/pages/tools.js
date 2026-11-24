// The Tools page (settings and every tool), and the tabs between related tool pages.

import { copyFromMainSite, exportBackup, importBackup, snapshotSection } from '../backup/backup.js';
import { driveSection } from '../backup/drive.js';
import { eraseSection } from '../backup/erase.js';
import { climateSection } from '../climate/climate.js';
import { weatherSettings } from '../climate/weather.js';
import { morningSection } from '../core/notify.js';
import { A, render, setChrome } from '../core/router.js';
import { S, save } from '../core/state.js';
import { themeSettings } from '../core/theme.js';
import { $, daysBetween, esc, niceDate, shortDate, todayStr } from '../core/util.js';
import { learnSection } from '../plants/learning.js';
import { harvestTotalsSection } from '../records/review.js';
import { IS_TEST } from '../core/site.js';
import { allReleaseNotes } from '../core/updates.js';
import { APP_VERSION } from '../version.js';

// ---------- the Tools page ----------
export function pageSettings() {
  setChrome('Tools', { tab: 'settings', kicker: 'Backup, weather & settings' });
  A.export = exportBackup;
  A.relNotes = allReleaseNotes;
  A.copyMain = copyFromMainSite;
  A.import = () => $('#impf').click();
  A.persist = async () => { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist().catch(() => false); storageNote(true); };
  A.lang = async el => { S.lang = el.dataset.v; await save(); render(); };
  A.waterTog = async () => { S.water = Object.assign({}, S.water, { on: !(S.water && S.water.on === false) ? false : true }); await save(); render(); };
  const tile = (h, i, l) => `<a class="tile" href="${h}"><span>${i}</span>${l}</a>`;
  const bOld = !S.lastBackup || daysBetween(S.lastBackup, todayStr()) >= 7;
  const html = `<h3 class="grp">Plan &amp; grow</h3><div class="tiles">
      ${tile('#/plan', '📅', 'Season plan')}${tile('#/rotation', '🔄', 'Rotation')}${tile('#/seedlings', '🌱', 'Seedlings')}${tile('#/sow', '🗓️', 'Sowing calendar')}
      ${tile('#/mycrops', '🧺', 'My crops')}${tile('#/products', '📦', 'Products &amp; seeds')}${tile('#/sprayday', '💦', 'Sprays')}${tile('#/doctor', '🩺', 'What’s wrong?')}${tile('#/map', '🗺️', 'Garden map')}</div>
    <h3 class="grp">Records</h3><div class="tiles">
      ${tile('#/review', '📒', 'Seasons')}${tile('#/spend', '💴', 'Spending &amp; use')}${tile('#/varieties', '🏷️', 'Varieties')}${tile('#/timeline', '📷', 'Photos')}</div>
    ${IS_TEST ? `<section><h3>🧪 Test site</h3><p>This is the test site: new versions arrive here first. It has its own garden — nothing you do here touches your real one, and nothing is backed up to Google Drive.</p>
      <button class="btn wide" data-act="copyMain">Copy my real garden here</button></section>` : ''}
    <h3 class="grp">Settings</h3>
    <details class="set"${bOld ? ' open' : ''}><summary>💾 Backup <small>${S.lastBackup ? 'last ' + shortDate(S.lastBackup) : 'never backed up'}</small></summary><section><h3>Backup</h3>
      <p>Everything is stored only on this phone. Back up regularly — connect Google Drive below to have it done every day, or export a file and save it somewhere safe.</p>
      <p class="muted">Last backup: ${S.lastBackup ? niceDate(S.lastBackup) : 'never'}</p>
      <div class="btnrow"><button class="btn primary" data-act="export">💾 Export backup</button><button class="btn" data-act="import">Restore from backup…</button></div>
      <input type="file" id="impf" accept=".json,application/json,text/plain" hidden>
      <p class="hint" id="persist"></p><div id="snaps"></div></section>${driveSection()}</details>
    <details class="set"><summary>🔔 Reminders <small>${S.notify && S.notify.on ? 'morning reminder on' : 'morning reminder off'}</small></summary>${morningSection()}    <section><h3>Watering reminders</h3><p>Watering jobs for pots &amp; bags, each bed in the ground (they hold far more water, so much less often), indoor pots and seedlings — spaced by the temperature, and put off when enough rain has fallen or is forecast (needs the weather location for the rain).</p>
      <div class="btnrow"><button class="btn small" data-act="waterTog">${S.water && S.water.on === false ? 'Turn on' : 'Turn off'}</button></div></section></details>
    <details class="set"><summary>🌤️ Weather &amp; climate <small>${S.weather && S.weather.name ? esc(S.weather.name) : 'not set'}</small></summary>${weatherSettings()}${climateSection()}</details>
    <details class="set"><summary>🎨 Appearance &amp; crop names</summary>${themeSettings()}    <section><h3>Crop names</h3><div class="seg"><button type="button" data-act="lang" data-v="en" class="${S.lang !== 'ja' ? 'on' : ''}">English first</button><button type="button" data-act="lang" data-v="ja" class="${S.lang === 'ja' ? 'on' : ''}">日本語 first</button></div></section></details>
    <details class="set"><summary>🧠 Learned from your garden</summary>${learnSection()}</details>
    <details class="set"><summary>🧺 Harvest totals</summary>${harvestTotalsSection()}</details>
    ${eraseSection()}
    <p class="hint center">Garden Planner · v${APP_VERSION}${IS_TEST ? ' · test site' : ''} · <a href="#/settings" data-act="relNotes">What’s new</a></p>`;
  const after = async () => {
    $('#impf').addEventListener('change', e => importBackup(e.target.files[0]));
    storageNote();
    snapshotSection();
  };
  return { html, after };
}
async function storageNote(retried) {
  const el = $('#persist'); if (!el) return;
  const ok = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted().catch(() => false) : false;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let t;
  if (ok) t = '🔒 Storage is marked as protected — the phone won’t clear it on its own.';
  else if (ios && installed) t = '🔒 Installed on your Home Screen, so iOS keeps this app’s data (it isn’t cleared like ordinary Safari websites). It’s only lost if you delete the app from the Home Screen — keep exporting backups.';
  else if (ios) t = 'ℹ️ Opened in Safari: Safari may clear data for sites you haven’t visited in a while. Use Share → <b>Add to Home Screen</b> and open the app from there — keep your data by exporting a backup first and restoring it in the installed app.';
  else if (installed) t = `ℹ️ Your phone’s browser hasn’t marked storage as “protected”. It decides this itself (there’s no setting to force it) and normally only clears app data when the phone is almost out of space. Your backups are the real safety net. <button class="link" data-act="persist">${retried ? 'Still not granted — try again' : 'Ask again'}</button>`;
  else t = 'ℹ️ Opened in the browser. Install it (browser menu → <b>Install app</b> / Add to Home screen) for the safest storage, and keep exporting backups.';
  el.innerHTML = t;
}

// ---------- tabs between related tool pages ----------
// related Tools pages share one tile and switch with tabs (tabs replace the history entry, so Back goes to Tools)
const TOOL_GROUPS = [
  [['sprayday', '💦 Spray days'], ['picksafe', '✅ OK to pick?']],
  [['spend', '💴 Spending'], ['totals', '🧮 Product use']],
  [['review', '📒 Season review'], ['compare', '📊 Compare years']],
];
export function groupTabs(route) {
  const g = TOOL_GROUPS.find(x => x.some(([r]) => r === route)); if (!g) return '';
  A.tabGo = el => location.replace('#/' + el.dataset.r);
  return `<div class="seg tabs">${g.map(([r, l]) => `<button type="button" data-act="tabGo" data-r="${r}" class="${r === route ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}
