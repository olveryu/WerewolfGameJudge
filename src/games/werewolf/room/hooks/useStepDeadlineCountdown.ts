/**
 * useStepDeadlineCountdown — Deadline-driven progression timer hook
 *
 * Manages a per-second countdown tick driven by `stepDeadline` on GameState.
 * This unified deadline covers both:
 * - wolf vote countdown (wolfKill step: all voted → 5s countdown)
 * - vacant bottom card step auto-skip (random 5–10s delay)
 *
 * When the deadline expires, the Host fires `expirePhase` (the client
 * acceleration of the server's scheduled settle) and retries every tick
 * until the step lands (gated via `expireFiredRef`). On success, new
 * state arrives → deadline changes → useEffect cleanup stops the interval.
 *
 * Does not render UI — returns `countdownTick` for downstream consumers
 * (e.g. `useRoomActions.getBottomAction` countdown display).
 *
 * The caller passes the one armed deadline: a live night step's
 * `stepDeadline`, or a sheriff voting round's settle deadline during
 * the Day election. Both carriers exist only inside the phase that
 * armed them (the state invariants reject them anywhere else), so
 * this hook needs no room-status gate of its own.
 */

import { useEffect, useRef, useState } from 'react';

import { fireAndForget } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

interface UseStepDeadlineCountdownParams {
  stepDeadline: number | undefined;
  isHost: boolean;
  expirePhase: () => Promise<boolean>;
}

/**
 * @returns countdownTick — increments every second while a deadline is active.
 *   Downstream consumers derive remaining seconds from `stepDeadline - Date.now()`.
 */
export function useStepDeadlineCountdown({
  stepDeadline,
  isHost,
  expirePhase,
}: UseStepDeadlineCountdownParams): number {
  const [countdownTick, setCountdownTick] = useState(0);
  const expireFiredRef = useRef(false);

  // Reset fire-guard when deadline changes (new deadline = new countdown)
  useEffect(() => {
    expireFiredRef.current = false;
  }, [stepDeadline]);

  useEffect(() => {
    if (stepDeadline == null) return;

    const tryExpire = (): void => {
      if (!isHost || expireFiredRef.current) return;
      expireFiredRef.current = true;
      fireAndForget(
        expirePhase().then(() => {
          // Always reset — the server rejects while the deadline is not yet
          // reached (clock skew). The 1s interval provides natural rate
          // limiting; when the step lands, stepDeadline changes and the
          // useEffect cleanup stops the interval.
          expireFiredRef.current = false;
        }),
        '[expirePhase] fire failed',
        roomScreenLog,
      );
    };

    // Already expired on mount — fire immediately (Host only)
    if (Date.now() >= stepDeadline) {
      tryExpire();
      // Non-host: nothing to tick or retry
      if (!isHost) return;
    }

    // Interval: countdown ticks + Host retry on failure.
    // For Host, the interval keeps running until expirePhase lands the step
    // (new state arrives → deadline changes → useEffect cleanup).
    // For non-host, clears once deadline expires.
    const interval = setInterval(() => {
      const now = Date.now();
      const expired = now >= stepDeadline;
      if (expired) {
        if (isHost) {
          tryExpire();
        } else {
          clearInterval(interval);
        }
      }
      setCountdownTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [stepDeadline, isHost, expirePhase]);

  return countdownTick;
}
