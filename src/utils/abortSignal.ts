/**
 * abortSignal — Portable AbortSignal timeout and composition helpers
 *
 * AbortSignal.timeout (Chrome 103+) and AbortSignal.any (Chrome 121+) are
 * unavailable in supported Chinese-market WebView shells that ship older Chromium.
 * These helpers preserve the same timeout and any-signal semantics across runtimes.
 */

/**
 * Create an AbortSignal that fires after `ms` milliseconds.
 * Uses native AbortSignal.timeout when available and an AbortController timer otherwise.
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
 * Uses native AbortSignal.any when available and explicit listener composition otherwise.
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
