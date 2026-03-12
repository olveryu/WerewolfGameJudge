/**
 * useWolfVoteCountdown — Wolf vote countdown timer hook
 *
 * Manages a per-second countdown tick driven by `gameState.wolfVoteDeadline`.
 * When the deadline expires, the Host fires `postProgression` exactly once
 * to trigger server-side inline progression.
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

    // Already expired on mount — fire postProgression immediately (once)
    if (Date.now() >= wolfVoteDeadline) {
      if (isHost && !postProgressionFiredRef.current) {
        postProgressionFiredRef.current = true;
        fireAndForget(
          postProgression().then((ok) => {
            if (!ok) postProgressionFiredRef.current = false;
          }),
          '[postProgression] countdown expired fire failed',
          roomScreenLog,
        );
      }
      return;
    }

    const interval = setInterval(() => {
      if (Date.now() >= wolfVoteDeadline) {
        clearInterval(interval);
        // Host triggers server-side progression when countdown expires
        if (isHost && !postProgressionFiredRef.current) {
          postProgressionFiredRef.current = true;
          fireAndForget(
            postProgression().then((ok) => {
              if (!ok) postProgressionFiredRef.current = false;
            }),
            '[postProgression] countdown interval fire failed',
            roomScreenLog,
          );
        }
      }
      setCountdownTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [wolfVoteDeadline, isHost, postProgression, roomStatus]);

  return countdownTick;
}
