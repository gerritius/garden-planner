// Offline support: network first (so updates arrive), cache fallback when offline.
const CACHE = 'garden-planner-v45';
const ASSETS = ['./', 'index.html', 'style.css', 'catalog.js', 'db.js', 'draw.js', 'app.js', 'icons.js', 'features.js', 'features2.js', 'features3.js', 'features4.js', 'registrations.js', 'features5.js', 'features6.js', 'features7.js', 'features8.js', 'features9.js', 'features10.js', 'features11.js', 'features12.js', 'features13.js', 'features14.js', 'features15.js', 'features16.js', 'features17.js', 'features18.js', 'features19.js', 'features20.js', 'features21.js', 'fonts/ZillaSlab-500.woff2', 'fonts/ZillaSlab-700.woff2', 'fonts/Caveat-600.woff2', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('garden-planner-') && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    (e.request.mode === 'navigate' ? fetch(e.request) : fetch(e.request, { cache: 'no-cache' })).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});

// ---------- morning reminder (Android: periodic background sync, no server) ----------
function idbGet(key) {
  return new Promise(res => {
    const r = indexedDB.open('garden-planner', 1);
    r.onerror = () => res(null);
    r.onsuccess = () => { try { const q = r.result.transaction('kv').objectStore('kv').get(key); q.onsuccess = () => res(q.result); q.onerror = () => res(null); } catch (e) { res(null); } };
  });
}
function idbSet(key, val) {
  return new Promise(res => { const r = indexedDB.open('garden-planner', 1); r.onerror = () => res(); r.onsuccess = () => { try { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(val, key); t.oncomplete = () => res(); t.onerror = () => res(); } catch (e) { res(); } }; });
}
const ymdLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
async function morningJobs(force) {
  const now = new Date(), td = ymdLocal(now), h = now.getHours();
  const S = await idbGet('state'); if (!S || !S.notify || !S.notify.on) return;
  if (!force && (h < (S.notify.from ?? 6) || h > 11 || (await idbGet('notified')) === td)) return;
  const live = id => { const p = (S.plantings || []).find(x => x.id === id); return p && p.status !== 'harvested'; };
  const jobs = (S.tasks || []).filter(t => !t.done && t.due && t.due <= td && (!t.plantingId || live(t.plantingId)) && !(t.kind === 'water' && S.water && S.water.on === false));
  if (!jobs.length && !force) { await idbSet('notified', td); return; }
  const name = id => { const p = (S.plantings || []).find(x => x.id === id); return p ? p.cropId : ''; };
  const order = t => t.kind === 'wx' || t.kind === 'frost' ? 0 : t.kind === 'water' ? 1 : 2;
  const lines = jobs.sort((a, b) => order(a) - order(b)).slice(0, 5).map(t => '• ' + t.title);
  await self.registration.showNotification(jobs.length ? `${jobs.length} garden job${jobs.length > 1 ? 's' : ''} today` : 'Nothing to do in the garden today', {
    body: lines.join('\n') + (jobs.length > 5 ? `\n…and ${jobs.length - 5} more` : ''), tag: 'morning', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: './#/' } });
  await idbSet('notified', td);
}
self.addEventListener('periodicsync', e => { if (e.tag === 'morning') e.waitUntil(morningJobs(false)); });
self.addEventListener('message', e => { if (e.data === 'testMorning') e.waitUntil ? e.waitUntil(morningJobs(true)) : morningJobs(true); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { for (const c of cs) if ('focus' in c) { c.navigate && c.navigate(e.notification.data && e.notification.data.url || './'); return c.focus(); } return self.clients.openWindow(e.notification.data && e.notification.data.url || './'); }));
});
