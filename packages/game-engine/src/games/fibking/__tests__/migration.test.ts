/** Persisted-state migrations: v6/v5 -> v7 roster materialization, v7 -> v8 guess record. */

import type { CommandContext } from '../../../platform/engine';
import { getHumanSeatMap } from '../../../platform/room/seating';
import type { FibCommand } from '../commands/types';
import { REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE } from '../domain/reasons';
import { decideFibCommand, fibEngine } from '../engine';
import { migratePersistedFibState, parseFibState } from '../state/parseState';
import { FIB_PREPARATION_STAGES, type FibState, getFibBotSeats } from '../state/types';

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
    state = dispatch(state, { type: 'fibking.round.start' });
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
      { type: 'fibking.config.update', numberOfPlayers: 4 },
      userContext('host'),
    );
    expect(decision).toEqual({ kind: 'reject', reason: REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE });
  });

  it('migrates v7 rounds with an empty guess record, field for field', () => {
    const systemContext: CommandContext = {
      actor: { kind: 'system', effectId: 'effect-1' },
      controlledSeat: null,
      nowMs: 2,
      commandId: 'effect-command-1',
      randomSeed: 'role-seed-1',
    };
    const dispatchSystem = (state: FibState, command: FibCommand): FibState => {
      const decision = decideFibCommand(state, command, systemContext);
      if (decision.kind === 'reject')
        throw new Error(`Rejected ${command.type}: ${decision.reason}`);
      return fibEngine.normalize(decision.events.reduce(fibEngine.evolve, state));
    };
    let state = filledLobby();
    state = dispatch(state, { type: 'fibking.round.start' });
    if (state.phase !== 'preparing') throw new Error('Expected preparing state');
    const { roundId } = state.pendingRound;
    state = dispatchSystem(state, {
      type: 'fibking.round.updatePreparationStage',
      roundId,
      stage: FIB_PREPARATION_STAGES.selecting,
    });
    state = dispatchSystem(state, {
      type: 'fibking.round.updatePreparationStage',
      roundId,
      stage: FIB_PREPARATION_STAGES.finalizing,
    });
    state = dispatchSystem(state, {
      type: 'fibking.round.complete',
      roundId,
      word: '云朵',
      definition: {
        coreMeaning: '悬浮在空中的水滴或冰晶集合。',
        usageNote: '常用于说明该词所指事物的具体含义和适用语境。',
      },
      source: 'local',
    });
    if (state.phase !== 'viewing') throw new Error('Expected viewing state');
    expect(state.round.guesses).toEqual([]);

    // A v7 document is the same state minus the guess record.
    const legacy = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    delete (legacy.round as Record<string, unknown>).guesses;
    legacy.stateVersion = 7;
    expect(() => parseFibState(legacy)).toThrow();
    expect(migratePersistedFibState(legacy)).toEqual(state);

    // Lobby documents carry no round and migrate untouched.
    const lobby = filledLobby();
    const legacyLobby = JSON.parse(JSON.stringify(lobby)) as Record<string, unknown>;
    legacyLobby.stateVersion = 7;
    expect(migratePersistedFibState(legacyLobby)).toEqual(lobby);

    // Ongoing and ended v7 rounds (no guesses could exist under v7)
    // migrate field for field as well.
    const toV7Document = (current: FibState): Record<string, unknown> => {
      const legacy = JSON.parse(JSON.stringify(current)) as Record<string, unknown>;
      delete (legacy.round as Record<string, unknown>).guesses;
      legacy.stateVersion = 7;
      return legacy;
    };
    let ongoing = dispatch(state, { type: 'fibking.round.confirmRoleView' });
    ongoing = dispatch(ongoing, { type: 'fibking.round.markAllBotsViewed' });
    ongoing = dispatch(ongoing, { type: 'fibking.round.begin' });
    expect(ongoing.phase).toBe('ongoing');
    expect(migratePersistedFibState(toV7Document(ongoing))).toEqual(ongoing);
    const ended = dispatch(ongoing, { type: 'fibking.round.reveal' });
    expect(ended.phase).toBe('ended');
    expect(migratePersistedFibState(toV7Document(ended))).toEqual(ended);
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
