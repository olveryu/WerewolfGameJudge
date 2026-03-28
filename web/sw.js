// Service Worker for PWA offline support
// __SW_CACHE_VERSION__ is replaced by deploy.sh at build time
const CACHE_NAME = '__SW_CACHE_VERSION__';

// 需要缓存的资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/pwa/icon-192.png',
  '/assets/pwa/icon-512.png',
  '/assets/pwa/apple-touch-icon.png',
];

// 安装事件 - 缓存静态资源
// 不调用 skipWaiting()：等待页面 postMessage('SKIP_WAITING') 后再激活，
// 避免新 SW 中途接管导致旧 JS bundle 被清缓存 → 白屏。
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }),
  );
});

// 页面通知可以安全切换时，立即激活新 SW
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }),
      );
    }),
  );
  // 不调用 clients.claim()：让新 SW 等到下次导航自然接管，
  // 避免 controllerchange 触发页面 reload 中断当前会话。
});

// 请求拦截 - 网络优先，失败则使用缓存
self.addEventListener('fetch', (event) => {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') {
    return;
  }

  // 跳过 Supabase API 请求（需要实时数据）
  var hostname = new URL(event.request.url).hostname;
  if (hostname.endsWith('.supabase.co') || hostname.endsWith('.supabase.in')) {
    return;
  }

  // CDN 资源（CanvasKit WASM 等）: cache-first，版本号在 URL 中保证不过期
  if (hostname === 'cdn.jsdelivr.net') {
    event.respondWith(
      caches.match(event.request).then(function (cached) {
        if (cached) return cached;
        return fetch(event.request).then(function (response) {
          if (response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      }),
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 请求成功，克隆并缓存
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // 网络失败，尝试从缓存获取
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // 如果是导航请求，返回首页
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503 });
        });
      }),
  );
});
