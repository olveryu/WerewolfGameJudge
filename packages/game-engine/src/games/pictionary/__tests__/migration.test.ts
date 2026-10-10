/** v8 -> v9 roster migration: implicit bot seats materialize seat-by-seat. */

import type { CommandContext, CreateGameContext, Decision } from '../../../platform/engine';
import { getHumanSeatMap } from '../../../platform/room/seating';
import {
  createPictionaryCommand,
  type PictionaryCommandInput,
  type PictionaryInternalCommand,
} from '../commands/types';
import type { PictionaryEvent } from '../domain/events';
import { REASON_PICTIONARY_OCCUPIED_SEAT_OUT_OF_RANGE } from '../domain/reasons';
import type { PictionaryEffect } from '../effects/types';
import {
  decidePictionaryCommand as decideBoundPictionaryCommand,
  pictionaryEngine,
} from '../engine';
import { migratePersistedPictionaryState, parsePictionaryState } from '../state/parseState';
import {
  DEFAULT_PICTIONARY_CONFIG,
  getPictionaryBotSeats,
  getPictionaryUserSeat,
  type PictionaryState,
} from '../state/types';

const CREATE_CONTEXT: CreateGameContext = {
  roomCode: '2468',
  hostUserId: 'host',
  nowMs: 1_000,
  commandId: 'create-room',
};

function userContext(userId: string): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat: null,
    nowMs: 2_000,
    commandId: `${userId}:self`,
    randomSeed: 'pictionary-migration-seed',
  };
}

function decidePictionaryCommand(
  state: PictionaryState,
  command: PictionaryCommandInput | PictionaryInternalCommand,
  context: CommandContext,
): Decision<PictionaryEvent, PictionaryEffect> {
  const seat =
    context.controlledSeat ??
    (context.actor.kind === 'user' ? getPictionaryUserSeat(state, context.actor.userId) : null) ??
    0;
  return decideBoundPictionaryCommand(
    state,
    command.type === 'pictionary.drawing.commit'
      ? command
      : createPictionaryCommand(state, command, seat),
    context,
  );
}

function dispatch(
  state: PictionaryState,
  command: PictionaryCommandInput | PictionaryInternalCommand,
): PictionaryState {
  const decision = decidePictionaryCommand(state, command, userContext('host'));
  if (decision.kind !== 'commit') {
    throw new Error(`Expected committed Pictionary decision, received ${decision.reason}`);
  }
  return decision.events.reduce(
    (nextState, event) => pictionaryEngine.normalize(pictionaryEngine.evolve(nextState, event)),
    state,
  );
}

function filledLobby(): PictionaryState {
  let state = pictionaryEngine.createInitialState(
    { ...DEFAULT_PICTIONARY_CONFIG, numberOfPlayers: 4 },
    CREATE_CONTEXT,
  );
  state = dispatch(state, { type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
  state = dispatch(state, { type: 'room.seat.fillBots' });
  return state;
}

/** Rebuilds the exact document a v8 store would have persisted. */
function downgradeToV8(state: PictionaryState): Record<string, unknown> {
  const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  const humans = getHumanSeatMap(state.roster, state.config.numberOfPlayers);
  const bots = getPictionaryBotSeats(state);
  delete raw.roster;
  return {
    ...raw,
    stateVersion: 8,
    realSeats: humans,
    fillEmptySeatsWithBots: bots.length > 0,
    excludedBotSeats:
      bots.length > 0
        ? Array.from({ length: state.config.numberOfPlayers }, (_, seat) => seat).filter(
            (seat) => humans[seat] === undefined && !bots.includes(seat),
          )
        : [],
  };
}

describe('Pictionary v8 -> v9 roster migration', () => {
  it('materializes a filled lobby exactly (host + 3 bots)', () => {
    const state = filledLobby();
    expect(getPictionaryBotSeats(state)).toEqual([1, 2, 3]);
    const legacy = downgradeToV8(state);
    expect(() => parsePictionaryState(legacy)).toThrow();
    expect(migratePersistedPictionaryState(legacy)).toEqual(state);
    expect(migratePersistedPictionaryState(state)).toEqual(state);
  });

  it('keeps a kicked bot seat empty', () => {
    let state = filledLobby();
    state = dispatch(state, { type: 'room.seat.kick', seat: 2 });
    expect(migratePersistedPictionaryState(downgradeToV8(state))).toEqual(state);
  });

  it('materializes nothing when fill was off', () => {
    let state = pictionaryEngine.createInitialState(
      { ...DEFAULT_PICTIONARY_CONFIG, numberOfPlayers: 4 },
      CREATE_CONTEXT,
    );
    state = dispatch(state, { type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
    const legacy = downgradeToV8(state);
    legacy.fillEmptySeatsWithBots = false;
    legacy.excludedBotSeats = [];
    const migrated = migratePersistedPictionaryState(legacy);
    expect(getPictionaryBotSeats(migrated)).toEqual([]);
    expect(migrated).toEqual(state);
  });

  it('migrates a started round (participants snapshot present) whole', () => {
    const state = dispatch(filledLobby(), { type: 'pictionary.round.start' });
    expect(state.phase).not.toBe('lobby');
    expect(migratePersistedPictionaryState(downgradeToV8(state))).toEqual(state);
  });

  it('rejects a config shrink that would strand a bot seat', () => {
    let state = pictionaryEngine.createInitialState(
      { ...DEFAULT_PICTIONARY_CONFIG, numberOfPlayers: 5 },
      CREATE_CONTEXT,
    );
    state = dispatch(state, { type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
    state = dispatch(state, { type: 'room.seat.fillBots' });
    const decision = decidePictionaryCommand(
      state,
      {
        type: 'pictionary.config.update',
        config: { ...DEFAULT_PICTIONARY_CONFIG, numberOfPlayers: 4 },
      },
      userContext('host'),
    );
    expect(decision).toEqual({
      kind: 'reject',
      reason: REASON_PICTIONARY_OCCUPIED_SEAT_OUT_OF_RANGE,
    });
  });
});
