/** Translate existing Werewolf handler results into the platform decision contract. */

import {
  type CommandContext,
  commit,
  commitDomainRejection,
  type Decision,
  reject,
} from '../../../platform/engine';
import type { WerewolfEffect } from '../effects/types';
import type { HandlerResult, SideEffect } from './handlers/types';
import { runInlineProgression } from './inlineProgression';
import type { AudioEffect, GameState } from './protocol/types';
import { gameReducer } from './reducer/gameReducer';
import type { StateAction } from './reducer/types';

interface HandlerDecisionOptions {
  readonly progressAfterSuccess?: boolean;
}

export function translateHandlerSideEffects(
  sideEffects: readonly SideEffect[] | undefined,
): StateAction[] {
  const audioEffects: AudioEffect[] = [];

  for (const sideEffect of sideEffects ?? []) {
    switch (sideEffect.type) {
      case 'BROADCAST_STATE':
      case 'SAVE_STATE':
        break;
      case 'PLAY_AUDIO':
        audioEffects.push(
          sideEffect.isEndAudio === undefined
            ? { audioKey: sideEffect.audioKey }
            : { audioKey: sideEffect.audioKey, isEndAudio: sideEffect.isEndAudio },
        );
        break;
      case 'SEND_MESSAGE':
        throw new Error('[FAIL-FAST] SEND_MESSAGE is not a Werewolf domain effect');
      default: {
        const exhaustive: never = sideEffect;
        throw new Error(`Unhandled Werewolf handler side effect: ${String(exhaustive)}`);
      }
    }
  }

  if (audioEffects.length === 0) return [];
  return [
    { type: 'SET_PENDING_AUDIO_EFFECTS', payload: { effects: audioEffects } },
    { type: 'SET_AUDIO_PLAYING', payload: { isPlaying: true } },
  ];
}

export function handlerResultToDecision(
  state: GameState,
  result: HandlerResult,
  context: CommandContext,
  options: HandlerDecisionOptions = {},
): Decision<StateAction, WerewolfEffect> {
  if (result.kind === 'error') {
    return reject(result.reason);
  }

  const events: StateAction[] = [
    ...result.actions,
    ...translateHandlerSideEffects(result.sideEffects),
  ];

  if (result.kind === 'rejection') {
    return commitDomainRejection<StateAction, WerewolfEffect>(result.reason, {
      events,
      broadcast: events.length === 0 ? 'none' : 'state',
    });
  }

  if (options.progressAfterSuccess) {
    let stateAfterHandler = state;
    for (const event of events) {
      stateAfterHandler = gameReducer(stateAfterHandler, event);
    }
    events.push(...runInlineProgression(stateAfterHandler, state.hostUserId, context).actions);
  }

  return commit<StateAction, WerewolfEffect>({
    events,
    broadcast: events.length === 0 ? 'none' : 'state',
    ...(result.reason === undefined ? {} : { reason: result.reason }),
  });
}
