/**
 * useNowMs — the room's one wall-clock ticker.
 *
 * Every countdown in a room (stage deadline, night-step deadline,
 * sheriff settle countdown) derives its remaining time from the same
 * `nowMs` instead of running its own `setInterval`. The hook ticks at
 * the given interval while the app is visible and re-syncs to
 * `Date.now()` the moment it becomes visible again, so a backgrounded
 * tab shows the true remaining time on return rather than a stale
 * count. Readers derive, never store: `deadlineAt - nowMs` is the
 * remaining time, recomputed on each tick.
 *
 * `isActive` gates the ticker: a room with nothing counting down (lobby,
 * a phase without a deadline) must not re-render every second, so the
 * caller passes false and `nowMs` holds its last value until the clock
 * is needed again (it re-syncs on activation).
 */

import { useMemo, useSyncExternalStore } from 'react';

import { useAppVisibility } from '@/features/product/hooks/useAppVisibility';

export const NOW_MS_DEFAULT_INTERVAL_MS = 1000;

/** A wall clock read through `useSyncExternalStore`: it re-syncs on subscribe and ticks while subscribed. */
function createClock(intervalMs: number) {
  let nowMs = Date.now();
  return {
    subscribe: (listener: () => void): (() => void) => {
      nowMs = Date.now();
      const interval = setInterval(() => {
        nowMs = Date.now();
        listener();
      }, intervalMs);
      return () => clearInterval(interval);
    },
    getSnapshot: (): number => nowMs,
  };
}

function holdStill(): () => void {
  return () => undefined;
}

export function useNowMs(intervalMs: number = NOW_MS_DEFAULT_INTERVAL_MS, isActive = true): number {
  if (!Number.isSafeInteger(intervalMs) || intervalMs <= 0) {
    throw new Error(`[FAIL-FAST] useNowMs interval must be a positive integer: ${intervalMs}`);
  }
  const isVisible = useAppVisibility();
  const clock = useMemo(() => createClock(intervalMs), [intervalMs]);
  return useSyncExternalStore(
    isVisible && isActive ? clock.subscribe : holdStill,
    clock.getSnapshot,
  );
}
