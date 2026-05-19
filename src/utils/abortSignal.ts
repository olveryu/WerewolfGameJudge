/**
 * abortSignal — AbortSignal polyfills for legacy WebViews
 *
 * AbortSignal.timeout (Chrome 103+) and AbortSignal.any (Chrome 121+) are
 * unavailable in Chinese-market WebView shells (Baidu, WeChat) that ship
 * Chromium ≤97. These helpers provide equivalent semantics.
 */

/**
 * Create an AbortSignal that fires after `ms` milliseconds.
 * Uses native AbortSignal.timeout when available; falls back to
 * AbortController + setTimeout for Chromium <103.
 */
export function createTimeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => {
    controller.abort(new DOMException('Signal timed out.', 'TimeoutError'));
  }, ms);
  return controller.signal;
}

/**
 * Combine multiple AbortSignals — aborts when ANY of the inputs abort.
 * Uses native AbortSignal.any when available; falls back to manual
 * listener wiring for Chromium <121.
 */
export function combineSignals(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(signals);
  }

  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}
