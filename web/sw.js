/**
 * Service Worker — runtime caching for WerewolfGameJudge web app.
 *
 * Strategies:
 *   CanvasKit CDN (WASM):                   cache-first  — URL contains version, immutable
 *   Static assets (fonts/audio/pwa/images): cache-first  — content-hashed filenames, immutable
 *   CDN JS bundles (npmmirror /assets/js/*): cache-first — Metro source-hash in filename, immutable
 *   JS bundles (/assets/js/*):              network-first (5s timeout) — same-origin fallback
 *   Navigation (HTML):                      network-first (3s timeout) — SPA entry
 *
 * Not cached: /room/* (API), /manifest.json, *.txt (verification), non-GET.
 */

var CACHE = {
  wasm: 'wasm-v1',
  static: 'static-v1',
  js: 'js-v1',
  page: 'page-v1',
};

var CURRENT_CACHES = new Set(Object.values(CACHE));

// ─── Lifecycle ───────────────────────────────────────────────

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) {
              return !CURRENT_CACHES.has(k);
            })
            .map(function (k) {
              return caches.delete(k);
            }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

// ─── Fetch ───────────────────────────────────────────────────

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);

  // API / Pages Functions — never cache
  if (url.origin === self.location.origin && url.pathname.startsWith('/room/')) return;

  // Verification / meta files — never cache
  if (
    url.origin === self.location.origin &&
    (url.pathname === '/manifest.json' || url.pathname.endsWith('.txt'))
  )
    return;

  // CanvasKit CDN (WASM + JS): cache-first
  if (isCanvasKitCDN(url)) {
    event.respondWith(cacheFirst(request, CACHE.wasm));
    return;
  }

  // CDN JS bundles (npmmirror): cache-first — Metro source-hash in filename = immutable
  if (isCdnJsBundle(url)) {
    event.respondWith(cacheFirst(request, CACHE.js));
    return;
  }

  // CDN static assets (npmmirror): cache-first — content-hashed filenames, immutable
  if (isCdnStaticAsset(url)) {
    event.respondWith(cacheFirst(request, CACHE.static));
    return;
  }

  // Same-origin only below
  if (url.origin !== self.location.origin) return;

  // Immutable static assets: cache-first
  if (isImmutableAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, CACHE.static));
    return;
  }

  // JS bundles: network-first (5s timeout)
  if (url.pathname.startsWith('/assets/js/')) {
    event.respondWith(networkFirst(request, CACHE.js, 5000));
    return;
  }

  // Navigation: network-first (3s timeout), cache key normalized to /index.html (SPA)
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request, CACHE.page, 3000));
    return;
  }
});

// ─── Matchers ────────────────────────────────────────────────

function isCanvasKitCDN(url) {
  return url.hostname.includes('npmmirror.com') && url.pathname.includes('canvaskit-wasm');
}

/** JS bundles served from npmmirror CDN (content-hashed, immutable). */
function isCdnJsBundle(url) {
  return url.hostname.includes('npmmirror.com') && url.pathname.includes('/assets/js/');
}

/** Non-JS static assets served from npmmirror CDN (fonts, audio, images — content-hashed, immutable). */
function isCdnStaticAsset(url) {
  return (
    url.hostname.includes('npmmirror.com') &&
    url.pathname.includes('/assets/') &&
    !url.pathname.includes('/assets/js/') &&
    !url.pathname.includes('canvaskit-wasm')
  );
}

function isImmutableAsset(pathname) {
  return (
    pathname.startsWith('/assets/fonts/') ||
    pathname.startsWith('/assets/audio/') ||
    pathname.startsWith('/assets/audio_end/') ||
    pathname.startsWith('/assets/pwa/') ||
    pathname.startsWith('/assets/avatars/') ||
    pathname.startsWith('/assets/badges/') ||
    pathname.startsWith('/assets/bgm/')
  );
}

// ─── Strategies ──────────────────────────────────────────────

function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request).then(function (cached) {
      if (cached) return cached;

      return fetch(request)
        .then(function (response) {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(function () {
          return new Response('Network error', { status: 503, statusText: 'Service Unavailable' });
        });
    });
  });
}

function networkFirst(request, cacheName, timeoutMs) {
  return caches.open(cacheName).then(function (cache) {
    return fetchWithTimeout(request, timeoutMs)
      .then(function (response) {
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      })
      .catch(function () {
        return cache.match(request).then(function (cached) {
          return (
            cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
          );
        });
      });
  });
}

/** Navigation: normalize cache key to /index.html so ?wxcode= variants share one entry. */
function networkFirstNavigation(request, cacheName, timeoutMs) {
  var cacheKey = new Request('/index.html');
  return caches.open(cacheName).then(function (cache) {
    return fetchWithTimeout(request, timeoutMs)
      .then(function (response) {
        if (response.ok) {
          cache.put(cacheKey, response.clone());
        }
        return response;
      })
      .catch(function () {
        return cache.match(cacheKey).then(function (cached) {
          return (
            cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
          );
        });
      });
  });
}

function fetchWithTimeout(request, ms) {
  var controller = new AbortController();
  var id = setTimeout(function () {
    controller.abort();
  }, ms);
  return fetch(request, { signal: controller.signal }).finally(function () {
    clearTimeout(id);
  });
}
