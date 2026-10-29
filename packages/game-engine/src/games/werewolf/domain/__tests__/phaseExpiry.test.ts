/**
 * Werewolf phase expiry contract: an armed deadline and its scheduled
 * settle are one decision.
 *
 * Invariant (docs/game-client-convergence-design.md §6.2): a decision
 * whose events write a deadline (`SET_STEP_DEADLINE` /
 * `SET_SHERIFF_ELECTION_DEADLINE`) carries exactly one
 * `werewolf.settle.due` pinned to that deadline; a decision that
 * writes no deadline carries none. Pinned at all three arming sites —
 * the wolf-vote settle countdown (actionHandler), the sheriff-vote
 * settle countdown (sheriffElectionHandler) and the vacant bottom-card
 * auto-skip delay (inlineProgression) — and the expiry channels read
 * the same carriers back through `readArmedDeadline`.
 */

import type { CommandContext, Decision } from '../../../../platform/engine';
import type { WerewolfCommand } from '../../commands/types';
import type { WerewolfEffect, WerewolfSettleDueEffect } from '../../effects/types';
import { werewolfEngine } from '../../engine';
import { GameStatus, type GameTemplate } from '../models';
import {
  readArmedDeadline,
  REASON_DEADLINE_NOT_REACHED,
  REASON_PHASE_NOT_EXPIRABLE,
} from '../phaseExpiry';
import type { GameState } from '../protocol/types';
import type { StateAction } from '../reducer/types';
import { buildInitialGameState } from '../state/buildInitialState';

const TEMPLATE: GameTemplate = {
  name: 'phase-expiry',
  numberOfPlayers: 5,
  roles: ['wolf', 'wolf', 'seer', 'hunter', 'villager'],
};

const NOW_MS = 1_000;

function createState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...buildInitialGameState('1234', 'host', TEMPLATE),
    status: GameStatus.Ongoing,
    players: {
      0: { seat: 0, role: 'wolf' },
      1: { seat: 1, role: 'wolf' },
      2: { seat: 2, role: 'seer' },
      3: { seat: 3, role: 'hunter' },
      4: { seat: 4, role: 'villager' },
    },
    roster: {
      0: { seat: 0, userId: 'host', profile: { displayName: 'Host' } },
      1: { seat: 1, userId: 'user-1', profile: { displayName: 'User 1' } },
      2: { seat: 2, userId: 'user-2', profile: { displayName: 'User 2' } },
      3: { seat: 3, userId: 'user-3', profile: { displayName: 'User 3' } },
      4: { seat: 4, userId: 'user-4', profile: { displayName: 'User 4' } },
    },
    roleViewedSeats: [0, 1, 2, 3, 4],
    nightStep: { kind: 'inStep', stepId: 'wolfKill' },
    currentNightResults: {},
    ...overrides,
  };
}

function userContext(userId: string, nowMs = NOW_MS): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat: null,
    nowMs,
    commandId: `command:${userId}:${nowMs}`,
    randomSeed: 'phase-expiry',
  };
}

function systemContext(nowMs: number): CommandContext {
  return {
    actor: { kind: 'system', effectId: 'settle' },
    controlledSeat: null,
    nowMs,
    commandId: `settle:${nowMs}`,
    randomSeed: 'phase-expiry',
  };
}

function commitOf(decision: Decision<StateAction, WerewolfEffect>) {
  if (decision.kind !== 'commit') {
    throw new Error(`Expected commit, received reject: ${decision.reason}`);
  }
  return decision;
}

function evolve(state: GameState, decision: Decision<StateAction, WerewolfEffect>): GameState {
  return commitOf(decision).events.reduce(werewolfEngine.evolve, state);
}

/** The deadline the decision's events write, if any (null when they clear or leave it alone). */
function writtenDeadline(events: readonly StateAction[]): number | null {
  for (const event of events) {
    if (event.type === 'SET_STEP_DEADLINE' || event.type === 'SET_SHERIFF_ELECTION_DEADLINE') {
      return event.payload.deadline;
    }
  }
  return null;
}

function settleDueEffects(effects: readonly WerewolfEffect[]): WerewolfSettleDueEffect[] {
  return effects.filter(
    (effect): effect is WerewolfSettleDueEffect => effect.type === 'werewolf.settle.due',
  );
}

/** The §6.2 invariant, checked on one committed decision. */
function expectArmingInvariant(
  decision: Decision<StateAction, WerewolfEffect>,
  expected: { gameSequence: number; phase: string } | null,
): void {
  const committed = commitOf(decision);
  const deadline = writtenDeadline(committed.events);
  const settles = settleDueEffects(committed.effects);
  if (expected === null) {
    expect(deadline).toBeNull();
    expect(settles).toEqual([]);
    return;
  }
  expect(deadline).not.toBeNull();
  expect(settles).toEqual([
    {
      type: 'werewolf.settle.due',
      payload: { gameSequence: expected.gameSequence, phase: expected.phase, deadlineAt: deadline },
    },
  ]);
}

const wolfVote = (target: number): WerewolfCommand => ({
  type: 'werewolf.action.submit',
  input: { kind: 'target', target },
});

describe('wolf-vote settle countdown arming', () => {
  it('arms the deadline and its settle.due in the decision of the last wolf ballot', () => {
    const state = createState({ gameSequence: 3 });

    const firstBallot = werewolfEngine.decide(state, wolfVote(4), userContext('host'));
    expectArmingInvariant(firstBallot, null);
    const afterFirst = evolve(state, firstBallot);

    const lastBallot = werewolfEngine.decide(afterFirst, wolfVote(4), userContext('user-1'));
    expectArmingInvariant(lastBallot, { gameSequence: 3, phase: 'wolfKill' });
    const armed = evolve(afterFirst, lastBallot);
    expect(readArmedDeadline(armed)).toEqual({ phase: 'wolfKill', deadlineAt: NOW_MS + 5_000 });
  });

  it('re-pins a refreshed deadline when a wolf changes a completed vote', () => {
    let state = createState();
    state = evolve(state, werewolfEngine.decide(state, wolfVote(4), userContext('host')));
    state = evolve(state, werewolfEngine.decide(state, wolfVote(4), userContext('user-1')));

    const changed = werewolfEngine.decide(state, wolfVote(2), userContext('host', 2_000));
    expectArmingInvariant(changed, { gameSequence: 0, phase: 'wolfKill' });
    expect(writtenDeadline(commitOf(changed).events)).toBe(7_000);
  });
});

describe('sheriff-vote settle countdown arming', () => {
  const dayWithOpenFirstVote = (): GameState =>
    createState({
      status: GameStatus.Day,
      nightStep: null,
      gameSequence: 1,
      rules: { isSheriffElectionEnabled: true },
      sheriffElection: {
        phase: 'firstVote',
        registeredSeats: [0, 1],
        withdrawnSeats: [],
        completedRounds: [],
        candidateSeats: [0, 1],
        eligibleVoterSeats: [2, 3],
        ballots: {},
      },
    });

  it('arms the deadline and its settle.due in the decision of the last eligible ballot', () => {
    const state = dayWithOpenFirstVote();
    const vote = (userId: string, targetSeat: number, nowMs = NOW_MS) =>
      werewolfEngine.decide(
        state,
        { type: 'werewolf.sheriff.vote', targetSeat },
        userContext(userId, nowMs),
      );

    const first = vote('user-2', 0);
    expectArmingInvariant(first, null);
    const afterFirst = evolve(state, first);

    const last = werewolfEngine.decide(
      afterFirst,
      { type: 'werewolf.sheriff.vote', targetSeat: 1 },
      userContext('user-3'),
    );
    expectArmingInvariant(last, { gameSequence: 1, phase: 'firstVote' });
    const armed = evolve(afterFirst, last);
    expect(readArmedDeadline(armed)).toEqual({ phase: 'firstVote', deadlineAt: NOW_MS + 5_000 });
  });
});

describe('vacant bottom-card auto-skip arming', () => {
  it('pins the random auto-skip deadline the inline pass writes', () => {
    const template: GameTemplate = {
      name: 'bottom-card',
      numberOfPlayers: 4,
      roles: ['treasureMaster', 'wolf', 'seer', 'guard', 'wolf', 'witch', 'villager'],
    };
    const base = createState({
      ...buildInitialGameState('1234', 'host', template),
      status: GameStatus.Ongoing,
      gameSequence: 2,
      players: {
        0: { seat: 0, role: 'treasureMaster' },
        1: { seat: 1, role: 'wolf' },
        2: { seat: 2, role: 'seer' },
        3: { seat: 3, role: 'guard' },
      },
      roster: {
        0: { seat: 0, userId: 'host', profile: { displayName: 'Host' } },
        1: { seat: 1, userId: 'user-1', profile: { displayName: 'User 1' } },
        2: { seat: 2, userId: 'user-2', profile: { displayName: 'User 2' } },
        3: { seat: 3, userId: 'user-3', profile: { displayName: 'User 3' } },
      },
      roleViewedSeats: [0, 1, 2, 3],
      // Audio for the vacant witch step has been queued and is being played.
      nightStep: { kind: 'inStep', stepId: 'witchAction' },
      isAudioPlaying: true,
      audioBatchId: 1,
      pendingAudioEffects: [{ audioKey: 'witch' }],
      currentNightResults: { treasureMasterChosenCard: 'villager' },
      bottomCards: ['wolf', 'witch', 'villager'],
      treasureMasterSeat: 0,
    });

    const ack = werewolfEngine.decide(
      base,
      { type: 'werewolf.audio.ack', audioBatchId: 1 },
      userContext('host'),
    );
    expectArmingInvariant(ack, { gameSequence: 2, phase: 'witchAction' });
    const armed = evolve(base, ack);
    const deadline = readArmedDeadline(armed);
    expect(deadline?.phase).toBe('witchAction');
    expect(deadline?.deadlineAt).toBeGreaterThanOrEqual(NOW_MS + 5_000);
    expect(deadline?.deadlineAt).toBeLessThanOrEqual(NOW_MS + 10_000);
  });
});

describe('expiry channels', () => {
  const armedSheriffVote = (): GameState =>
    createState({
      status: GameStatus.Day,
      nightStep: null,
      rules: { isSheriffElectionEnabled: true },
      sheriffElection: {
        phase: 'firstVote',
        registeredSeats: [0, 1],
        withdrawnSeats: [],
        completedRounds: [],
        candidateSeats: [0, 1],
        eligibleVoterSeats: [2],
        ballots: { 2: 0 },
        deadline: 6_000,
      },
    });

  it('rejects a phase without a deadline carrier', () => {
    const seated = createState({ status: GameStatus.Seated, nightStep: null });
    expect(
      werewolfEngine.decide(seated, { type: 'werewolf.phase.expire' }, userContext('host')),
    ).toEqual({ kind: 'reject', reason: REASON_PHASE_NOT_EXPIRABLE });
    expect(readArmedDeadline(seated)).toBeNull();
  });

  it('rejects a carrier whose deadline is not armed', () => {
    const open = createState();
    expect(
      werewolfEngine.decide(open, { type: 'werewolf.phase.expire' }, userContext('host')),
    ).toEqual({ kind: 'reject', reason: REASON_DEADLINE_NOT_REACHED });
    expect(readArmedDeadline(open)).toBeNull();
  });

  it('closes the armed sheriff round at its deadline on either channel', () => {
    for (const context of [userContext('user-2', 6_000), systemContext(6_000)]) {
      const state = armedSheriffVote();
      const command: WerewolfCommand =
        context.actor.kind === 'system'
          ? { type: 'werewolf.phase.settleExpired' }
          : { type: 'werewolf.phase.expire' };
      const closed = evolve(state, werewolfEngine.decide(state, command, context));
      expect(closed.sheriffElection?.phase).not.toBe('firstVote');
      expect(readArmedDeadline(closed)).toBeNull();
    }
  });

  it('holds a reached sheriff deadline behind the audio gate without rejecting', () => {
    const audible: GameState = {
      ...armedSheriffVote(),
      isAudioPlaying: true,
      audioBatchId: 1,
      pendingAudioEffects: [{ audioKey: 'night_end' }],
    };
    const held = commitOf(
      werewolfEngine.decide(
        audible,
        { type: 'werewolf.phase.settleExpired' },
        systemContext(6_000),
      ),
    );
    expect(held.events).toEqual([]);
    expect(held.effects).toEqual([]);
  });
});
