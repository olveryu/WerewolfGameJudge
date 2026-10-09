/** v6/v5 -> v7 roster migration: implicit bot seats materialize seat-by-seat. */

import type { CommandContext } from '../../../platform/engine';
import { getHumanSeatMap } from '../../../platform/room/seating';
import type { FibCommand } from '../commands/types';
import { REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE } from '../domain/reasons';
import { decideFibCommand, fibEngine } from '../engine';
import { migratePersistedFibState, parseFibState } from '../state/parseState';
import { type FibState, getFibBotSeats } from '../state/types';

const CREATE_CONTEXT = { roomCode: '4321', hostUserId: 'host', nowMs: 1, commandId: 'create' };

function userContext(userId: string): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat: null,
    nowMs: 2,
    commandId: `cmd-${userId}`,
    randomSeed: 'seed',
  };
}

function dispatch(state: FibState, command: FibCommand, userId = 'host'): FibState {
  const decision = decideFibCommand(state, command, userContext(userId));
  if (decision.kind === 'reject') throw new Error(`Rejected ${command.type}: ${decision.reason}`);
  return fibEngine.normalize(decision.events.reduce(fibEngine.evolve, state));
}

function filledLobby(): FibState {
  let state = fibEngine.createInitialState({ numberOfPlayers: 4 }, CREATE_CONTEXT);
  state = dispatch(state, { type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
  state = dispatch(state, { type: 'room.seat.fillBots' });
  return state;
}

/** Rebuilds the exact document a v6 store would have persisted. */
function downgradeToV6(state: FibState): Record<string, unknown> {
  const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  const humans = getHumanSeatMap(state.roster, state.numberOfPlayers);
  const bots = getFibBotSeats(state);
  delete raw.roster;
  return {
    ...raw,
    stateVersion: 6,
    realSeats: humans,
    fillEmptySeatsWithBots: bots.length > 0,
    excludedBotSeats:
      bots.length > 0
        ? Array.from({ length: state.numberOfPlayers }, (_, seat) => seat).filter(
            (seat) => humans[seat] === undefined && !bots.includes(seat),
          )
        : [],
  };
}

describe('FibKing v6 -> v7 roster migration', () => {
  it('materializes a filled lobby exactly (host + 3 bots)', () => {
    const state = filledLobby();
    expect(getFibBotSeats(state)).toEqual([1, 2, 3]);
    const legacy = downgradeToV6(state);
    expect(() => parseFibState(legacy)).toThrow();
    expect(migratePersistedFibState(legacy)).toEqual(state);
    expect(migratePersistedFibState(state)).toEqual(state);
  });

  it('keeps a kicked bot seat empty', () => {
    let state = filledLobby();
    state = dispatch(state, { type: 'room.seat.kick', seat: 2 });
    expect(migratePersistedFibState(downgradeToV6(state))).toEqual(state);
  });

  it('materializes nothing when fill was off', () => {
    let state = fibEngine.createInitialState({ numberOfPlayers: 4 }, CREATE_CONTEXT);
    state = dispatch(state, { type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
    const legacy = downgradeToV6(state);
    legacy.fillEmptySeatsWithBots = false;
    legacy.excludedBotSeats = [];
    const migrated = migratePersistedFibState(legacy);
    expect(getFibBotSeats(migrated)).toEqual([]);
    expect(migrated).toEqual(state);
  });

  it('migrates a preparing state (round in flight) whole', () => {
    let state = filledLobby();
    state = dispatch(state, { type: 'fib.round.start' });
    expect(state.phase).toBe('preparing');
    expect(migratePersistedFibState(downgradeToV6(state))).toEqual(state);
  });

  it('chains a v5 lobby (no round) through to the v7 roster', () => {
    const state = filledLobby();
    const legacy = downgradeToV6(state);
    legacy.stateVersion = 5;
    expect(migratePersistedFibState(legacy)).toEqual(state);
  });

  it('rejects a config shrink that would strand a bot seat', () => {
    let state = fibEngine.createInitialState({ numberOfPlayers: 5 }, CREATE_CONTEXT);
    state = dispatch(state, { type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
    state = dispatch(state, { type: 'room.seat.fillBots' });
    const decision = decideFibCommand(
      state,
      { type: 'fib.config.update', numberOfPlayers: 4 },
      userContext('host'),
    );
    expect(decision).toEqual({ kind: 'reject', reason: REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE });
  });

  it('tolerates legacy exclusions naming human, duplicate, or out-of-range seats', () => {
    // Reachable under the old rules: the host kicked bot seat 2 (excluded),
    // then a human took that seat; the exclusion entry was never cleaned up.
    const state = filledLobby();
    const legacy = downgradeToV6(state);
    const realSeats = legacy.realSeats as Record<string, unknown>;
    realSeats['2'] = { seat: 2, userId: 'alice', profile: { displayName: 'Alice' } };
    legacy.excludedBotSeats = [2, 2, 99];
    const migrated = migratePersistedFibState(legacy);
    expect(getFibBotSeats(migrated)).toEqual([1, 3]);
    const occupant = migrated.roster[2];
    if (occupant == null || !('userId' in occupant)) throw new Error('Expected human at seat 2');
    expect(occupant.userId).toBe('alice');
  });
});
