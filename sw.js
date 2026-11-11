// Offline support: network first (so updates arrive), cache fallback when offline.
const CACHE = 'garden-planner-v8';
const ASSETS = ['./', 'index.html', 'style.css', 'catalog.js', 'db.js', 'draw.js', 'app.js', 'icons.js', 'features.js', 'features2.js', 'fonts/ZillaSlab-500.woff2', 'fonts/ZillaSlab-700.woff2', 'fonts/Caveat-600.woff2', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
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
