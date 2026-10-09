import { assignFibRoles } from '../domain/roles';
import { fibEngine } from '../engine';
import { parseFibState } from '../state/parseState';
import { FIB_MAX_PLAYERS, FIB_PREPARATION_STAGES } from '../state/types';
import { FIB_STATE_VERSION } from '../state/version';

const CREATE_CONTEXT = {
  roomCode: '2468',
  hostUserId: 'host',
  nowMs: 1,
  commandId: 'create-1',
} as const;

describe('FibKing compact state and codec', () => {
  it('assigns two distinct deterministic roles without materializing every role', () => {
    const first = assignFibRoles(FIB_MAX_PLAYERS, 'same-seed');
    const second = assignFibRoles(FIB_MAX_PLAYERS, 'same-seed');

    expect(first).toEqual(second);
    expect(first.guesserSeat).toBeGreaterThanOrEqual(0);
    expect(first.guesserSeat).toBeLessThan(FIB_MAX_PLAYERS);
    expect(first.honestSeat).toBeGreaterThanOrEqual(0);
    expect(first.honestSeat).toBeLessThan(FIB_MAX_PLAYERS);
    expect(first.guesserSeat).not.toBe(first.honestSeat);
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
      roster: {
        0: { seat: 0, kind: 'bot' },
        1: { seat: 1, kind: 'bot' },
        2: { seat: 2, kind: 'bot' },
        3: { seat: 3, kind: 'bot' },
      },
      phase: 'preparing',
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
      roster: {
        0: { seat: 0, kind: 'bot' },
        1: { seat: 1, kind: 'bot' },
        2: { seat: 2, kind: 'bot' },
        3: { seat: 3, kind: 'bot' },
      },
      phase: 'preparationFailed',
      pendingRound: null,
      preparationFailure: {
        roundId: 'fib-round:codec',
        requestedAt: 2,
        failedAt: 8_002,
        failureCode: 'selectionFailed',
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
        roster: {
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

  it('rejects malformed roster entries', () => {
    const state = fibEngine.createInitialState({ numberOfPlayers: 8 }, CREATE_CONTEXT);

    // A bot occupant carries exactly {seat, kind}; extra fields are unknown.
    expect(() =>
      parseFibState({ ...state, roster: { 2: { seat: 2, kind: 'bot', userId: 'x' } } }),
    ).toThrow('unknown field');
    // A human occupant must not carry a kind discriminator.
    expect(() =>
      parseFibState({
        ...state,
        roster: {
          2: { seat: 2, kind: 'human', userId: 'alice', profile: { displayName: 'Alice' } },
        },
      }),
    ).toThrow('unknown field');
    // The stored seat must match the roster key (normalize invariant).
    expect(() =>
      parseFibState({
        ...state,
        roster: { 2: { seat: 3, userId: 'alice', profile: { displayName: 'Alice' } } },
      }),
    ).toThrow('mismatched seat');
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
        roster: {
          4: { userId: 'alice', seat: 4, profile: { displayName: 'Alice' } },
        },
      }),
    ).toThrow('must be within the configured Fib seat range');
  });
});
