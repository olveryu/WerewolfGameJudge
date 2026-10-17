/**
 * Werewolf audio-queue StateAction adapter.
 *
 * The queue discipline itself lives in the shared platform machine
 * (`platform/audio`): batch validation, replace semantics and the ack
 * transition exist exactly once. This module only translates the
 * machine's state slice into Werewolf StateAction values for the queue
 * entry points (command handlers and inline progression), and
 * classifies audio actions when progression composes a batch.
 */

import { type AudioEffect, queueAudioBatch } from '../../../platform/audio';
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
  const slice = queueAudioBatch(effects);
  return [
    { type: 'SET_PENDING_AUDIO_EFFECTS', payload: { effects: [...slice.pendingAudioEffects] } },
    { type: 'SET_AUDIO_PLAYING', payload: { isPlaying: slice.isAudioPlaying } },
  ];
}

export function isAudioQueueAction(action: StateAction): action is AudioQueueAction {
  return action.type === 'SET_PENDING_AUDIO_EFFECTS' || action.type === 'SET_AUDIO_PLAYING';
}
