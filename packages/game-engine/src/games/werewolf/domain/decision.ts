/** Translate existing Werewolf handler results into the platform decision contract. */

import {
  type CommandContext,
  commit,
  commitDomainRejection,
  type Decision,
  reject,
} from '../../../platform/engine';
import type { WerewolfEffect } from '../effects/types';
import type { HandlerResult } from './handlers/types';
import { runInlineProgression } from './inlineProgression';
import type { GameState } from './protocol/types';
import { gameReducer } from './reducer/gameReducer';
import type { StateAction } from './reducer/types';

interface HandlerDecisionOptions {
  readonly progressAfterSuccess?: boolean;
}

/**
 * The commit the platform skeletons expect, in werewolf's decision
 * form — the same shape handlerResultToDecision produces for a
 * handler success (actions as events, empty means no broadcast).
 */
export function commitActions(
  events: readonly StateAction[],
): Decision<StateAction, WerewolfEffect> {
  return commit<StateAction, WerewolfEffect>({ events });
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

  const events: StateAction[] = [...result.actions];

  if (result.kind === 'rejection') {
    return commitDomainRejection<StateAction, WerewolfEffect>(result.reason, {
      events,
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
    ...(result.reason === undefined ? {} : { reason: result.reason }),
  });
}
