/** Canonical Undercover states for client tests (AU-46), and rounds played through the real engine. */

import type {
  UndercoverCommand,
  UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';
import { undercoverEngine } from '@game-judge/game-engine/games/undercover/public';

import type { ReviewTestRounds } from './reviewTestRounds';

function withOverrides<S>(base: S, overrides: Partial<S>): S {
  return { ...base, ...overrides };
}

export function buildUndercoverTestState(
  overrides: Partial<UndercoverState> = {},
): UndercoverState {
  return withOverrides(
    undercoverEngine.createInitialState(
      { numberOfPlayers: 8, hasBlank: true, category: 'all' },
      { roomCode: 'ABCD', hostUserId: 'host-1', nowMs: 0, commandId: 'create' },
    ),
    overrides,
  );
}

/** Who sends a scripted command: the host, or the system's word-selection effect. */
export type UndercoverTestActor = 'host' | 'system';

/** Applies one command as `actor`; a rejected command fails the test. */
export function dispatchUndercoverTestCommand(
  state: UndercoverState,
  command: UndercoverCommand,
  actor: UndercoverTestActor = 'host',
): UndercoverState {
  const execution = { nowMs: 1, commandId: 'start', randomSeed: 'test' };
  const decision = undercoverEngine.decide(
    state,
    command,
    actor === 'host'
      ? { ...execution, actor: { kind: 'user', userId: 'host' }, controlledSeat: null }
      : { ...execution, actor: { kind: 'system', effectId: 'selection' }, controlledSeat: null },
  );
  if (decision.kind === 'reject') {
    throw new Error(`[FAIL-FAST] ${command.type} rejected: ${decision.reason}`);
  }
  return undercoverEngine.normalize(decision.events.reduce(undercoverEngine.evolve, state));
}

/** The phases `playUndercoverTestRound` stops at, in round order. */
export type UndercoverTestStage = 'lobby' | 'preparing' | 'viewing' | 'ongoing' | 'ended';

/**
 * A six-seat round played through the real engine up to `stage`: the host
 * takes seat 0 and bots fill the rest; the roles are assigned, the word
 * pair 豆浆／牛奶 is dealt, every seat views its word, and to end the
 * round the host reveals the undercover and blank seats until a side wins.
 */
export function playUndercoverTestRound(stage: UndercoverTestStage): UndercoverState {
  let state = undercoverEngine.createInitialState(
    { numberOfPlayers: 6, hasBlank: true, category: 'all' },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1, commandId: 'create' },
  );
  state = dispatchUndercoverTestCommand(state, {
    type: 'room.seat.take',
    seat: 0,
    profile: { displayName: 'Host' },
  });
  state = dispatchUndercoverTestCommand(state, { type: 'room.seat.fillBots' });
  if (stage === 'lobby') return state;

  state = dispatchUndercoverTestCommand(state, {
    type: 'undercover.roles.assign',
    shouldAllowRepeated: false,
  });
  if (stage === 'preparing') return state;
  if (state.phase !== 'preparing') {
    throw new Error(`[FAIL-FAST] Undercover round is ${state.phase}, not preparing`);
  }
  const { roundId } = state.pendingRound;
  state = dispatchUndercoverTestCommand(
    state,
    {
      type: 'undercover.round.complete',
      roundId,
      wordPair: { id: 'pair', wordA: '豆浆', wordB: '牛奶', category: 'food' },
    },
    'system',
  );
  if (stage === 'viewing') return state;

  state = dispatchUndercoverTestCommand(state, { type: 'undercover.role.viewed', roundId });
  state = dispatchUndercoverTestCommand(state, {
    type: 'undercover.bots.markAllBotsViewed',
    roundId,
  });
  state = dispatchUndercoverTestCommand(state, { type: 'undercover.game.begin', roundId });
  if (stage === 'ongoing') return state;

  while (state.phase === 'ongoing') {
    const revealed = state.round.revelations.map((revelation) => revelation.seat);
    const seat = state.round.roles.findIndex(
      (role, index) => role !== 'civilian' && !revealed.includes(index),
    );
    state = dispatchUndercoverTestCommand(state, {
      type: 'undercover.round.reveal',
      roundId,
      seat,
    });
  }
  return state;
}

export const UNDERCOVER_REVIEW_ROUNDS: ReviewTestRounds<UndercoverState> = {
  lobby: () => playUndercoverTestRound('lobby'),
  ended: () => playUndercoverTestRound('ended'),
  nextRound: (ended) => {
    if (ended.phase !== 'ended') {
      throw new Error(`[FAIL-FAST] Undercover round is ${ended.phase}, not ended`);
    }
    return { ...ended, round: { ...ended.round, roundId: `${ended.round.roundId}:next` } };
  },
};
