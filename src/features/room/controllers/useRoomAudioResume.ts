/**
 * useRoomAudioResume — when to show the host the post-rejoin resume gate,
 * and what "continue" does.
 *
 * The audio core marks `wasAudioInterrupted` when a new link epoch opens
 * for the host mid-game (the device has no user gesture for audio after
 * a reconnect). While that mark is set in an active phase, the dialog is
 * due and lower-priority alerts are blocked so nothing covers the
 * continue button. Continue clears the block, hides the dialog, and
 * hands the replay to the game's `resume` (the core's
 * `resumeInterrupted`), fire-and-forget: the dialog never waits on
 * playback. The mark is a core-side flag, not React state, so it is
 * re-read on every authoritative revision.
 */

import { useCallback, useEffect, useState } from 'react';

import { setAlertBlocked } from '@/utils/alert';

export interface RoomAudioResumeOptions {
  readonly isHost: boolean;
  /** The game is in a phase with host narration (e.g. the night). */
  readonly isNarratedPhase: boolean;
  /** Hidden (blurred) screens show no dialog and run no side effects. */
  readonly isFocused: boolean;
  /** Authoritative revision; the interruption mark is re-read when it changes. */
  readonly revision: number;
  /** The audio core's interruption mark, read fresh. */
  readonly readWasAudioInterrupted: () => boolean;
  /**
   * Replay the interrupted narration and ack it; resolves when the chain
   * settles. Must clear the interruption mark synchronously on entry (the
   * core's `resumeInterrupted` does), or the gate would re-arm on the
   * next render.
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
  isHost,
  isNarratedPhase,
  isFocused,
  revision,
  readWasAudioInterrupted,
  resume,
  onResumed,
}: RoomAudioResumeOptions): RoomAudioResume {
  const [isDue, setIsDue] = useState(false);

  useEffect(() => {
    if (!isFocused || !isHost || !isNarratedPhase) return;
    if (!readWasAudioInterrupted()) return;
    setAlertBlocked(true);
    setIsDue(true);
  }, [isFocused, isHost, isNarratedPhase, readWasAudioInterrupted, revision]);

  const continueGame = useCallback(() => {
    setAlertBlocked(false);
    setIsDue(false);
    onResumed?.();
    void resume();
  }, [onResumed, resume]);

  return { isDue: isFocused && isDue, continueGame };
}
