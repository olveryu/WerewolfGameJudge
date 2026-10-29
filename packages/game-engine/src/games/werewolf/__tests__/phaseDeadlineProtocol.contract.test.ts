/**
 * Phase Deadline Protocol — werewolf scenario (E-2).
 *
 * Werewolf's registered assembly: dual channel — the public expire
 * command travels on the uncontrolled-user channel (any foreground
 * client may accelerate the settlement), while the internal
 * settleExpired command, dispatched by the scheduled
 * `werewolf.settle.due` effect, travels on the system channel.
 * Neither command carries a revision; correctness for the internal
 * channel rides on the worker's pinned-arming staleness gate. The
 * session below is the wolf-vote settle countdown: every wolf has
 * voted and the step deadline is armed, so expiry advances the
 * night step. Same-named scenario files live in each switched
 * game's __tests__.
 */

import type { CommandContext } from '../../../platform/engine';
import { applyDecision } from '../../../platform/engine/__tests__/engineSession';
import {
  describePhaseDeadlineProtocol,
  type PhaseDeadlineSession,
} from '../../../platform/room/__tests__/phaseDeadlineScenarios';
import type { WerewolfCommand } from '../commands/types';
import { GameStatus, type GameTemplate } from '../domain/models';
import { REASON_DEADLINE_NOT_REACHED } from '../domain/phaseExpiry';
import type { GameState } from '../domain/protocol/types';
import { buildInitialGameState } from '../domain/state/buildInitialState';
import { werewolfEngine } from '../engine';
import { parseWerewolfState } from '../state/parseState';

const TEMPLATE: GameTemplate = {
  name: 'phase-deadline',
  numberOfPlayers: 4,
  roles: ['wolf', 'seer', 'hunter', 'villager'],
};

const WOLF_VOTE_DEADLINE_AT = 6_000;

/** Ongoing wolfKill step, the only wolf has voted, the settle countdown is armed. */
function armedWolfVoteState(): GameState {
  return {
    ...buildInitialGameState('1234', 'host', TEMPLATE),
    status: GameStatus.Ongoing,
    players: {
      0: { seat: 0, role: 'wolf' },
      1: { seat: 1, role: 'seer' },
      2: { seat: 2, role: 'hunter' },
      3: { seat: 3, role: 'villager' },
    },
    roster: {
      0: { seat: 0, userId: 'host', profile: { displayName: 'Host' } },
      1: { seat: 1, userId: 'user-1', profile: { displayName: 'User 1' } },
      2: { seat: 2, kind: 'bot' },
      3: { seat: 3, userId: 'user-3', profile: { displayName: 'User 3' } },
    },
    roleViewedSeats: [0, 1, 2, 3],
    nightStep: { kind: 'inStep', stepId: 'wolfKill', stepDeadline: WOLF_VOTE_DEADLINE_AT },
    currentNightResults: { wolfVotesBySeat: { '0': 3 } },
    actions: [{ schemaId: 'wolfKill', actorSeat: 0, targetSeat: 3, timestamp: 1_000 }],
  };
}

function makeSession(): PhaseDeadlineSession {
  let state = armedWolfVoteState();
  const armedStepId = 'wolfKill';
  let commandNumber = 0;
  const userContext = (controlledSeat: number | null, nowMs: number): CommandContext => ({
    actor: { kind: 'user', userId: 'user-1' },
    controlledSeat,
    nowMs,
    commandId: `command:${commandNumber++}`,
    randomSeed: 'phase-deadline',
  });
  const systemContext = (nowMs: number): CommandContext => ({
    actor: { kind: 'system', effectId: 'settle' },
    controlledSeat: null,
    nowMs,
    commandId: `command:${commandNumber++}`,
    randomSeed: 'phase-deadline',
  });
  const attempt = (command: WerewolfCommand, context: CommandContext) => {
    const decision = werewolfEngine.decide(state, command, context);
    if (decision.kind === 'commit') {
      state = applyDecision(werewolfEngine, state, decision, parseWerewolfState);
    }
    return decision;
  };

  return {
    expireAsUser: (nowMs) => attempt({ type: 'werewolf.phase.expire' }, userContext(null, nowMs)),
    expireAsControlledUser: (nowMs) =>
      attempt({ type: 'werewolf.phase.expire' }, userContext(2, nowMs)),
    expirePublicAsSystem: (nowMs) =>
      attempt({ type: 'werewolf.phase.expire' }, systemContext(nowMs)),
    expireSettleAsSystem: (nowMs) =>
      attempt({ type: 'werewolf.phase.settleExpired' }, systemContext(nowMs)),
    expireSettleAsUser: (nowMs) =>
      attempt({ type: 'werewolf.phase.settleExpired' }, userContext(null, nowMs)),
    expireWithStaleRevision: () => {
      throw new Error('Werewolf expire commands carry no revision');
    },
    deadlineAt: () => {
      if (state.nightStep?.kind !== 'inStep' || state.nightStep.stepDeadline === undefined) {
        throw new Error('Expected an armed wolf-vote countdown');
      }
      return state.nightStep.stepDeadline;
    },
    hasAdvanced: () => state.nightStep?.kind !== 'inStep' || state.nightStep.stepId !== armedStepId,
  };
}

describePhaseDeadlineProtocol({
  game: 'werewolf',
  makeSession,
  expectations: {
    notExpiredReason: REASON_DEADLINE_NOT_REACHED,
    publicChannel: 'uncontrolledUser',
    hasSettleCommand: true,
    stalePolicy: 'none',
    staleReason: null,
    dispatchAdvances: true,
  },
});
