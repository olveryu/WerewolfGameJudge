/**
 * Audio Queue — shared authoritative audio-queue state machine.
 *
 * One implementation of the platform audio discipline, moved from the
 * Werewolf domain (`games/werewolf/domain/audioQueue.ts`) so every game
 * with night narration runs the same machine instead of a per-game copy:
 *
 * - Queue: a non-empty batch replaces the pending queue wholesale, takes
 *   the next batch id and marks playback as running (`isAudioPlaying:
 *   true`), which closes the progression gate. An empty batch is a
 *   programming error (fail-fast).
 * - Acknowledge: the Host device acks the batch id it played. The id is
 *   what makes acks safe to replay and to coalesce: identical ack
 *   payloads mean the same batch, never two batches in a row. An ack for
 *   the current batch clears the queue and reopens the gate; an ack for
 *   an earlier batch (already cleared or replaced) is an idempotent
 *   no-op; an ack for a batch that was never queued is a client bug the
 *   game rejects.
 * - Gate: progression is blocked while playback is running; the gate
 *   predicate reads the same slice the transitions write.
 *
 * Games keep only their plumbing: Werewolf adapts the slice into
 * StateAction values, Avalon into domain events. Neither re-implements
 * the transitions.
 */

import { failDecode, parseInteger } from '../protocol/runtimeDecoder';

/**
 * Reserved dawn narration key shared by every night game. The host
 * client's shared audio core stops BGM right before playing this effect
 * so music never overlaps the dawn voice; engines must queue the end of
 * night with this key rather than a game-local string.
 */
export const NIGHT_END_AUDIO_KEY = 'night_end';

/**
 * Audio effect descriptor.
 *
 * Produced by server-side progression, written to the pending audio
 * queue of the game state. The Host device consumes the queue in order,
 * then submits the game's `<game>.audio.ack` command. Non-Host devices
 * ignore the queue.
 */
export interface AudioEffect {
  /** Audio resource key (role ID / 'night' / NIGHT_END_AUDIO_KEY) */
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
  /** Id of the most recently queued batch; 0 before the first batch. Monotonic per game state. */
  readonly audioBatchId: number;
}

/** Outcome of acknowledging a batch; see `acknowledgeAudioQueue`. */
export type AudioAckResult =
  | { readonly kind: 'cleared'; readonly slice: AudioQueueSlice }
  /** The batch was already cleared or replaced: nothing to write. */
  | { readonly kind: 'alreadyAcknowledged' }
  /** The id was never queued: the client is acknowledging a batch that does not exist. */
  | { readonly kind: 'unknownBatch' };

/**
 * Queues one playback batch: replaces any pending batch, assigns the next
 * batch id and closes the progression gate until the Host acknowledges it.
 *
 * @throws Error with `[FAIL-FAST]` when the batch is empty.
 */
export function queueAudioBatch(
  slice: Pick<AudioQueueSlice, 'audioBatchId'>,
  effects: readonly AudioEffect[],
): AudioQueueSlice {
  if (effects.length === 0) {
    throw new Error('[FAIL-FAST] Audio queue requires at least one effect');
  }
  return {
    pendingAudioEffects: [...effects],
    isAudioPlaying: true,
    audioBatchId: slice.audioBatchId + 1,
  };
}

/**
 * Acknowledges the batch `audioBatchId`. Only the current, still-playing
 * batch clears; older ids are idempotent no-ops (replayed or coalesced
 * acks); ids above the current one were never queued.
 */
export function acknowledgeAudioQueue(
  slice: AudioQueueSlice,
  audioBatchId: number,
): AudioAckResult {
  if (audioBatchId > slice.audioBatchId) return { kind: 'unknownBatch' };
  if (audioBatchId < slice.audioBatchId) return { kind: 'alreadyAcknowledged' };
  if (!slice.isAudioPlaying && slice.pendingAudioEffects.length === 0) {
    return { kind: 'alreadyAcknowledged' };
  }
  return {
    kind: 'cleared',
    slice: { pendingAudioEffects: [], isAudioPlaying: false, audioBatchId: slice.audioBatchId },
  };
}

/** The progression gate is open only while no playback is running. */
export function isAudioGateOpen(slice: AudioQueueSlice): boolean {
  return !slice.isAudioPlaying;
}

/** Decoder for a persisted or transported `audioBatchId`: a non-negative safe integer. */
export function parseAudioBatchId(value: unknown, path: string): number {
  const parsed = parseInteger(value, path);
  if (parsed < 0) return failDecode(path, 'a non-negative integer');
  return parsed;
}
