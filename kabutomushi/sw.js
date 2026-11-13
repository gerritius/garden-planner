// Kabutomushi Keeper moved to https://gerritius.github.io/kabutomushi/.
// This replaces the old service worker so it removes itself and its cache, and stops serving the old app offline.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k === 'kabutomushi-v1' || k === 'kabutomushi-v2') await caches.delete(k);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate('https://gerritius.github.io/kabutomushi/');
  })());
});
