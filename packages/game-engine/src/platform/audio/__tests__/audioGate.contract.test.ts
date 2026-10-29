/**
 * Contract tests for the shared audio playback gate guard.
 *
 * Pins the guard's whole contract: while playback is running the
 * guard returns the caller-injected reason verbatim (each game
 * passes its own reason vocabulary through untouched), while the
 * gate is open it returns null, and the verdict reads only
 * `isAudioPlaying` — pending queue contents never close the gate
 * on their own.
 */

import { describe, expect, it } from 'vitest';

import { guardAudioPlayback } from '../audioGate';
import type { AudioQueueSlice } from '../audioQueue';

const PLAYING: AudioQueueSlice = {
  pendingAudioEffects: [{ audioKey: 'night' }],
  isAudioPlaying: true,
  audioBatchId: 1,
};

const IDLE: AudioQueueSlice = { pendingAudioEffects: [], isAudioPlaying: false, audioBatchId: 0 };

describe('audio playback gate guard contract', () => {
  it('returns the injected reason verbatim while playback is running', () => {
    expect(guardAudioPlayback(PLAYING, 'forbidden_while_audio_playing')).toBe(
      'forbidden_while_audio_playing',
    );
    expect(guardAudioPlayback(PLAYING, 'avalon_audio_playing')).toBe('avalon_audio_playing');
  });

  it('returns null while the gate is open', () => {
    expect(guardAudioPlayback(IDLE, 'forbidden_while_audio_playing')).toBeNull();
  });

  it('reads only isAudioPlaying: a pending queue alone does not close the gate', () => {
    const queuedNotPlaying: AudioQueueSlice = {
      pendingAudioEffects: [{ audioKey: 'night' }],
      isAudioPlaying: false,
      audioBatchId: 1,
    };
    expect(guardAudioPlayback(queuedNotPlaying, 'forbidden_while_audio_playing')).toBeNull();
  });

  it('reads only isAudioPlaying: playback with an empty queue is still locked', () => {
    const playingNoQueue: AudioQueueSlice = {
      pendingAudioEffects: [],
      isAudioPlaying: true,
      audioBatchId: 1,
    };
    expect(guardAudioPlayback(playingNoQueue, 'forbidden_while_audio_playing')).toBe(
      'forbidden_while_audio_playing',
    );
  });
});
