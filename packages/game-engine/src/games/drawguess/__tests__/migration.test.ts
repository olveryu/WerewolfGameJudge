/** v1 -> v2 roster migration: implicit bot seats materialize seat-by-seat. */

import type { CommandContext } from '../../../platform/engine';
import { getHumanSeatMap } from '../../../platform/room/seating';
import type { DrawGuessCommand } from '../commands/types';
import { DRAWGUESS_REASONS } from '../domain/decision';
import { drawGuessEngine } from '../engine';
import { migratePersistedDrawGuessState, parseDrawGuessState } from '../state/codec';
import {
  DEFAULT_DRAWGUESS_CONFIG,
  type DrawGuessState,
  getDrawGuessBotSeats,
} from '../state/types';

const CREATE_CONTEXT = { roomCode: '1234', hostUserId: 'host', nowMs: 1_000, commandId: 'create' };

function userContext(userId: string): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat: null,
    nowMs: 2_000,
    commandId: `cmd-${userId}`,
    randomSeed: 'migration-seed',
  };
}

function dispatch(
  state: DrawGuessState,
  command: DrawGuessCommand,
  userId = 'host',
): DrawGuessState {
  const decision = drawGuessEngine.decide(state, command, userContext(userId));
  if (decision.kind === 'reject') throw new Error(`Rejected ${command.type}: ${decision.reason}`);
  return drawGuessEngine.normalize(decision.events.reduce(drawGuessEngine.evolve, state));
}

function take(state: DrawGuessState, seat: number, userId: string): DrawGuessState {
  return dispatch(
    state,
    { type: 'room.seat.take', seat, profile: { displayName: userId } },
    userId,
  );
}

function filledLobby(): DrawGuessState {
  let state = drawGuessEngine.createInitialState(
    { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 6 },
    CREATE_CONTEXT,
  );
  state = take(state, 0, 'host');
  state = take(state, 1, 'alice');
  state = dispatch(state, { type: 'room.seat.fillBots' });
  return state;
}

/** Rebuilds the exact document a v1 store would have persisted. */
function downgradeToV1(state: DrawGuessState): Record<string, unknown> {
  const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  const humans = getHumanSeatMap(state.roster, state.config.numberOfPlayers);
  const bots = getDrawGuessBotSeats(state);
  delete raw.roster;
  const config = raw.config as Record<string, unknown>;
  return {
    ...raw,
    stateVersion: 1,
    config: { ...config, fillEmptySeatsWithBots: bots.length > 0 },
    realSeats: humans,
    excludedBotSeats:
      bots.length > 0
        ? Array.from({ length: state.config.numberOfPlayers }, (_, seat) => seat).filter(
            (seat) => humans[seat] === undefined && !bots.includes(seat),
          )
        : [],
  };
}

describe('DrawGuess v1 -> v2 roster migration', () => {
  it('materializes a filled lobby exactly and retires the config flag', () => {
    const state = filledLobby();
    expect(getDrawGuessBotSeats(state)).toEqual([2, 3, 4, 5]);
    const legacy = downgradeToV1(state);
    expect(() => parseDrawGuessState(legacy)).toThrow();
    const migrated = migratePersistedDrawGuessState(legacy);
    expect(migrated).toEqual(state);
    expect('fillEmptySeatsWithBots' in migrated.config).toBe(false);
    expect(migratePersistedDrawGuessState(state)).toEqual(state);
  });

  it('keeps a kicked bot seat empty', () => {
    let state = filledLobby();
    state = dispatch(state, { type: 'room.seat.kick', seat: 3 });
    expect(migratePersistedDrawGuessState(downgradeToV1(state))).toEqual(state);
  });

  it('materializes nothing when fill was off', () => {
    let state = drawGuessEngine.createInitialState(
      { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 6 },
      CREATE_CONTEXT,
    );
    state = take(state, 0, 'host');
    const legacy = downgradeToV1(state);
    (legacy.config as Record<string, unknown>).fillEmptySeatsWithBots = false;
    legacy.excludedBotSeats = [];
    const migrated = migratePersistedDrawGuessState(legacy);
    expect(getDrawGuessBotSeats(migrated)).toEqual([]);
    expect(migrated).toEqual(state);
  });

  it('migrates a started game (drawer queue present) whole', () => {
    const state = dispatch(filledLobby(), { type: 'drawguess.round.start' });
    expect(state.phase.kind).not.toBe('lobby');
    expect(migratePersistedDrawGuessState(downgradeToV1(state))).toEqual(state);
  });

  it('rejects a config shrink that would strand a bot seat', () => {
    const state = filledLobby();
    const decision = drawGuessEngine.decide(
      state,
      {
        type: 'drawguess.config.update',
        config: { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 4 },
      },
      userContext('host'),
    );
    expect(decision).toEqual({ kind: 'reject', reason: DRAWGUESS_REASONS.occupied });
  });
});
