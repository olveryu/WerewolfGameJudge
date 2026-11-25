import type { WerewolfEffect } from '../effects/types';
import {
  closeSheriffVotingRound,
  finishSheriffResult,
  startSheriffResult,
} from './handlers/sheriffElectionHandler';
import type { HandlerExecutionContext } from './handlers/types';
import { GameStatus } from './models';
import { runWerewolfNightProgression } from './nightProgression';
import type { GameState } from './protocol/types';
import { gameReducer } from './reducer/gameReducer';
import type { StateAction } from './reducer/types';

export interface InlineProgressionResult {
  readonly actions: StateAction[];
  readonly effects: WerewolfEffect[];
  readonly finalState: GameState;
  readonly stepsAdvanced: number;
}

function evaluateSheriffElectionExpiry(
  state: GameState,
  nowMs: number,
): {
  readonly action: StateAction;
  readonly effects: WerewolfEffect[];
} | null {
  const election = state.sheriffElection;
  if (election === undefined) return null;
  if (
    election.phase !== 'firstVote' &&
    election.phase !== 'runoffVote' &&
    election.phase !== 'result'
  ) {
    return null;
  }
  if (state.isAudioPlaying && election.phase !== 'result') return null;
  if (election.deadline === undefined || nowMs < election.deadline) return null;
  if (election.phase === 'result') {
    return { action: finishSheriffResult(election), effects: [] };
  }
  const result = startSheriffResult(state, closeSheriffVotingRound(state, election), nowMs);
  return { action: result.action, effects: [result.effect] };
}

/** Progress a Werewolf night or expire the active sheriff-election deadline. */
export function runInlineProgression(
  state: GameState,
  _hostUserId: string,
  execution: HandlerExecutionContext,
): InlineProgressionResult {
  if (state.status === GameStatus.Ongoing) {
    if (state.nightState === null) {
      throw new Error('[FAIL-FAST] Ongoing Werewolf game has no step-driven night state');
    }
    return runWerewolfNightProgression(state, execution);
  }
  if (state.status !== GameStatus.Day) {
    return { actions: [], effects: [], finalState: state, stepsAdvanced: 0 };
  }
  const expiry = evaluateSheriffElectionExpiry(state, execution.nowMs);
  if (expiry === null) {
    return { actions: [], effects: [], finalState: state, stepsAdvanced: 0 };
  }
  return {
    actions: [expiry.action],
    effects: expiry.effects,
    finalState: gameReducer(state, expiry.action),
    stepsAdvanced: 1,
  };
}
