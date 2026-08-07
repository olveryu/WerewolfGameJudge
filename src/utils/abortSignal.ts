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

/** One combined signal plus explicit cleanup for compatibility listeners. */
export interface AbortSignalComposition {
  readonly signal: AbortSignal;
  dispose(): void;
}

/**
 * Compose multiple AbortSignals and release fallback listeners when the operation settles.
 * Native AbortSignal.any manages its own dependent-signal lifetime; older WebViews use
 * listeners that the caller must dispose after the operation completes.
 */
export function composeAbortSignals(signals: readonly AbortSignal[]): AbortSignalComposition {
  if (typeof AbortSignal.any === 'function') {
    return {
      signal: AbortSignal.any([...signals]),
      dispose: () => undefined,
    };
  }

  const controller = new AbortController();
  const listeners: Array<{
    readonly signal: AbortSignal;
    readonly handleAbort: () => void;
  }> = [];

  const dispose = (): void => {
    for (const listener of listeners) {
      listener.signal.removeEventListener('abort', listener.handleAbort);
    }
    listeners.length = 0;
  };

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      dispose();
      break;
    }
    const handleAbort = (): void => {
      controller.abort(signal.reason);
      dispose();
    };
    listeners.push({ signal, handleAbort });
    signal.addEventListener('abort', handleAbort, { once: true });
  }

  return { signal: controller.signal, dispose };
}
