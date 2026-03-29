/**
 * useWolfVoteCountdown — Deadline-driven progression timer hook
 *
 * Manages a per-second countdown tick driven by deadline fields on GameState:
 * - `wolfVoteDeadline` — wolf vote countdown (wolfKill step)
 * - `autoSkipDeadline` — vacant bottom card step auto-skip
 *
 * The two deadlines are mutually exclusive (different steps). The hook
 * picks whichever is defined as the effective deadline.
 * When the deadline expires, the Host fires `postProgression` and retries
 * every tick until it succeeds (success-gated via `postProgressionFiredRef`).
 * On success, new state arrives → deadline changes → useEffect
 * cleanup stops the interval.
 *
 * Does not render UI — returns `countdownTick` for downstream consumers
 * (e.g. `useRoomActions.getBottomAction` countdown display).
 */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import { useEffect, useRef, useState } from 'react';

import { fireAndForget } from '@/utils/errorUtils';
import { roomScreenLog } from '@/utils/logger';

interface UseWolfVoteCountdownParams {
  wolfVoteDeadline: number | undefined;
  autoSkipDeadline: number | undefined;
  isAudioPlaying: boolean | undefined;
  currentStepId: string | undefined;
  pendingRevealAcksCount: number;
  isHost: boolean;
  roomStatus: GameStatus;
  postProgression: () => Promise<boolean>;
}

/**
 * @returns countdownTick — increments every second while a deadline is active.
 *   Downstream consumers derive remaining seconds from `wolfVoteDeadline - Date.now()`.
 */
export function useWolfVoteCountdown({
  wolfVoteDeadline,
  autoSkipDeadline,
  isAudioPlaying,
  currentStepId,
  pendingRevealAcksCount,
  isHost,
  roomStatus,
  postProgression,
}: UseWolfVoteCountdownParams): number {
  const [countdownTick, setCountdownTick] = useState(0);
  const postProgressionFiredRef = useRef(false);

  // Effective deadline: pick whichever is defined (mutually exclusive)
  const effectiveDeadline = wolfVoteDeadline ?? autoSkipDeadline;

  // [DIAG] Log deadline sources on every render
  roomScreenLog.debug('[DIAG] useWolfVoteCountdown render', {
    wolfVoteDeadline,
    autoSkipDeadline,
    effectiveDeadline,
    isAudioPlaying,
    currentStepId,
    pendingRevealAcksCount,
    isHost,
    roomStatus,
  });

  // Reset fire-guard when deadline changes (new deadline = new countdown)
  useEffect(() => {
    roomScreenLog.debug('[DIAG] effectiveDeadline changed, resetting fire-guard', {
      effectiveDeadline,
    });
    postProgressionFiredRef.current = false;
  }, [effectiveDeadline]);

  useEffect(() => {
    roomScreenLog.debug('[DIAG] deadline effect running', {
      effectiveDeadline,
      isHost,
      roomStatus,
    });
    if (effectiveDeadline == null) return;
    // Guard: only fire postProgression while game is ongoing.
    // On host rejoin with status `ended`, stale wolfVoteDeadline may still exist
    // and be expired — without this guard it would fire immediately and get 400.
    if (roomStatus !== GameStatus.Ongoing) return;

    const tryProgression = (): void => {
      roomScreenLog.debug('[DIAG] tryProgression called', {
        isHost,
        firedRef: postProgressionFiredRef.current,
        effectiveDeadline,
        now: Date.now(),
        remainMs: effectiveDeadline - Date.now(),
      });
      if (!isHost || postProgressionFiredRef.current) return;
      postProgressionFiredRef.current = true;
      roomScreenLog.info('[DIAG] firing postProgression');
      fireAndForget(
        postProgression().then((ok) => {
          roomScreenLog.debug('[DIAG] postProgression returned', { ok });
          // Always reset — server may no-op (same revision) when autoSkipDeadline
          // hasn't passed yet. The 1s interval provides natural rate limiting;
          // when progression truly succeeds, effectiveDeadline changes and
          // useEffect cleanup stops the interval.
          postProgressionFiredRef.current = false;
        }),
        '[postProgression] fire failed',
        roomScreenLog,
      );
    };

    // Already expired on mount — fire immediately (Host only)
    if (Date.now() >= effectiveDeadline) {
      roomScreenLog.debug('[DIAG] deadline already expired on effect mount, firing immediately');
      tryProgression();
      // Non-host: nothing to tick or retry
      if (!isHost) return;
    }

    // Interval: countdown ticks + Host retry on failure.
    // For Host, the interval keeps running until postProgression succeeds
    // (new state arrives → deadline changes → useEffect cleanup).
    // For non-host, clears once deadline expires.
    const interval = setInterval(() => {
      const now = Date.now();
      const expired = now >= effectiveDeadline;
      roomScreenLog.debug('[DIAG] interval tick', {
        expired,
        remainMs: effectiveDeadline - now,
        firedRef: postProgressionFiredRef.current,
      });
      if (expired) {
        if (isHost) {
          tryProgression();
        } else {
          clearInterval(interval);
        }
      }
      setCountdownTick((t) => t + 1);
    }, 1000);
    return () => {
      roomScreenLog.debug('[DIAG] deadline effect cleanup', { effectiveDeadline });
      clearInterval(interval);
    };
  }, [effectiveDeadline, isHost, postProgression, roomStatus]);

  return countdownTick;
}
