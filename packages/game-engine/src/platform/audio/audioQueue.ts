/**
 * Audio Queue — shared authoritative audio-queue state machine.
 *
 * One implementation of the platform audio discipline, moved from the
 * Werewolf domain (`games/werewolf/domain/audioQueue.ts`) so every game
 * with night narration runs the same machine instead of a per-game copy:
 *
 * - Queue: a non-empty batch replaces the pending queue wholesale and
 *   marks playback as running (`isAudioPlaying: true`), which closes the
 *   progression gate. An empty batch is a programming error (fail-fast).
 * - Acknowledge: the Host device acks after playback. Ack on an idle
 *   queue (not playing, nothing pending) is an idempotent no-op and
 *   returns `null` so adapters can skip their state write entirely;
 *   any other ack clears the queue and reopens the gate.
 * - Gate: progression is blocked while playback is running; the gate
 *   predicate reads the same slice the transitions write.
 *
 * Games keep only their plumbing: Werewolf adapts the slice into
 * StateAction values, Avalon into domain events. Neither re-implements
 * the transitions.
 */

/**
 * Audio effect descriptor.
 *
 * Produced by server-side progression, written to the pending audio
 * queue of the game state. The Host device consumes the queue in order,
 * then submits the game's `<game>.audio.ack` command. Non-Host devices
 * ignore the queue.
 */
export interface AudioEffect {
  /** Audio resource key (role ID / 'night' / 'night_end') */
  readonly audioKey: string;
  /** Whether this is end audio (true -> audio_end directory) */
  readonly isEndAudio?: boolean;
}

/**
 * The audio-queue slice of a game state: the only fields the shared
 * transitions read and write. A queue is always present; an empty
 * array means nothing is pending.
 */
export interface AudioQueueSlice {
  readonly pendingAudioEffects: readonly AudioEffect[];
  readonly isAudioPlaying: boolean;
}

/**
 * Queues one playback batch: replaces any pending batch and closes the
 * progression gate until the Host acknowledges playback.
 *
 * @throws Error with `[FAIL-FAST]` when the batch is empty.
 */
export function queueAudioBatch(effects: readonly AudioEffect[]): AudioQueueSlice {
  if (effects.length === 0) {
    throw new Error('[FAIL-FAST] Audio queue requires at least one effect');
  }
  return { pendingAudioEffects: [...effects], isAudioPlaying: true };
}

/**
 * Acknowledges a played batch. Returns the cleared slice, or `null`
 * when the queue is already idle (not playing and nothing pending) so
 * the ack stays an idempotent no-op with no state write.
 */
export function acknowledgeAudioQueue(slice: AudioQueueSlice): AudioQueueSlice | null {
  if (!slice.isAudioPlaying && slice.pendingAudioEffects.length === 0) {
    return null;
  }
  return { pendingAudioEffects: [], isAudioPlaying: false };
}

/** The progression gate is open only while no playback is running. */
export function isAudioGateOpen(slice: AudioQueueSlice): boolean {
  return !slice.isAudioPlaying;
}
