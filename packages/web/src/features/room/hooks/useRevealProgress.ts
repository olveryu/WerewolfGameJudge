/** Derive local animation frames from the server's one reveal timeline, never from frame counts. */

import { useMemo, useSyncExternalStore } from 'react';

import { useAppVisibility } from '@/features/product/hooks/useAppVisibility';
import { usePrefersReducedMotion } from '@/scene/usePrefersReducedMotion';
import type { ServerClock } from '@/services/serverClock';

export interface RevealTiming {
  readonly revealStartedAt: number | null;
  readonly revealDurationMs: number;
}

function createRevealProgress(timing: RevealTiming | null, clock: ServerClock | null) {
  const calculate = (): number => {
    if (timing === null || timing.revealStartedAt === null || timing.revealDurationMs <= 0)
      return 1;
    if (clock === null) return 0;
    return Math.max(
      0,
      Math.min(1, (clock.nowMs() - timing.revealStartedAt) / timing.revealDurationMs),
    );
  };
  let progress = calculate();
  return {
    getSnapshot: () => progress,
    subscribe: (listener: () => void) => {
      let frame = 0;
      const tick = () => {
        progress = Math.max(progress, calculate());
        listener();
        if (progress < 1 && clock !== null) frame = requestAnimationFrame(tick);
      };
      tick();
      return () => cancelAnimationFrame(frame);
    },
  };
}

function doNotAnimate(): () => void {
  return () => undefined;
}

/** Stops work when hidden or finished; foregrounding seeks to the authoritative elapsed time. */
export function useRevealProgress(timing: RevealTiming | null, clock: ServerClock | null): number {
  const isVisible = useAppVisibility();
  const reducedMotion = usePrefersReducedMotion();
  const revealStartedAt = timing?.revealStartedAt ?? null;
  const revealDurationMs = timing?.revealDurationMs ?? 0;
  const store = useMemo(
    () => createRevealProgress({ revealStartedAt, revealDurationMs }, clock),
    [clock, revealDurationMs, revealStartedAt],
  );
  const progress = useSyncExternalStore(
    isVisible && !reducedMotion ? store.subscribe : doNotAnimate,
    store.getSnapshot,
  );
  return reducedMotion ? 1 : progress;
}
