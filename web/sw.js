/**
 * Suicide Service Worker — replaces the previous caching SW.
 *
 * On activate: deletes ALL caches and unregisters itself.
 * Existing users will fetch this version (skipWaiting), clearing stale caches.
 * Once all users have transitioned, this file can be removed entirely.
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
        return self.registration.unregister();
      }),
  );
});
