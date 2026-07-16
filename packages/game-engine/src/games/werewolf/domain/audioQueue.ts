/** Authoritative audio-queue state actions shared by command and progression handlers. */

import type { AudioEffect } from './protocol/types';
import type {
  SetAudioPlayingAction,
  SetPendingAudioEffectsAction,
  StateAction,
} from './reducer/types';

export type AudioQueueAction = SetPendingAudioEffectsAction | SetAudioPlayingAction;

/** Queue one non-empty playback batch and close the progression gate until Host acknowledgement. */
export function createAudioQueueActions(
  effects: readonly AudioEffect[],
): readonly [SetPendingAudioEffectsAction, SetAudioPlayingAction] {
  if (effects.length === 0) {
    throw new Error('[FAIL-FAST] Audio queue requires at least one effect');
  }
  return [
    { type: 'SET_PENDING_AUDIO_EFFECTS', payload: { effects: [...effects] } },
    { type: 'SET_AUDIO_PLAYING', payload: { isPlaying: true } },
  ];
}

export function isAudioQueueAction(action: StateAction): action is AudioQueueAction {
  return action.type === 'SET_PENDING_AUDIO_EFFECTS' || action.type === 'SET_AUDIO_PLAYING';
}
