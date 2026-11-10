/**
 * Reloads a tab that comes back after more than five minutes in the background. Long-suspended
 * WebViews (iOS Safari, WeChat) can resume with dead sockets and timers; a reload rebuilds every
 * connection, and the URL plus server state restore where the user was.
 */
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

export function installStaleTabReload(): void {
  let hiddenAtMs = 0;
  document.addEventListener('visibilitychange', (event) => {
    if (document.visibilityState === 'hidden') {
      hiddenAtMs = Date.now();
      return;
    }
    if (hiddenAtMs > 0 && Date.now() - hiddenAtMs > STALE_THRESHOLD_MS) {
      // The reload owns this resume; later listeners must not start work during teardown.
      event.stopImmediatePropagation();
      window.location.reload();
    }
  });
}

/** Removes service workers and caches left by the retired offline-cache strategy. */
export async function removeLegacyServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
  const cacheKeys = await caches.keys();
  await Promise.all(cacheKeys.map((key) => caches.delete(key)));
}
