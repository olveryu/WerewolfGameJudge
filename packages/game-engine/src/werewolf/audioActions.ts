/**
 * Werewolf audio side-effect adapter — converts PLAY_AUDIO effects into StateAction writes.
 */

import type { SideEffect } from '../protocol/common';
import type { AudioEffect } from './protocol/types';
import type { StateAction } from './reducer/types';

export function extractAudioActions(sideEffects: readonly SideEffect[] | undefined): StateAction[] {
  const audioEffects: AudioEffect[] = (sideEffects ?? [])
    .filter(
      (effect): effect is { type: 'PLAY_AUDIO'; audioKey: string; isEndAudio?: boolean } =>
        effect.type === 'PLAY_AUDIO',
    )
    .map((effect) => ({ audioKey: effect.audioKey, isEndAudio: effect.isEndAudio }));

  if (audioEffects.length === 0) return [];

  return [
    { type: 'SET_PENDING_AUDIO_EFFECTS', payload: { effects: audioEffects } },
    { type: 'SET_AUDIO_PLAYING', payload: { isPlaying: true } },
  ];
}
