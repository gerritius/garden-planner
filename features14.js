/* Morning reminder (Android periodic background sync) and shared UI helpers. */
'use strict';

async function notifyStatus() {
  const r = { notif: 'Notification' in window, perm: 'Notification' in window ? Notification.permission : 'unsupported', periodic: false, registered: false };
  try { const reg = await navigator.serviceWorker.ready; r.periodic = 'periodicSync' in reg; if (r.periodic) r.registered = (await reg.periodicSync.getTags()).includes('morning'); } catch (e) { /* no SW */ }
  return r;
}
async function enableMorning(on) {
  S.notify = Object.assign({ from: 6 }, S.notify, { on });
  await save();
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!on) { try { if (reg && reg.periodicSync) await reg.periodicSync.unregister('morning'); } catch (e) { /* ignore */ } return 'off'; }
  if (!('Notification' in window)) return 'This browser can’t show notifications.';
  const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (p !== 'granted') return 'Notifications are blocked — allow them for this app in Android settings.';
  if (!reg || !reg.periodicSync) return 'On — but this browser can’t wake the app in the background, so reminders only come when the app has been opened recently.';
  try {
    const st = await navigator.permissions.query({ name: 'periodic-background-sync' }).catch(() => ({ state: 'granted' }));
    if (st.state === 'denied') return 'Android/Chrome hasn’t allowed background updates for this app yet. Keep it installed and use it regularly — Chrome allows it for apps you use often.';
    await reg.periodicSync.register('morning', { minInterval: 4 * 3600e3 });
    return 'ok';
  } catch (e) { return 'Couldn’t schedule background checks: ' + e.message; }
}
function morningSection() {
  const on = !!(S.notify && S.notify.on);
  A.morningTog = async () => { const msg = await enableMorning(!on); render(); if (msg && msg !== 'ok' && msg !== 'off') setTimeout(() => { const el = $('#morningMsg'); if (el) el.textContent = msg; }, 50); };
  A.morningTest = async () => {
    if (Notification.permission !== 'granted' && await Notification.requestPermission() !== 'granted') return alert('Notifications are blocked for this app.');
    const reg = await navigator.serviceWorker.ready; S.notify = Object.assign({ from: 6 }, S.notify, { on: true }); await save();
    if (reg.active) reg.active.postMessage('testMorning');
  };
  setTimeout(async () => { const el = $('#morningMsg'); if (!el || el.textContent) return; const st = await notifyStatus();
    el.textContent = !on ? '' : st.perm !== 'granted' ? 'Notifications aren’t allowed yet — tap “Send a test” to allow them.' : st.registered ? '✓ Scheduled. Chrome decides exactly when to wake the app (usually a few times a day for apps you use often); the reminder is only sent between 6 and 11 am, once a day.' : st.periodic ? 'Not scheduled yet — turn it off and on again.' : 'This browser can’t wake the app in the background, so morning reminders may not arrive.'; }, 0);
  return `<section><h3>Morning reminder</h3><p>A notification with today’s garden jobs, some time between 6 and 11 am.</p>
    <div class="btnrow"><button class="btn small${on ? '' : ' primary'}" data-act="morningTog">${on ? 'Turn off' : 'Turn on'}</button>${on ? '<button class="btn small" data-act="morningTest">Send a test</button>' : ''}</div>
    <p class="hint" id="morningMsg"></p></section>`;
}
