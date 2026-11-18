/**
 * useRoomAudioResume — when to show the host the post-rejoin resume gate,
 * and what "continue" does.
 *
 * The shared audio hook owns the host's reactive recovery signal, across all game phases.
 * Continue passes the gesture to playback; failure reopens the gate without a room revision.
 * Lower-priority alerts remain blocked only while this gate is due.
 */

import { useCallback, useEffect } from 'react';

import { setAlertBlocked } from '@/utils/alert';

export interface RoomAudioResumeOptions {
  readonly isResumeRequired: boolean;
  /**
   * Replay the interrupted narration and ack it; resolves when the chain
   * settles. Recovery clears synchronously when playback starts and re-arms if it fails.
   */
  readonly resume: () => Promise<void>;
  /** Restart BGM after the gesture (games with BGM); omitted when none. */
  readonly onResumed?: () => void;
}

export interface RoomAudioResume {
  readonly isDue: boolean;
  readonly continueGame: () => void;
}

export function useRoomAudioResume({
  isResumeRequired,
  resume,
  onResumed,
}: RoomAudioResumeOptions): RoomAudioResume {
  const isDue = isResumeRequired;

  useEffect(() => {
    if (!isDue) return;
    setAlertBlocked(true);
    return () => setAlertBlocked(false);
  }, [isDue]);

  const continueGame = useCallback(() => {
    setAlertBlocked(false);
    onResumed?.();
    void resume();
  }, [onResumed, resume]);

  return { isDue, continueGame };
}
