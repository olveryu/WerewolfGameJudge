/**
 * Audio playback gate guard — the one gate form every game with
 * narration audio runs before commands that must wait for playback.
 *
 * The platform owns the judgement: playback is locked exactly while
 * the audio slice reports `isAudioPlaying`. What a rejection looks
 * like stays with each game — the caller injects its own reason and
 * wraps the returned reason in its own rejection shape (Werewolf
 * `handlerError`, Avalon `reject`, a progression evaluator that
 * simply produces no events). The guard returns the injected reason
 * verbatim while locked, or `null` while the gate is open.
 *
 * The guard reads only `isAudioPlaying`: queue contents, phase, and
 * status are the caller's own gates, sequenced by the caller (the
 * same division as `isAudioGateOpen`, which remains the plain
 * boolean read for consumers that only need the fact).
 */

import type { AudioQueueSlice } from './audioQueue';

/**
 * Returns `reason` while narration playback is running, or `null`
 * when the audio gate is open and the caller may proceed.
 */
export function guardAudioPlayback(slice: AudioQueueSlice, reason: string): string | null {
  return slice.isAudioPlaying ? reason : null;
}
