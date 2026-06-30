/**
 * fibEngine unit tests — Factory + Command + Strategy behavior, fail-fast guards.
 */

import type { CreateCtx, EngineResult } from '@werewolf/game-engine/engine/registry/types';
import { assignFibRoles } from '@werewolf/game-engine/fibking/assignRoles';
import { dispatchFib } from '@werewolf/game-engine/fibking/dispatch';
import { fibEngine } from '@werewolf/game-engine/fibking/engine';
import { normalizeFibState } from '@werewolf/game-engine/fibking/normalizeFibState';
import { fibReducer } from '@werewolf/game-engine/fibking/reducer';
import type { FibAction, FibRole, FibState } from '@werewolf/game-engine/fibking/types';
import { createSeededRng } from '@werewolf/game-engine/utils/random';

const CTX: CreateCtx = {
  roomCode: 'ABCD',
  hostUserId: 'host-1',
  hostProfile: { displayName: 'Host' },
};

/** Apply an engine result through reduce + normalize, mirroring processEngineAction. */
function apply(state: FibState, result: EngineResult<FibAction>): FibState {
  if (result.kind === 'error') {
    throw new Error(`unexpected engine error: ${result.reason}`);
  }
  let next = state;
  for (const action of result.actions) {
    next = fibReducer(next, action);
  }
  return normalizeFibState(next);
}

function sitAll(state: FibState, count: number): FibState {
  let next = state;
  for (let seat = 0; seat < count; seat++) {
    next = apply(
      next,
      dispatchFib(next, 1, {
        actionType: 'SIT',
        payload: { userId: `u${seat}`, seat, profile: { displayName: `P${seat}` } },
      }),
    );
  }
  return next;
}

describe('assignFibRoles', () => {
  it('assigns exactly 1 guesser + 1 honest + rest fibber, deterministic by seed', () => {
    const seats = [0, 1, 2, 3, 4];
    const a = assignFibRoles(seats, createSeededRng('seed-x'));
    const b = assignFibRoles(seats, createSeededRng('seed-x'));
    expect(a).toEqual(b); // deterministic

    const roles = Object.values(a);
    expect(roles.filter((r: FibRole) => r === 'guesser')).toHaveLength(1);
    expect(roles.filter((r: FibRole) => r === 'honest')).toHaveLength(1);
    expect(roles.filter((r: FibRole) => r === 'fibber')).toHaveLength(3);
    expect(Object.keys(a).map(Number).sort()).toEqual(seats);
  });

  it('throws when fewer than 3 seats', () => {
    expect(() => assignFibRoles([0, 1], createSeededRng('s'))).toThrow();
  });
});

describe('fibEngine.createInitialState', () => {
  it('builds a fresh Lobby with empty seats and no round fields', () => {
    const state = fibEngine.createInitialState({ numberOfPlayers: 5 }, CTX);
    expect(state).toMatchObject({
      gameType: 'fibking',
      roomCode: 'ABCD',
      hostUserId: 'host-1',
      phase: 'Lobby',
      numberOfPlayers: 5,
      roster: {},
      usedWords: [],
    });
    expect(Object.keys(state.seats)).toHaveLength(5);
    expect(Object.values(state.seats).every((s) => s === null)).toBe(true);
    expect(state.word).toBeUndefined();
    expect(() => normalizeFibState(state)).not.toThrow();
  });
});

describe('fibEngine seat actions (Lobby-only, fail-fast)', () => {
  it('SIT then LEAVE updates seats + roster', () => {
    let state = fibEngine.createInitialState({ numberOfPlayers: 4 }, CTX);
    state = apply(
      state,
      dispatchFib(state, 1, {
        actionType: 'SIT',
        payload: { userId: 'u0', seat: 0, profile: { displayName: 'A' } },
      }),
    );
    expect(state.seats[0]).toEqual({ userId: 'u0', seat: 0 });
    expect(state.roster.u0).toEqual({ displayName: 'A' });

    state = apply(state, dispatchFib(state, 1, { actionType: 'LEAVE', payload: { userId: 'u0' } }));
    expect(state.seats[0]).toBeNull();
    expect(state.roster.u0).toBeUndefined();
  });

  it('rejects taking an occupied seat and double-seating', () => {
    let state = fibEngine.createInitialState({ numberOfPlayers: 4 }, CTX);
    state = sitAll(state, 1);
    const taken = dispatchFib(state, 1, {
      actionType: 'SIT',
      payload: { userId: 'uX', seat: 0, profile: { displayName: 'X' } },
    });
    expect(taken.kind).toBe('error');
    const dbl = dispatchFib(state, 1, {
      actionType: 'SIT',
      payload: { userId: 'u0', seat: 1, profile: { displayName: 'P0' } },
    });
    expect(dbl.kind).toBe('error');
  });
});

describe('fibEngine UPDATE_CONFIG shrink guard', () => {
  it('rejects shrinking below an occupied high seat', () => {
    let state = fibEngine.createInitialState({ numberOfPlayers: 6 }, CTX);
    state = sitAll(state, 6); // seats 0..5 filled
    const shrink = dispatchFib(state, 1, {
      actionType: 'UPDATE_CONFIG',
      payload: { numberOfPlayers: 4 },
    });
    expect(shrink.kind).toBe('error');
  });

  it('allows shrinking when high seats are empty', () => {
    let state = fibEngine.createInitialState({ numberOfPlayers: 6 }, CTX);
    state = sitAll(state, 4); // seats 0..3 filled, 4..5 empty
    state = apply(
      state,
      dispatchFib(state, 1, { actionType: 'UPDATE_CONFIG', payload: { numberOfPlayers: 4 } }),
    );
    expect(state.numberOfPlayers).toBe(4);
    expect(Object.keys(state.seats)).toHaveLength(4);
  });
});

describe('fibEngine full round lifecycle', () => {
  it('Lobby → Starting → Playing → Revealed → restart', () => {
    let state = fibEngine.createInitialState({ numberOfPlayers: 4 }, CTX);

    // not full → BEGIN_DRAW rejected
    expect(dispatchFib(state, 1, { actionType: 'BEGIN_DRAW', payload: {} }).kind).toBe('error');

    state = sitAll(state, 4);
    state = apply(state, dispatchFib(state, 1, { actionType: 'BEGIN_DRAW', payload: {} }));
    expect(state.phase).toBe('Starting');
    expect(state.word).toBeUndefined();

    state = apply(
      state,
      dispatchFib(
        state,
        1,
        {
          actionType: 'START_ROUND',
          payload: { word: '踟蹰', definition: '徘徊不前', source: 'fallback' },
        },
        { rng: createSeededRng('round-1') },
      ),
    );
    expect(state.phase).toBe('Playing');
    expect(state.word).toBe('踟蹰');
    expect(state.wordSource).toBe('fallback');
    expect(Object.keys(state.roleBySeat ?? {})).toHaveLength(4);
    expect(state.usedWords).toEqual(['踟蹰']);

    state = apply(state, dispatchFib(state, 1, { actionType: 'REVEAL', payload: {} }));
    expect(state.phase).toBe('Revealed');

    // restart wipes round + usedWords, keeps seats
    state = apply(state, dispatchFib(state, 1, { actionType: 'RESTART', payload: {} }));
    expect(state.phase).toBe('Lobby');
    expect(state.word).toBeUndefined();
    expect(state.usedWords).toEqual([]);
    expect(Object.values(state.seats).filter((s) => s !== null)).toHaveLength(4);
  });

  it('next-round (BEGIN_DRAW from Revealed) keeps usedWords', () => {
    let state = fibEngine.createInitialState({ numberOfPlayers: 4 }, CTX);
    state = sitAll(state, 4);
    state = apply(state, dispatchFib(state, 1, { actionType: 'BEGIN_DRAW', payload: {} }));
    state = apply(
      state,
      dispatchFib(
        state,
        1,
        { actionType: 'START_ROUND', payload: { word: 'w1', definition: 'd1', source: 'gemini' } },
        { rng: createSeededRng('r1') },
      ),
    );
    state = apply(state, dispatchFib(state, 1, { actionType: 'REVEAL', payload: {} }));
    // next round
    state = apply(state, dispatchFib(state, 1, { actionType: 'BEGIN_DRAW', payload: {} }));
    expect(state.phase).toBe('Starting');
    expect(state.usedWords).toEqual(['w1']); // preserved across next round
  });
});

describe('normalizeFibState fail-fast', () => {
  it('throws if Playing lacks word', () => {
    const bad: FibState = {
      gameType: 'fibking',
      roomCode: 'ABCD',
      hostUserId: 'host-1',
      phase: 'Playing',
      numberOfPlayers: 4,
      seats: {},
      roster: {},
      usedWords: [],
    };
    expect(() => normalizeFibState(bad)).toThrow();
  });

  it('throws if Lobby carries round fields', () => {
    const bad: FibState = {
      gameType: 'fibking',
      roomCode: 'ABCD',
      hostUserId: 'host-1',
      phase: 'Lobby',
      numberOfPlayers: 4,
      seats: {},
      roster: {},
      usedWords: [],
      word: 'leak',
      definition: 'leak',
      roleBySeat: {},
      wordSource: 'gemini',
    };
    expect(() => normalizeFibState(bad)).toThrow();
  });
});
