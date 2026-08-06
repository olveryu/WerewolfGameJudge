import { assignFibRoles } from '../domain/roles';
import { fibEngine } from '../engine';
import { parseFibState } from '../state/parseState';
import { FIB_PREPARATION_STAGES } from '../state/types';
import { FIB_STATE_VERSION } from '../state/version';

const CREATE_CONTEXT = {
  roomCode: '2468',
  hostUserId: 'host',
  nowMs: 1,
  commandId: 'create-1',
} as const;

describe('FibKing compact state and codec', () => {
  it('assigns two distinct deterministic roles in O(1) for an unbounded product size', () => {
    const first = assignFibRoles(Number.MAX_SAFE_INTEGER, 'same-seed');
    const second = assignFibRoles(Number.MAX_SAFE_INTEGER, 'same-seed');

    expect(first).toEqual(second);
    expect(first.guesserSeat).toBeGreaterThanOrEqual(0);
    expect(first.guesserSeat).toBeLessThan(Number.MAX_SAFE_INTEGER);
    expect(first.honestSeat).toBeGreaterThanOrEqual(0);
    expect(first.honestSeat).toBeLessThan(Number.MAX_SAFE_INTEGER);
    expect(first.guesserSeat).not.toBe(first.honestSeat);
    expect(Math.max(first.guesserSeat, first.honestSeat)).toBeGreaterThan(2 ** 32);
    expect(Object.keys(first)).toEqual(['guesserSeat', 'honestSeat']);
  });

  it('round-trips a canonical sparse state', () => {
    const state = fibEngine.createInitialState({ numberOfPlayers: 8 }, CREATE_CONTEXT);
    expect(parseFibState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('round-trips and validates preparing stages', () => {
    const state = fibEngine.createInitialState({ numberOfPlayers: 4 }, CREATE_CONTEXT);
    const preparing = {
      ...state,
      phase: 'preparing',
      fillEmptySeatsWithBots: true,
      pendingRound: {
        roundId: 'fib-round:codec',
        requestedAt: 2,
        stage: FIB_PREPARATION_STAGES.queued,
      },
      preparationFailure: null,
      round: null,
    };

    expect(parseFibState(preparing)).toEqual(preparing);
    expect(() =>
      parseFibState({
        ...preparing,
        pendingRound: { ...preparing.pendingRound, stage: 'unknown' },
      }),
    ).toThrow('FibState.pendingRound.stage must be a valid Fib preparation stage');
  });

  it('round-trips a terminal preparation failure', () => {
    const state = fibEngine.createInitialState({ numberOfPlayers: 4 }, CREATE_CONTEXT);
    const failed = {
      ...state,
      phase: 'preparationFailed',
      fillEmptySeatsWithBots: true,
      pendingRound: null,
      preparationFailure: {
        roundId: 'fib-round:codec',
        requestedAt: 2,
        failedAt: 8_002,
        failureCode: 'timedOut',
      },
      round: null,
    };

    expect(parseFibState(failed)).toEqual(failed);
  });

  it('rejects unknown fields, non-canonical seat keys, and unsupported identity', () => {
    const state = fibEngine.createInitialState({ numberOfPlayers: 8 }, CREATE_CONTEXT);
    expect(() => parseFibState({ ...state, extra: true })).toThrow(
      'FibState contains unknown field: extra',
    );
    expect(() =>
      parseFibState({
        ...state,
        realSeats: {
          '01': { userId: 'alice', seat: 1, profile: { displayName: 'Alice' } },
        },
      }),
    ).toThrow('a canonical non-negative integer key');
    expect(() => parseFibState({ ...state, gameType: 'werewolf' })).toThrow(
      'FibState.gameType must be fibking',
    );
    expect(() => parseFibState({ ...state, stateVersion: FIB_STATE_VERSION - 1 })).toThrow(
      `FibState.stateVersion must be state version ${FIB_STATE_VERSION}`,
    );
  });

  it('rejects non-canonical bot-seat exclusions', () => {
    const state = fibEngine.createInitialState({ numberOfPlayers: 8 }, CREATE_CONTEXT);
    const filled = { ...state, fillEmptySeatsWithBots: true };

    expect(() => parseFibState({ ...filled, excludedBotSeats: [2, 2] })).toThrow(
      'must be unique and strictly ascending',
    );
    expect(() => parseFibState({ ...filled, excludedBotSeats: [3, 1] })).toThrow(
      'must be unique and strictly ascending',
    );
    expect(() => parseFibState({ ...filled, excludedBotSeats: [8] })).toThrow(
      'must be within the configured Fib seat range',
    );
    expect(() => parseFibState({ ...state, excludedBotSeats: [1] })).toThrow(
      'requires bot fill to be enabled',
    );
  });

  it('rejects phase payloads that do not match the discriminated state contract', () => {
    const state = fibEngine.createInitialState({ numberOfPlayers: 8 }, CREATE_CONTEXT);
    expect(() => parseFibState({ ...state, phase: 'preparing' })).toThrow(
      'FibState.pendingRound must be an object',
    );
    expect(() => parseFibState({ ...state, phase: 'playing' })).toThrow(
      'FibState.phase must be a valid Fib phase',
    );
  });

  it('fails normalization when persisted seats violate the configured range', () => {
    const state = fibEngine.createInitialState({ numberOfPlayers: 4 }, CREATE_CONTEXT);
    expect(() =>
      parseFibState({
        ...state,
        realSeats: {
          4: { userId: 'alice', seat: 4, profile: { displayName: 'Alice' } },
        },
      }),
    ).toThrow('must be within the configured Fib seat range');
  });
});
