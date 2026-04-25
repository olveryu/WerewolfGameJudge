/**
 * Suicide Service Worker — replaces the previous caching SW.
 *
 * On activate: deletes ALL caches, force-reloads every open tab (so stale
 * cached HTML is replaced), then unregisters itself.
 *
 * No fetch handler — all requests fall through to the network after claim().
 */

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (k) {
            return caches.delete(k);
          }),
        );
      })
      .then(function () {
        return self.clients.claim();
      })
      .then(function () {
        // Force-reload all open windows so they fetch fresh HTML from network.
        // This SW has no fetch handler, so navigations go straight to the server.
        return self.clients.matchAll({ type: 'window' });
      })
      .then(function (clients) {
        clients.forEach(function (client) {
          client.navigate(client.url);
        });
      })
      .then(function () {
        return self.registration.unregister();
      }),
  );
});
