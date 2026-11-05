/**
 * Phase Deadline Protocol — werewolf scenario (E-2).
 *
 * Werewolf's registered assembly: system only (D3, 2026-11-05 —
 * the public expire command was deleted). There is no public expire
 * command at all; the scheduled `werewolf.settle.due` effect is the
 * sole expiry channel and dispatches the internal settleExpired
 * command on the system channel. Neither command carries a
 * revision; correctness rides on the worker's pinned-arming
 * staleness gate. The session below is the wolf-vote settle
 * countdown: every wolf has voted and the step deadline is armed,
 * so expiry advances the night step. Same-named scenario files
 * live in each switched game's __tests__.
 */

import type { CommandContext } from '../../../platform/engine';
import { applyDecision } from '../../../platform/engine/__tests__/engineSession';
import {
  REASON_CONTROLLED_SEAT_NOT_ALLOWED,
  REASON_NOT_HOST,
} from '../../../platform/protocol/reasons';
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
    hasSettleCommand: true,
    stalePolicy: 'none',
    staleReason: null,
    dispatchAdvances: true,
  },
});

/**
 * Host self-rescue (D3 follow-up): `werewolf.phase.retrySettle`
 * re-drives the current phase's settle through the same guard
 * sequence and dispatch as the scheduled delivery. It is not an
 * expire send — the host gate runs first, and the guard still
 * rejects before the deadline, for non-hosts, and for a host acting
 * through a takeover seat.
 */
describe('werewolf.phase.retrySettle (host self-rescue)', () => {
  let state: GameState;
  let commandNumber = 0;
  const userContext = (
    userId: string,
    controlledSeat: number | null,
    nowMs: number,
  ): CommandContext => ({
    actor: { kind: 'user', userId },
    controlledSeat,
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
  const retry = (userId: string, controlledSeat: number | null, nowMs: number) =>
    attempt({ type: 'werewolf.phase.retrySettle' }, userContext(userId, controlledSeat, nowMs));
  const hasAdvanced = () =>
    state.nightStep?.kind !== 'inStep' || state.nightStep.stepId !== 'wolfKill';

  beforeEach(() => {
    state = armedWolfVoteState();
    commandNumber = 0;
  });

  it('rejects the host before the deadline', () => {
    expect(retry('host', null, WOLF_VOTE_DEADLINE_AT - 1)).toEqual({
      kind: 'reject',
      reason: REASON_DEADLINE_NOT_REACHED,
    });
    expect(hasAdvanced()).toBe(false);
  });

  it('rejects a non-host after the deadline', () => {
    expect(retry('user-1', null, WOLF_VOTE_DEADLINE_AT)).toEqual({
      kind: 'reject',
      reason: REASON_NOT_HOST,
    });
    expect(hasAdvanced()).toBe(false);
  });

  it('rejects a host acting through a takeover seat', () => {
    expect(retry('host', 0, WOLF_VOTE_DEADLINE_AT)).toEqual({
      kind: 'reject',
      reason: REASON_CONTROLLED_SEAT_NOT_ALLOWED,
    });
    expect(hasAdvanced()).toBe(false);
  });

  it('settles the phase for the host after the deadline', () => {
    const decision = retry('host', null, WOLF_VOTE_DEADLINE_AT);
    expect(decision.kind).toBe('commit');
    expect(hasAdvanced()).toBe(true);
  });

  it('is a no-op once the phase has advanced', () => {
    expect(retry('host', null, WOLF_VOTE_DEADLINE_AT).kind).toBe('commit');
    expect(hasAdvanced()).toBe(true);
    const second = retry('host', null, WOLF_VOTE_DEADLINE_AT + 1_000);
    expect(second.kind).toBe('reject');
    expect(hasAdvanced()).toBe(true);
  });
});
