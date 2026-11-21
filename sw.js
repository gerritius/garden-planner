// Offline support: network first (so updates arrive), cache fallback when offline.
const CACHE = 'garden-planner-v62';
const ASSETS = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/ZillaSlab-500.woff2', 'fonts/ZillaSlab-700.woff2', 'fonts/Caveat-600.woff2',
  // the app's modules (a test checks this list covers every file the app loads)
  'js/backup/backup.js', 'js/backup/drive.js', 'js/climate/climate.js', 'js/climate/sowing.js', 'js/climate/weather.js',
  'js/core/db.js', 'js/core/forms.js', 'js/core/notify.js', 'js/core/photos.js', 'js/core/router.js', 'js/core/state.js',
  'js/core/theme.js', 'js/core/ui.js', 'js/core/util.js', 'js/data/catalog.js', 'js/data/icons.js', 'js/data/products.js',
  'js/data/registrations.js', 'js/draw.js', 'js/feeding/ledger.js', 'js/feeding/mix.js', 'js/feeding/nutrients.js',
  'js/feeding/planner.js', 'js/feeding/plans.js', 'js/feeding/sim.js', 'js/feeding/stages.js', 'js/garden/garden.js',
  'js/garden/ideas.js', 'js/garden/map.js', 'js/garden/planning.js', 'js/garden/rotation.js', 'js/garden/soil.js',
  'js/garden/tasks.js', 'js/garden/watering.js', 'js/main.js', 'js/pages/calendar.js', 'js/pages/container.js',
  'js/pages/home.js', 'js/pages/planting-form.js', 'js/pages/planting.js', 'js/pages/search.js', 'js/pages/tools.js',
  'js/plants/covers.js', 'js/plants/crops.js', 'js/plants/growth.js', 'js/plants/learning.js', 'js/plants/problems.js',
  'js/plants/seedlings.js', 'js/plants/varieties.js', 'js/products/library.js', 'js/products/pages.js', 'js/products/sprays.js',
  'js/records/history.js', 'js/records/log.js', 'js/records/notes.js', 'js/records/review.js', 'js/version.js'];

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
