/**
 * Werewolf audio-queue StateAction adapter.
 *
 * The queue discipline itself lives in the shared platform machine
 * (`platform/audio`): batch validation, replace semantics, batch ids and
 * the ack transition exist exactly once, applied by the reducer. This
 * module only names the queue action for the entry points (command
 * handlers and inline progression) and classifies it when progression
 * composes a batch.
 */

import type { AudioEffect } from '../../../platform/audio';
import type { SetPendingAudioEffectsAction, StateAction } from './reducer/types';

export type AudioQueueAction = SetPendingAudioEffectsAction;

/** Queue one playback batch; the reducer's shared transition validates it, closes the gate and assigns the id. */
export function createAudioQueueAction(
  effects: readonly AudioEffect[],
): SetPendingAudioEffectsAction {
  return { type: 'SET_PENDING_AUDIO_EFFECTS', payload: { effects: [...effects] } };
}

export function isAudioQueueAction(action: StateAction): action is AudioQueueAction {
  return action.type === 'SET_PENDING_AUDIO_EFFECTS';
}
