/** Canonical Fibking states for client tests (AU-46), and rounds played through the real engine. */

import type { FibCommand, FibState } from '@game-judge/game-engine/games/fibking/public';
import { fibEngine } from '@game-judge/game-engine/games/fibking/public';

import type { ReviewTestRounds } from './reviewTestRounds';

function withOverrides<S>(base: S, overrides: Partial<S>): S {
  return { ...base, ...overrides };
}

export function buildFibkingTestState(overrides: Partial<FibState> = {}): FibState {
  return withOverrides(
    fibEngine.createInitialState(
      { numberOfPlayers: 6 },
      { roomCode: 'ABCD', hostUserId: 'host-1', nowMs: 0, commandId: 'create' },
    ),
    overrides,
  );
}

/** Who sends a scripted command: the host, or the system's word-selection effect. */
export type FibkingTestActor = 'host' | 'system';

/** Applies one command as `actor`; a rejected command fails the test. */
export function dispatchFibkingTestCommand(
  state: FibState,
  command: FibCommand,
  actor: FibkingTestActor = 'host',
): FibState {
  const execution = { nowMs: 1, commandId: 'round-command', randomSeed: 'seed' };
  const decision = fibEngine.decide(
    state,
    command,
    actor === 'host'
      ? { ...execution, actor: { kind: 'user', userId: 'host' }, controlledSeat: null }
      : { ...execution, actor: { kind: 'system', effectId: 'selection' }, controlledSeat: null },
  );
  if (decision.kind === 'reject') {
    throw new Error(`[FAIL-FAST] ${command.type} rejected: ${decision.reason}`);
  }
  return fibEngine.normalize(decision.events.reduce(fibEngine.evolve, state));
}

/** The phases `playFibkingTestRound` stops at, in round order. */
export type FibkingTestStage = 'lobby' | 'preparing' | 'viewing' | 'ongoing' | 'ended';

/**
 * A four-seat round played through the real engine up to `stage`: the host
 * takes seat 0 and bots fill the rest; the roles are assigned, the word 山谷
 * is prepared and dealt, every seat views its role, and to end the round
 * the host reveals it.
 */
export function playFibkingTestRound(stage: FibkingTestStage): FibState {
  let state = fibEngine.createInitialState(
    { numberOfPlayers: 4 },
    { roomCode: '4321', hostUserId: 'host', nowMs: 0, commandId: 'create' },
  );
  state = dispatchFibkingTestCommand(state, {
    type: 'room.seat.take',
    seat: 0,
    profile: { displayName: '房主' },
  });
  state = dispatchFibkingTestCommand(state, { type: 'room.seat.fillBots' });
  if (stage === 'lobby') return state;

  state = dispatchFibkingTestCommand(state, { type: 'fibking.roles.assign' });
  if (stage === 'preparing') return state;
  if (state.phase !== 'preparing') {
    throw new Error(`[FAIL-FAST] Fibking round is ${state.phase}, not preparing`);
  }
  const { roundId } = state.pendingRound;
  for (const preparationStage of ['selecting', 'finalizing'] as const) {
    state = dispatchFibkingTestCommand(
      state,
      { type: 'fibking.round.updatePreparationStage', roundId, stage: preparationStage },
      'system',
    );
  }
  state = dispatchFibkingTestCommand(
    state,
    {
      type: 'fibking.round.complete',
      roundId,
      word: '山谷',
      definition: {
        coreMeaning: '两山之间低洼而且狭长的自然地形区域。',
        usageNote: '常用于描述山地之间可供河流或道路穿行的低地。',
      },
      source: 'local',
    },
    'system',
  );
  if (stage === 'viewing') return state;

  state = dispatchFibkingTestCommand(state, { type: 'fibking.role.viewed' });
  state = dispatchFibkingTestCommand(state, { type: 'fibking.bots.markAllBotsViewed' });
  state = dispatchFibkingTestCommand(state, { type: 'fibking.game.begin' });
  if (stage === 'ongoing') return state;

  return dispatchFibkingTestCommand(state, { type: 'fibking.round.reveal' });
}

export const FIBKING_REVIEW_ROUNDS: ReviewTestRounds<FibState> = {
  lobby: () => playFibkingTestRound('lobby'),
  ended: () => playFibkingTestRound('ended'),
  nextRound: (ended) => {
    if (ended.phase !== 'ended') {
      throw new Error(`[FAIL-FAST] Fibking round is ${ended.phase}, not ended`);
    }
    return { ...ended, round: { ...ended.round, roundId: `${ended.round.roundId}:next` } };
  },
};
