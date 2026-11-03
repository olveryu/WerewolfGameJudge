/** v1 -> v2 roster migration: implicit bot seats materialize seat-by-seat.
 * v2 -> v3 drawerZeroed migration: roundEnd phases gain the zeroing flag. */

import type { CommandContext } from '../../../platform/engine';
import { getBotSeats, getHumanSeatMap } from '../../../platform/room/seating';
import type { DrawGuessCommand } from '../commands/types';
import { DRAWGUESS_REASONS } from '../domain/decision';
import { drawGuessEngine } from '../engine';
import { migratePersistedDrawGuessState, parseDrawGuessState } from '../state/parseState';
import { DEFAULT_DRAWGUESS_CONFIG, type DrawGuessState } from '../state/types';

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
  const bots = getBotSeats(state.roster);
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
    expect(getBotSeats(state.roster)).toEqual([2, 3, 4, 5]);
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
    expect(getBotSeats(migrated.roster)).toEqual([]);
    expect(migrated).toEqual(state);
  });

  it('migrates a started game (drawer queue present) whole', () => {
    const state = dispatch(filledLobby(), { type: 'drawguess.game.begin' });
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

/** Rebuilds the exact document a v2 store would have persisted. */
function downgradeToV2(state: DrawGuessState): Record<string, unknown> {
  const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  raw.stateVersion = 2;
  const phase = raw.phase as Record<string, unknown>;
  delete phase.drawerZeroed;
  return raw;
}

function roundEndState(): DrawGuessState {
  let state = dispatch(filledLobby(), { type: 'drawguess.game.begin' });
  state = drawGuessEngine.evolve(state, {
    type: 'drawguess.word.chosen',
    turnIndex: 0,
    word: '大熊猫',
    pinyinInitials: 'd x m',
    revealOrder: [0, 1, 2],
    phaseStartAt: 2000,
    deadlineAt: 92000,
  });
  state = drawGuessEngine.evolve(state, {
    type: 'drawguess.round.ended',
    turnIndex: 0,
    drawerSeat: 0,
    word: '大熊猫',
    deadlineAt: 100000,
  });
  if (state.phase.kind !== 'roundEnd') throw new Error('phase');
  return state;
}

function zeroedRoundEndState(): DrawGuessState {
  let state = dispatch(filledLobby(), { type: 'drawguess.game.begin' });
  state = drawGuessEngine.evolve(state, {
    type: 'drawguess.word.chosen',
    turnIndex: 0,
    word: '大熊猫',
    pinyinInitials: 'd x m',
    revealOrder: [0, 1, 2],
    phaseStartAt: 2000,
    deadlineAt: 92000,
  });
  for (let seat = 1; seat <= 5; seat += 1) {
    state = drawGuessEngine.evolve(state, {
      type: 'drawguess.guess.submitted',
      turnIndex: 0,
      seat,
      text: '大熊猫',
      correct: true,
      at: 3000 + seat,
      guesserScore: 200,
      drawerScore: seat === 1 ? 100 : 20,
      deadlineAt: 92000,
    });
  }
  state = drawGuessEngine.evolve(state, {
    type: 'drawguess.round.ended',
    turnIndex: 0,
    drawerSeat: 0,
    word: '大熊猫',
    deadlineAt: 100000,
  });
  if (state.phase.kind !== 'roundEnd' || !state.phase.drawerZeroed) throw new Error('phase');
  return state;
}

describe('DrawGuess v2 -> v3 drawerZeroed migration', () => {
  it('rejects a stored v2 state in the strict parser and adds drawerZeroed on migrate', () => {
    const state = roundEndState();
    const legacy = downgradeToV2(state);
    expect(() => parseDrawGuessState(legacy)).toThrow();
    const migrated = migratePersistedDrawGuessState(legacy);
    expect(migrated.stateVersion).toBe(3);
    if (migrated.phase.kind !== 'roundEnd') throw new Error('phase');
    expect(migrated.phase.drawerZeroed).toBe(false);
    expect(migrated).toEqual(state);
  });

  it('leaves non-roundEnd v2 phases unchanged', () => {
    const lobby = filledLobby();
    expect(migratePersistedDrawGuessState(downgradeToV2(lobby))).toEqual(lobby);
    const wordSelect = dispatch(filledLobby(), { type: 'drawguess.game.begin' });
    expect(migratePersistedDrawGuessState(downgradeToV2(wordSelect))).toEqual(wordSelect);
  });

  it('adds drawerZeroed through the v1 chain for a stored v1 roundEnd room', () => {
    const state = roundEndState();
    const legacy = downgradeToV1(state);
    const phase = legacy.phase as Record<string, unknown>;
    delete phase.drawerZeroed;
    const migrated = migratePersistedDrawGuessState(legacy);
    if (migrated.phase.kind !== 'roundEnd') throw new Error('phase');
    expect(migrated.phase.drawerZeroed).toBe(false);
    expect(migrated).toEqual(state);
  });

  it('keeps a drawerZeroed value a v2 document already carries', () => {
    const state = zeroedRoundEndState();
    const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    raw.stateVersion = 2;
    const migrated = migratePersistedDrawGuessState(raw);
    if (migrated.phase.kind !== 'roundEnd') throw new Error('phase');
    expect(migrated.phase.drawerZeroed).toBe(true);
    expect(migrated).toEqual(state);
  });
});
