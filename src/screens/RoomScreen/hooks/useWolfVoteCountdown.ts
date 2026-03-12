/**
 * useWolfVoteCountdown — Wolf vote countdown timer hook
 *
 * Manages a per-second countdown tick driven by `gameState.wolfVoteDeadline`.
 * When the deadline expires, the Host fires `postProgression` and retries
 * every tick until it succeeds (success-gated via `postProgressionFiredRef`).
 * On success, new state arrives → `wolfVoteDeadline` changes → useEffect
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
  isHost,
  roomStatus,
  postProgression,
}: UseWolfVoteCountdownParams): number {
  const [countdownTick, setCountdownTick] = useState(0);
  const postProgressionFiredRef = useRef(false);

  // Reset fire-guard when deadline changes (new deadline = new countdown)
  useEffect(() => {
    postProgressionFiredRef.current = false;
  }, [wolfVoteDeadline]);

  useEffect(() => {
    if (wolfVoteDeadline == null) return;
    // Guard: only fire postProgression while game is ongoing.
    // On host rejoin with status `ended`, stale wolfVoteDeadline may still exist
    // and be expired — without this guard it would fire immediately and get 400.
    if (roomStatus !== GameStatus.Ongoing) return;

    const tryProgression = (): void => {
      if (!isHost || postProgressionFiredRef.current) return;
      postProgressionFiredRef.current = true;
      fireAndForget(
        postProgression().then((ok) => {
          if (!ok) postProgressionFiredRef.current = false;
        }),
        '[postProgression] fire failed',
        roomScreenLog,
      );
    };

    // Already expired on mount — fire immediately (Host only)
    if (Date.now() >= wolfVoteDeadline) {
      tryProgression();
      // Non-host: nothing to tick or retry
      if (!isHost) return;
    }

    // Interval: countdown ticks + Host retry on failure.
    // For Host, the interval keeps running until postProgression succeeds
    // (new state arrives → wolfVoteDeadline changes → useEffect cleanup).
    // For non-host, clears once deadline expires.
    const interval = setInterval(() => {
      if (Date.now() >= wolfVoteDeadline) {
        if (isHost) {
          tryProgression();
        } else {
          clearInterval(interval);
        }
      }
      setCountdownTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [wolfVoteDeadline, isHost, postProgression, roomStatus]);

  return countdownTick;
}
