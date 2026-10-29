/**
 * Contract tests for the shared audio-queue state machine.
 *
 * Pins the invariants every game with night narration relies on: empty
 * batches fail fast, queueing replaces the pending batch, assigns the
 * next batch id and closes the gate, acking the current batch clears the
 * queue and reopens the gate, acking an earlier batch is an idempotent
 * no-op, and acking an id that was never queued is reported as unknown.
 */

import { describe, expect, it } from 'vitest';

import {
  acknowledgeAudioQueue,
  type AudioQueueSlice,
  isAudioGateOpen,
  queueAudioBatch,
} from '../audioQueue';

const IDLE: AudioQueueSlice = { pendingAudioEffects: [], isAudioPlaying: false, audioBatchId: 0 };

describe('audio queue contract', () => {
  it('fails fast on an empty batch', () => {
    expect(() => queueAudioBatch(IDLE, [])).toThrow(
      '[FAIL-FAST] Audio queue requires at least one effect',
    );
  });

  it('replaces the pending batch, assigns the next batch id and closes the gate', () => {
    const first = queueAudioBatch(IDLE, [{ audioKey: 'night' }, { audioKey: 'evil_reveal' }]);
    expect(first).toEqual({
      pendingAudioEffects: [{ audioKey: 'night' }, { audioKey: 'evil_reveal' }],
      isAudioPlaying: true,
      audioBatchId: 1,
    });
    expect(isAudioGateOpen(first)).toBe(false);

    const replaced = queueAudioBatch(first, [{ audioKey: 'night_end', isEndAudio: true }]);
    expect(replaced.pendingAudioEffects).toEqual([{ audioKey: 'night_end', isEndAudio: true }]);
    expect(replaced.isAudioPlaying).toBe(true);
    expect(replaced.audioBatchId).toBe(2);
  });

  it('copies the batch so later caller mutations cannot leak into the queue', () => {
    const batch = [{ audioKey: 'night' }];
    const queued = queueAudioBatch(IDLE, batch);
    batch.push({ audioKey: 'evil_reveal' });
    expect(queued.pendingAudioEffects).toEqual([{ audioKey: 'night' }]);
  });

  it('acking the current batch clears the queue, keeps the id and reopens the gate', () => {
    const queued = queueAudioBatch(IDLE, [{ audioKey: 'night' }]);
    const ack = acknowledgeAudioQueue(queued, 1);
    expect(ack).toEqual({
      kind: 'cleared',
      slice: { pendingAudioEffects: [], isAudioPlaying: false, audioBatchId: 1 },
    });
    if (ack.kind !== 'cleared') throw new Error('expected a cleared slice');
    expect(isAudioGateOpen(ack.slice)).toBe(true);
  });

  it('acking the current batch clears a non-empty queue even when playback is not marked running', () => {
    const orphaned: AudioQueueSlice = {
      pendingAudioEffects: [{ audioKey: 'night' }],
      isAudioPlaying: false,
      audioBatchId: 3,
    };
    expect(acknowledgeAudioQueue(orphaned, 3)).toEqual({
      kind: 'cleared',
      slice: { pendingAudioEffects: [], isAudioPlaying: false, audioBatchId: 3 },
    });
  });

  it('acking an earlier batch (replayed or coalesced ack) is an idempotent no-op', () => {
    const first = queueAudioBatch(IDLE, [{ audioKey: 'night' }]);
    const second = queueAudioBatch(first, [{ audioKey: 'wolf' }]);
    expect(acknowledgeAudioQueue(second, 1)).toEqual({ kind: 'alreadyAcknowledged' });
    expect(second.isAudioPlaying).toBe(true);

    const ack = acknowledgeAudioQueue(second, 2);
    if (ack.kind !== 'cleared') throw new Error('expected a cleared slice');
    expect(acknowledgeAudioQueue(ack.slice, 2)).toEqual({ kind: 'alreadyAcknowledged' });
    expect(acknowledgeAudioQueue(IDLE, 0)).toEqual({ kind: 'alreadyAcknowledged' });
  });

  it('acking a batch that was never queued is unknown', () => {
    expect(acknowledgeAudioQueue(IDLE, 1)).toEqual({ kind: 'unknownBatch' });
    const queued = queueAudioBatch(IDLE, [{ audioKey: 'night' }]);
    expect(acknowledgeAudioQueue(queued, 2)).toEqual({ kind: 'unknownBatch' });
  });

  it('gate is open exactly when no playback is running', () => {
    expect(isAudioGateOpen(IDLE)).toBe(true);
    expect(
      isAudioGateOpen({ pendingAudioEffects: [], isAudioPlaying: true, audioBatchId: 1 }),
    ).toBe(false);
  });
});
