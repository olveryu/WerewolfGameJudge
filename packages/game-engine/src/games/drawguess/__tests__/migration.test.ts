/** DrawGuess persistence migrations preserve legacy data and make unknown stats explicit. */

import type { CommandContext } from '../../../platform/engine';
import { getBotSeats, getHumanSeatMap } from '../../../platform/room/seating';
import type { DrawGuessCommand } from '../commands/types';
import { DRAWGUESS_REASONS } from '../domain/decision';
import { drawGuessEngine } from '../engine';
import { drawGuessCompletionPayloadSchema } from '../publicStats';
import { migratePersistedDrawGuessState, parseDrawGuessState } from '../state/parseState';
import { DEFAULT_DRAWGUESS_CONFIG, type DrawGuessState } from '../state/types';
import { DRAWGUESS_STATE_VERSION } from '../state/version';

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

function filledLobby(humanCount = 2): DrawGuessState {
  let state = drawGuessEngine.createInitialState(
    { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 6 },
    CREATE_CONTEXT,
  );
  state = take(state, 0, 'host');
  state = take(state, 1, 'alice');
  for (let seat = 2; seat < humanCount; seat += 1) state = take(state, seat, `u${seat}`);
  state = dispatch(state, { type: 'room.seat.fillBots' });
  return state;
}

/** Strips the v4/v5 additions to reconstruct older persisted documents. */
function stripV4Fields(raw: Record<string, unknown>): Record<string, unknown> {
  delete raw.turnHistory;
  const phase = raw.phase as Record<string, unknown>;
  delete phase.reactionsBySeat;
  delete phase.guessAttemptsBySeat;
  delete phase.guessTimeMsBySeat;
  if (phase.kind === 'roundEnd') delete phase.guessedSeats;
  return raw;
}

function withoutV5Fields(state: DrawGuessState): DrawGuessState {
  const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  const phase = raw.phase as Record<string, unknown>;
  delete phase.guessAttemptsBySeat;
  delete phase.guessTimeMsBySeat;
  const turnHistory = raw.turnHistory as Record<string, unknown>[];
  for (const turn of turnHistory) {
    delete turn.guessAttemptsBySeat;
    delete turn.guessTimeMsBySeat;
  }
  return raw as unknown as DrawGuessState;
}

/** Rebuilds the exact document a v1 store would have persisted. */
function downgradeToV1(state: DrawGuessState): Record<string, unknown> {
  const raw = stripV4Fields(JSON.parse(JSON.stringify(state)) as Record<string, unknown>);
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
  const raw = stripV4Fields(JSON.parse(JSON.stringify(state)) as Record<string, unknown>);
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
    expect(migrated.stateVersion).toBe(5);
    if (migrated.phase.kind !== 'roundEnd') throw new Error('phase');
    expect(migrated.phase.drawerZeroed).toBe(false);
    expect(migrated).toEqual(withoutV5Fields(state));
  });

  it('leaves non-roundEnd v2 phases unchanged', () => {
    const lobby = filledLobby();
    expect(migratePersistedDrawGuessState(downgradeToV2(lobby))).toEqual(withoutV5Fields(lobby));
    const wordSelect = dispatch(filledLobby(), { type: 'drawguess.game.begin' });
    expect(migratePersistedDrawGuessState(downgradeToV2(wordSelect))).toEqual(
      withoutV5Fields(wordSelect),
    );
  });

  it('adds drawerZeroed through the v1 chain for a stored v1 roundEnd room', () => {
    const state = roundEndState();
    const legacy = downgradeToV1(state);
    const phase = legacy.phase as Record<string, unknown>;
    delete phase.drawerZeroed;
    const migrated = migratePersistedDrawGuessState(legacy);
    if (migrated.phase.kind !== 'roundEnd') throw new Error('phase');
    expect(migrated.phase.drawerZeroed).toBe(false);
    expect(migrated).toEqual(withoutV5Fields(state));
  });

  it('keeps a drawerZeroed value a v2 document already carries', () => {
    const state = zeroedRoundEndState();
    const raw = stripV4Fields(JSON.parse(JSON.stringify(state)) as Record<string, unknown>);
    raw.stateVersion = 2;
    const migrated = migratePersistedDrawGuessState(raw);
    if (migrated.phase.kind !== 'roundEnd') throw new Error('phase');
    expect(migrated.phase.drawerZeroed).toBe(true);
    expect(migrated).toEqual(withoutV5Fields(state));
  });
});

/** Rebuilds the exact document a v3 store would have persisted. */
function downgradeToV3(state: DrawGuessState): Record<string, unknown> {
  const raw = stripV4Fields(JSON.parse(JSON.stringify(state)) as Record<string, unknown>);
  raw.stateVersion = 3;
  return raw;
}

function downgradeToV4(state: DrawGuessState): Record<string, unknown> {
  const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  raw.stateVersion = 4;
  const phase = raw.phase as Record<string, unknown>;
  delete phase.reactionsBySeat;
  delete phase.guessAttemptsBySeat;
  delete phase.guessTimeMsBySeat;
  const turnHistory = raw.turnHistory as Record<string, unknown>[];
  for (const turn of turnHistory) {
    delete turn.reactionsBySeat;
    delete turn.guessAttemptsBySeat;
    delete turn.guessTimeMsBySeat;
  }
  return raw;
}

/** A six-seat turn-0 roundEnd whose guessers landed in the given order with the given scores. */
function guessedRoundEndState(
  guesses: ReadonlyArray<readonly [number, number]>,
  humanCount = 2,
): DrawGuessState {
  let state = dispatch(filledLobby(humanCount), { type: 'drawguess.game.begin' });
  state = drawGuessEngine.evolve(state, {
    type: 'drawguess.word.chosen',
    turnIndex: 0,
    word: '大熊猫',
    pinyinInitials: 'd x m',
    revealOrder: [0, 1, 2],
    phaseStartAt: 2000,
    deadlineAt: 92000,
  });
  guesses.forEach(([seat, guesserScore], index) => {
    state = drawGuessEngine.evolve(state, {
      type: 'drawguess.guess.submitted',
      turnIndex: 0,
      seat,
      text: '大熊猫',
      correct: true,
      at: 3000 + index,
      guesserScore,
      drawerScore: index === 0 ? guesserScore / 2 : 20,
      deadlineAt: 32000,
    });
  });
  state = drawGuessEngine.evolve(state, {
    type: 'drawguess.round.ended',
    turnIndex: 0,
    drawerSeat: 0,
    word: '大熊猫',
    deadlineAt: 100000,
  });
  return drawGuessEngine.normalize(state);
}

/** Ends the game right after a turn-0 roundEnd that filed a drawing. */
function endedWithDrawing(): DrawGuessState {
  let state = guessedRoundEndState([
    [3, 200],
    [1, 140],
  ]);
  state = drawGuessEngine.evolve(state, {
    type: 'drawguess.drawing.reserved',
    turnIndex: 0,
    submissionId: 'drawguess-submission:test',
    entryId: 'drawguess-entry:test',
    authorSeat: 0,
    reservedAt: 4000,
  });
  state = drawGuessEngine.evolve(state, {
    type: 'drawguess.drawing.committed',
    turnIndex: 0,
    pngEntry: {
      objectKey: 'drawguess/creation/3/turn-0/drawguess-submission:test.png',
      contentType: 'image/png',
      width: 1024,
      height: 768,
      byteLength: 2048,
      sha256: 'sha-turn-0',
    },
  });
  state = drawGuessEngine.evolve(state, {
    type: 'drawguess.game.ended',
    totalScores: { ...state.scores },
  });
  return drawGuessEngine.normalize(state);
}

describe('DrawGuess v3 -> v5 migration', () => {
  it('rejects a stored v3 state in the strict parser and adds an empty history on migrate', () => {
    expect(DRAWGUESS_STATE_VERSION).toBe(5);
    for (const state of [
      filledLobby(),
      dispatch(filledLobby(), { type: 'drawguess.game.begin' }),
    ]) {
      const legacy = downgradeToV3(state);
      expect(() => parseDrawGuessState(legacy)).toThrow('DrawGuessState.stateVersion');
      const migrated = migratePersistedDrawGuessState(legacy);
      expect(migrated.stateVersion).toBe(5);
      expect(migrated.turnHistory).toEqual([]);
      expect(migrated).toEqual(withoutV5Fields(state));
    }
  });

  it('rebuilds the roundEnd guess order from round scores, fastest first', () => {
    const state = guessedRoundEndState([
      [3, 200],
      [1, 140],
      [5, 60],
    ]);
    if (state.phase.kind !== 'roundEnd') throw new Error('phase');
    expect(state.phase.guessedSeats).toEqual([3, 1, 5]);
    expect(migratePersistedDrawGuessState(downgradeToV3(state))).toEqual(withoutV5Fields(state));
  });

  it('orders guessers with equal round scores by seat', () => {
    const state = guessedRoundEndState([
      [4, 180],
      [5, 150],
      [2, 150],
      [1, 60],
    ]);
    if (state.phase.kind !== 'roundEnd') throw new Error('phase');
    expect(state.phase.guessedSeats).toEqual([4, 5, 2, 1]);
    const migrated = migratePersistedDrawGuessState(downgradeToV3(state));
    expect(migrated).toEqual(
      withoutV5Fields({
        ...state,
        phase: { ...state.phase, guessedSeats: [4, 2, 5, 1] },
      }),
    );
  });

  it('migrates a stored v3 ended room to an empty history', () => {
    const state = endedWithDrawing();
    expect(state.turnHistory).toHaveLength(1);
    const migrated = migratePersistedDrawGuessState(downgradeToV3(state));
    expect(migrated).toEqual(withoutV5Fields({ ...state, turnHistory: [] }));
  });

  it('reaches v5 from stored v1 and v2 roundEnd rooms', () => {
    const state = guessedRoundEndState([
      [3, 200],
      [1, 140],
      [5, 60],
    ]);
    const v1 = downgradeToV1(state);
    delete (v1.phase as Record<string, unknown>).drawerZeroed;
    expect(migratePersistedDrawGuessState(v1)).toEqual(withoutV5Fields(state));
    expect(migratePersistedDrawGuessState(downgradeToV2(state))).toEqual(withoutV5Fields(state));
  });

  it('passes a current document with its history through unchanged', () => {
    const state = endedWithDrawing();
    expect(migratePersistedDrawGuessState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('migrates v4 closed rounds with empty reactions and unknown attempt facts', () => {
    const state = endedWithDrawing();
    const legacy = downgradeToV4(state);
    expect(() => parseDrawGuessState(legacy)).toThrow('DrawGuessState.stateVersion');
    const migrated = migratePersistedDrawGuessState(legacy);
    expect(migrated.phase).toMatchObject({ kind: 'ended' });
    expect(migrated.turnHistory[0]).toMatchObject({ reactionsBySeat: {} });
    expect(migrated.turnHistory[0]).not.toHaveProperty('guessAttemptsBySeat');
    expect(migrated.turnHistory[0]).not.toHaveProperty('guessTimeMsBySeat');
  });

  it('retains accepted-attempt source data in v4 active drawings for later closure', () => {
    let active = dispatch(filledLobby(), { type: 'drawguess.game.begin' });
    active = drawGuessEngine.evolve(active, {
      type: 'drawguess.word.chosen',
      turnIndex: 0,
      word: '大熊猫',
      pinyinInitials: 'd x m',
      revealOrder: [0, 1, 2],
      phaseStartAt: 2000,
      deadlineAt: 92000,
    });
    active = drawGuessEngine.evolve(active, {
      type: 'drawguess.guess.submitted',
      turnIndex: 0,
      seat: 1,
      text: 'not it',
      correct: false,
      at: 4000,
      guesserScore: 0,
      drawerScore: 0,
      deadlineAt: 92000,
    });
    active = drawGuessEngine.evolve(active, {
      type: 'drawguess.guess.submitted',
      turnIndex: 0,
      seat: 2,
      text: '大熊猫',
      correct: true,
      at: 7000,
      guesserScore: 200,
      drawerScore: 100,
      deadlineAt: 32000,
    });
    const migrated = migratePersistedDrawGuessState(downgradeToV4(active));
    if (migrated.phase.kind !== 'drawing') throw new Error('phase');
    expect(migrated.phase.reactionsBySeat).toEqual({});
    const closed = drawGuessEngine.evolve(migrated, {
      type: 'drawguess.round.ended',
      turnIndex: 0,
      drawerSeat: 0,
      word: '大熊猫',
      deadlineAt: 100000,
    });
    if (closed.phase.kind !== 'roundEnd') throw new Error('phase');
    expect(closed.phase.guessAttemptsBySeat).toEqual({ 1: 1, 2: 1 });
    expect(closed.phase.guessTimeMsBySeat).toEqual({ 2: 5000 });
    expect(JSON.stringify(closed.phase)).not.toContain('not it');
  });

  it('excludes legacy unknown timing from the completion average denominator while retaining known guessed rounds', () => {
    let state = migratePersistedDrawGuessState(downgradeToV4(guessedRoundEndState([[1, 200]], 4)));
    for (let closedTurn = 0; closedTurn < 12; closedTurn += 1) {
      if (state.phase.kind !== 'roundEnd') throw new Error('Expected roundEnd');
      const decision = drawGuessEngine.decide(
        state,
        { type: 'drawguess.phase.settleExpired' },
        {
          ...userContext('host'),
          actor: { kind: 'system', effectId: 'settle' },
          controlledSeat: null,
          nowMs: state.phase.deadlineAt,
        },
      );
      if (decision.kind === 'reject') throw new Error(decision.reason);
      state = decision.events.reduce(drawGuessEngine.evolve, state);
      if (closedTurn === 11) {
        expect(state.phase.kind).toBe('ended');
        expect(decision.effects).toHaveLength(1);
        const completion = decision.effects.find(
          (effect) => effect.type === 'drawguess.game.completed',
        );
        const payload = drawGuessCompletionPayloadSchema.parse(completion?.payload);
        expect(payload.completionVersion).toBe(2);
        expect(payload.stats.find((fact) => fact.userId === 'alice')).toMatchObject({
          userId: 'alice',
          guessAttempts: 1,
          guessRounds: 10,
          guessedRounds: 2,
          guessTimeMs: 2000,
          guessTimedRounds: 1,
        });
        break;
      }
      if (state.phase.kind !== 'wordSelect') throw new Error('Expected wordSelect');
      const startAt = 200000 + state.turnIndex * 100000;
      const drawerSeat = state.phase.drawerSeat;
      state = drawGuessEngine.evolve(state, {
        type: 'drawguess.word.chosen',
        turnIndex: state.turnIndex,
        word: '大熊猫',
        pinyinInitials: 'd x m',
        revealOrder: [0, 1, 2],
        phaseStartAt: startAt,
        deadlineAt: startAt + 90000,
      });
      if (state.turnIndex === 11) {
        state = drawGuessEngine.evolve(state, {
          type: 'drawguess.guess.submitted',
          turnIndex: 11,
          seat: 1,
          text: '大熊猫',
          correct: true,
          at: startAt + 2000,
          guesserScore: 200,
          drawerScore: 100,
          deadlineAt: startAt + 30000,
        });
      }
      state = drawGuessEngine.evolve(state, {
        type: 'drawguess.round.ended',
        turnIndex: state.turnIndex,
        drawerSeat,
        word: '大熊猫',
        deadlineAt: startAt + 100000,
      });
    }
  });
});

describe('DrawGuess v5 turn history codec', () => {
  function corrupt(
    state: DrawGuessState,
    edit: (raw: Record<string, unknown>, record: Record<string, unknown>) => void,
  ): Record<string, unknown> {
    const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    const records = raw.turnHistory as Record<string, unknown>[];
    edit(raw, records[0] ?? {});
    return raw;
  }

  it('freezes the closed turn with its guess order, scores and filed drawing', () => {
    const state = endedWithDrawing();
    expect(state.turnHistory).toEqual([
      {
        turnIndex: 0,
        drawerSeat: 0,
        word: '大熊猫',
        guessedSeats: [3, 1],
        reactionsBySeat: {},
        guessAttemptsBySeat: { 3: 1, 1: 1 },
        guessTimeMsBySeat: { 3: 1000, 1: 1001 },
        roundScores: { 0: 120, 1: 140, 3: 200 },
        drawerZeroed: false,
        entryId: 'drawguess-entry:test',
        pngEntry: {
          objectKey: 'drawguess/creation/3/turn-0/drawguess-submission:test.png',
          contentType: 'image/png',
          width: 1024,
          height: 768,
          byteLength: 2048,
          sha256: 'sha-turn-0',
        },
      },
    ]);
    expect(parseDrawGuessState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('rejects a history in the lobby', () => {
    const ended = endedWithDrawing();
    const raw = JSON.parse(JSON.stringify(filledLobby())) as Record<string, unknown>;
    raw.turnHistory = JSON.parse(JSON.stringify(ended.turnHistory));
    expect(() => parseDrawGuessState(raw)).toThrow('Invalid DrawGuess state: turn history');
  });

  it.each([
    [
      'a drawing without its entry id',
      (_raw: Record<string, unknown>, record: Record<string, unknown>) => {
        record.entryId = null;
      },
    ],
    [
      'an entry id without its drawing',
      (_raw: Record<string, unknown>, record: Record<string, unknown>) => {
        record.pngEntry = null;
      },
    ],
    [
      'a record that is not the last closed turn',
      (_raw: Record<string, unknown>, record: Record<string, unknown>) => {
        record.turnIndex = 1;
      },
    ],
    [
      'a drawer that does not match the queue',
      (_raw: Record<string, unknown>, record: Record<string, unknown>) => {
        record.drawerSeat = 1;
      },
    ],
    [
      'a guesser without a round score',
      (_raw: Record<string, unknown>, record: Record<string, unknown>) => {
        record.guessedSeats = [3, 1, 2];
      },
    ],
    [
      'a scored guesser missing from the guess order',
      (_raw: Record<string, unknown>, record: Record<string, unknown>) => {
        record.guessedSeats = [3];
      },
    ],
    [
      'a duplicated closed turn',
      (raw: Record<string, unknown>, record: Record<string, unknown>) => {
        raw.turnHistory = [record, record];
      },
    ],
  ])('rejects %s', (_label, edit) => {
    expect(() => parseDrawGuessState(corrupt(endedWithDrawing(), edit))).toThrow(
      'Invalid DrawGuess state: turn history',
    );
  });

  it('rejects a roundEnd whose guess order disagrees with its round scores', () => {
    const state = guessedRoundEndState([
      [3, 200],
      [1, 140],
    ]);
    const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    (raw.phase as Record<string, unknown>).guessedSeats = [3];
    expect(() => parseDrawGuessState(raw)).toThrow(
      'Invalid DrawGuess state: roundEnd guessed seats',
    );
  });
});
