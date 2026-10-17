/**
 * Contract tests for the shared audio-queue state machine.
 *
 * Pins the four invariants every game with night narration relies on:
 * empty batches fail fast, queueing replaces the pending batch and
 * closes the gate, ack clears the queue and reopens the gate, and ack
 * on an idle queue is an idempotent no-op (`null`, no state write).
 */

import { describe, expect, it } from 'vitest';

import {
  acknowledgeAudioQueue,
  type AudioQueueSlice,
  isAudioGateOpen,
  queueAudioBatch,
} from '../audioQueue';

const IDLE: AudioQueueSlice = { pendingAudioEffects: [], isAudioPlaying: false };

describe('audio queue contract', () => {
  it('fails fast on an empty batch', () => {
    expect(() => queueAudioBatch([])).toThrow(
      '[FAIL-FAST] Audio queue requires at least one effect',
    );
  });

  it('replaces the pending batch and closes the gate', () => {
    const first = queueAudioBatch([{ audioKey: 'night' }, { audioKey: 'evil_reveal' }]);
    expect(first).toEqual({
      pendingAudioEffects: [{ audioKey: 'night' }, { audioKey: 'evil_reveal' }],
      isAudioPlaying: true,
    });
    expect(isAudioGateOpen(first)).toBe(false);

    const replaced = queueAudioBatch([{ audioKey: 'night_end', isEndAudio: true }]);
    expect(replaced.pendingAudioEffects).toEqual([{ audioKey: 'night_end', isEndAudio: true }]);
    expect(replaced.isAudioPlaying).toBe(true);
  });

  it('copies the batch so later caller mutations cannot leak into the queue', () => {
    const batch = [{ audioKey: 'night' }];
    const queued = queueAudioBatch(batch);
    batch.push({ audioKey: 'evil_reveal' });
    expect(queued.pendingAudioEffects).toEqual([{ audioKey: 'night' }]);
  });

  it('ack clears the queue and reopens the gate', () => {
    const cleared = acknowledgeAudioQueue(queueAudioBatch([{ audioKey: 'night' }]));
    expect(cleared).toEqual({ pendingAudioEffects: [], isAudioPlaying: false });
    if (cleared === null) throw new Error('expected a cleared slice');
    expect(isAudioGateOpen(cleared)).toBe(true);
  });

  it('ack clears a non-empty queue even when playback is not marked running', () => {
    const orphaned: AudioQueueSlice = {
      pendingAudioEffects: [{ audioKey: 'night' }],
      isAudioPlaying: false,
    };
    expect(acknowledgeAudioQueue(orphaned)).toEqual({
      pendingAudioEffects: [],
      isAudioPlaying: false,
    });
  });

  it('ack on an idle queue is an idempotent no-op', () => {
    expect(acknowledgeAudioQueue(IDLE)).toBeNull();
    const cleared = acknowledgeAudioQueue(queueAudioBatch([{ audioKey: 'night' }]));
    if (cleared === null) throw new Error('expected a cleared slice');
    expect(acknowledgeAudioQueue(cleared)).toBeNull();
  });

  it('gate is open exactly when no playback is running', () => {
    expect(isAudioGateOpen(IDLE)).toBe(true);
    expect(isAudioGateOpen({ pendingAudioEffects: [], isAudioPlaying: true })).toBe(false);
  });
});
