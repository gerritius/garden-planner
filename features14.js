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

// ---------- home: one compact "heads-up" card instead of a stack of banners ----------
function headsItems() {
  const out = [];
  try {   // spray waiting periods
    const by = {}; for (const p of S.plantings.filter(isLive)) { const h = sprayHolds(p)[0]; if (h) (by[h.until] = by[h.until] || []).push(crop(p.cropId).en); }
    for (const u of Object.keys(by).sort()) out.push({ k: 'spray', i: '⛔', t: `Don’t pick <b>${esc(by[u].join(', '))}</b> until ${shortDate(u)} (spray wait)`, h: '#/picksafe' });
  } catch (e) { console.warn(e); }
  if (S.weather && S.weather.lat != null) {
    const ico = { frost: '❄️', rain: '🌧️', wind: '💨', heat: '🥵' };
    for (const [k, t] of Weather.alerts()) out.push({ k, i: ico[k] || '⚠️', t, h: null });
    try { const ds = sprayDays(), best = ds.find(x => x.wins.length); if (ds.length) out.push({ k: 'sprayday', i: '💦', t: best ? `Best spray window: ${dayName(best.d) === 'Today' ? 'today' : dayName(best.d)} ${best.wins.map(w => `${w[0]}:00–${w[1]}:00`).join(', ')}` : 'No good spray window in the next few days', h: '#/sprayday', low: true }); } catch (e) { console.warn(e); }
    try { for (const [p, k, t] of qualityWarnings()) out.push({ k, i: k === 'bolt' ? '🌼' : k === 'split' ? '💧' : '❄️', t: esc(t), h: '#/plant/' + p.id }); } catch (e) { console.warn(e); }
  }
  try { for (const n of coverNotes()) out.push({ k: 'cover', i: coverType(n.x.type)[1], t: esc(n.text), h: '#/container/' + n.c.id }); } catch (e) { console.warn(e); }
  return out.sort((a, b) => !!a.low - !!b.low);
}
function headsCard() {
  const items = headsItems(); if (!items.length) return '';
  const li = x => `<li>${x.h ? `<a href="${x.h}">` : '<div>'}<span class="hi">${x.i}</span><span class="grow">${x.t}</span>${x.h ? '<span class="muted">›</span></a>' : '</div>'}</li>`;
  const top = items.slice(0, 3), rest = items.slice(3);
  return `<section class="heads"><ul>${top.map(li).join('')}</ul>${rest.length ? `<details><summary>${rest.length} more</summary><ul>${rest.map(li).join('')}</ul></details>` : ''}</section>`;
}

// ---------- home: group repetitive jobs ----------
const JOB_GROUPS = { germ: 'Check seedlings are up', sgerm: 'Check seedlings are up', harvest: 'Earliest harvest — check crops', pickby: 'Pick soon', thin: 'Thinning', plan_prep: 'Bed prep for planned crops' };
function jobsList(tasks, max = 7) {
  const groups = {}, rows = [];
  for (const t of tasks) { const g = JOB_GROUPS[t.kind]; if (g) (groups[g] = groups[g] || []).push(t); }
  const done = new Set();
  for (const t of tasks) {
    if (done.has(t)) continue;
    const g = JOB_GROUPS[t.kind], list = g && groups[g];
    if (list && list.length >= 3) {
      list.forEach(x => done.add(x));
      const names = list.map(x => { const o = taskOwner(x); return o.p ? crop(o.p.cropId).en : x.startId && start(x.startId) ? crop(start(x.startId).cropId).en : ''; }).filter(Boolean);
      rows.push(`<li class="task tgrp"><details><summary><span class="gcount">${list.length}</span><span class="grow"><b>${g}</b><small>${esc([...new Set(names)].join(', '))}</small></span></summary><ul class="tasks">${list.map(x => taskLi(x)).join('')}</ul></details></li>`);
    } else { done.add(t); rows.push(taskLi(t)); }
  }
  return rows.length > max ? `${rows.slice(0, max).join('')}<li class="morejobs"><details><summary>Show ${rows.length - max} more</summary><ul class="tasks">${rows.slice(max).join('')}</ul></details></li>` : rows.join('');
}
