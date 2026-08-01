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
