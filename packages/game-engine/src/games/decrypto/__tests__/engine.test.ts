/** Exercises Decrypto setup, authorization, privacy, and round progression through the engine. */

import { createEngineSession } from '../../../platform/engine/__tests__/engineSession';
import { REASON_SYSTEM_ACTOR_REQUIRED } from '../../../platform/protocol/reasons';
import { DECRYPTO_REASONS } from '../domain/decision';
import { getDecryptoViewModel, projectDecryptoStateForUser } from '../domain/visibility';
import { decryptoEngine } from '../engine';
import { parseDecryptoState } from '../state/parseState';
import {
  DECRYPTO_REVEAL_INTERVAL_MS,
  type DecryptoConfig,
  DEFAULT_DECRYPTO_CONFIG,
} from '../state/types';

function createSession(configOverrides: Partial<DecryptoConfig> = {}) {
  const config = { ...DEFAULT_DECRYPTO_CONFIG, ...configOverrides };
  const session = createEngineSession(decryptoEngine, {
    config,
    parse: parseDecryptoState,
  });
  const userForSeat = (seat: number) => (seat === 0 ? 'host' : `user-${seat}`);
  for (let seat = 0; seat < config.numberOfPlayers; seat += 1) {
    session.send(
      { type: 'room.seat.take', seat, profile: { displayName: `玩家${seat + 1}` } },
      userForSeat(seat),
    );
  }
  return { session, userForSeat };
}

function startPreparedGame(numberOfPlayers = 4) {
  const fixture = createSession({ numberOfPlayers });
  const { session } = fixture;
  session.send({ type: 'decrypto.game.begin' });
  expect(session.state.phase.kind).toBe('teams');
  session.send({ type: 'decrypto.teams.confirm' });
  const selectionEffect = session.effects.find((effect) => effect.type === 'decrypto.words.select');
  if (selectionEffect?.type !== 'decrypto.words.select')
    throw new Error('Missing word selection effect');
  session.sendAs(
    {
      type: 'decrypto.words.selected',
      requestId: selectionEffect.payload.requestId,
      keywords: {
        blue: ['苹果', '桥梁', '火山', '钢琴'],
        purple: ['月亮', '雨伞', '沙漠', '冰箱'],
      },
    },
    session.systemContext('words'),
  );
  if (session.state.phase.kind !== 'playing')
    throw new Error('Game did not start after word selection');
  expect(session.state.phase.game.encryptors?.blue).not.toBeNull();
  expect(session.state.phase.game.encryptors?.purple).not.toBeNull();
  return fixture;
}

function startRevealingGame() {
  const fixture = startPreparedGame();
  const { session, userForSeat } = fixture;
  if (session.state.phase.kind !== 'playing') throw new Error('Expected gameplay');
  const game = session.state.phase.game;
  for (const team of ['blue', 'purple'] as const) {
    const encryptor = game.encryptors?.[team];
    if (encryptor === null || encryptor === undefined) throw new Error('Missing encryptor');
    session.send(
      { type: 'decrypto.clues.submit', clues: ['线索甲', '线索乙', '线索丙'] },
      userForSeat(encryptor),
    );
  }
  for (const team of ['blue', 'purple'] as const) {
    const decoder = Object.entries(game.assignments).find(
      ([seat, assignedTeam]) => assignedTeam === team && Number(seat) !== game.encryptors?.[team],
    )?.[0];
    if (decoder === undefined) throw new Error('Missing decoder');
    session.send(
      { type: 'decrypto.guess.submit', kind: 'decode', guess: game.codes[team] },
      userForSeat(Number(decoder)),
    );
  }
  const effect = session.effects.at(-1);
  if (effect?.type !== 'decrypto.reveal.due') throw new Error('Missing reveal timer');
  return { ...fixture, effect };
}

describe('Decrypto team setup', () => {
  it('starts with balanced teams and does not allow returning to the lobby', () => {
    const { session } = createSession();
    session.send({ type: 'decrypto.game.begin' });
    if (session.state.phase.kind !== 'teams') throw new Error('Expected team setup');
    expect(
      Object.values(session.state.phase.assignments).filter((team) => team === 'blue'),
    ).toHaveLength(3);
    expect(
      Object.values(session.state.phase.assignments).filter((team) => team === 'purple'),
    ).toHaveLength(3);
    expect(session.state.phase.encryptors).toEqual({ blue: null, purple: null });
    session.expectReject(
      { type: 'decrypto.teams.move', seat: 1 },
      DECRYPTO_REASONS.notHostTeams,
      'user-1',
    );
    session.expectReject(
      { type: 'decrypto.teams.confirm' },
      DECRYPTO_REASONS.notHostTeams,
      'user-1',
    );
    session.expectReject(
      { type: 'decrypto.game.restart', gameSequence: session.state.gameSequence, wasEnded: false },
      DECRYPTO_REASONS.phase,
    );
    expect(session.state.phase.kind).toBe('teams');
    expect(session.state.xpSettled).toBe(false);
    expect(session.effects).toEqual([]);
  });

  it('lets only the host assign fixed encryptors and requires both before preparation', () => {
    const { session } = createSession({ numberOfPlayers: 4, encryptorMode: 'fixed' });
    session.send({ type: 'decrypto.game.begin' });
    if (session.state.phase.kind !== 'teams') throw new Error('Expected team setup');
    const assignments = session.state.phase.assignments;
    const blueSeat = Number(Object.entries(assignments).find(([, team]) => team === 'blue')?.[0]);
    const purpleSeat = Number(
      Object.entries(assignments).find(([, team]) => team === 'purple')?.[0],
    );
    session.expectReject({ type: 'decrypto.teams.confirm' }, DECRYPTO_REASONS.invalidTeam);
    session.expectReject(
      { type: 'decrypto.teams.encryptor', team: 'blue', seat: blueSeat },
      DECRYPTO_REASONS.notHostTeams,
      'user-1',
    );
    session.send({ type: 'decrypto.teams.encryptor', team: 'blue', seat: blueSeat });
    session.send({ type: 'decrypto.teams.encryptor', team: 'purple', seat: purpleSeat });
    session.send({ type: 'decrypto.teams.confirm' });
    expect(session.state.phase.kind).toBe('preparing');
  });

  it('requires the preparation request id before accepting the selected words', () => {
    const { session } = createSession();
    session.send({ type: 'decrypto.game.begin' });
    session.send({ type: 'decrypto.teams.confirm' });
    expect(
      session.decideAs(
        {
          type: 'decrypto.words.selected',
          requestId: 'stale',
          keywords: { blue: ['a', 'b', 'c', 'd'], purple: ['e', 'f', 'g', 'h'] },
        },
        session.systemContext('words'),
      ),
    ).toEqual({ kind: 'reject', reason: DECRYPTO_REASONS.stale });
  });
});

describe('Decrypto round flow', () => {
  it('keeps submitted clues visible to their own team while hiding them from the opponent', () => {
    const { session, userForSeat } = startPreparedGame();
    if (session.state.phase.kind !== 'playing') throw new Error('Expected gameplay');
    const game = session.state.phase.game;
    const encryptor = game.encryptors?.blue;
    if (encryptor === undefined) throw new Error('Missing blue encryptor');
    const clues = ['红果', '跨河', '喷发'] as const;
    session.send({ type: 'decrypto.clues.submit', clues }, userForSeat(encryptor));
    for (const [seat, team] of Object.entries(game.assignments)) {
      const projected = getDecryptoViewModel(session.state, Number(seat));
      expect(projected.game?.clues.blue).toEqual(team === 'blue' ? clues : null);
      expect(projected.game?.clues.purple).toBeNull();
    }
    expect(getDecryptoViewModel(session.state, null).game?.clues.blue).toBeNull();
  });

  it('reveals the opposing interception against the current team, not that team’s own interception', () => {
    const { session } = startPreparedGame();
    if (session.state.phase.kind !== 'playing') throw new Error('Expected gameplay');
    const state = {
      ...session.state,
      phase: {
        kind: 'playing',
        game: {
          ...session.state.phase.game,
          round: 2,
          step: 'reveal',
          revealSequence: ['intercept', 'decode', 'code', 'intercept', 'decode', 'code'],
          revealIndex: 0,
          intercepted: { blue: [1, 2, 3], purple: [4, 3, 2] },
        },
      },
    } as const;
    const projected = getDecryptoViewModel(state, null).game;
    expect(projected?.intercepted.purple).toEqual([4, 3, 2]);
    expect(projected?.intercepted.blue).toBeNull();
  });

  it('requires team encryptors, omits first-round interception, and schedules staged reveal', () => {
    const { session, userForSeat } = startPreparedGame();
    if (session.state.phase.kind !== 'playing') throw new Error('Expected gameplay');
    const initialGame = session.state.phase.game;
    for (const team of ['blue', 'purple'] as const) {
      const encryptor = initialGame.encryptors?.[team];
      if (encryptor === null || encryptor === undefined) throw new Error('Missing encryptor');
      session.send(
        {
          type: 'decrypto.clues.submit',
          clues: [`线索${team}一`, `线索${team}二`, `线索${team}三`],
        },
        userForSeat(encryptor),
      );
    }
    const guessState = session.state;
    if (guessState.phase.kind !== 'playing') throw new Error('Expected gameplay');
    const guessGame = guessState.phase.game;
    expect(guessGame.step).toBe('guess');
    for (const team of ['blue', 'purple'] as const) {
      const encryptor = guessGame.encryptors?.[team];
      if (encryptor === null || encryptor === undefined) throw new Error('Missing encryptor');
      session.expectReject(
        { type: 'decrypto.guess.submit', kind: 'decode', guess: [1, 1, 1] },
        DECRYPTO_REASONS.ineligibleDecoder,
        userForSeat(encryptor),
      );
    }
    const blueDecoder = Object.entries(guessGame.assignments).find(
      ([seat, team]) => team === 'blue' && Number(seat) !== guessGame.encryptors?.blue,
    )?.[0];
    if (blueDecoder === undefined) throw new Error('Missing blue decoder');
    session.expectReject(
      { type: 'decrypto.guess.submit', kind: 'intercept', guess: [1, 2, 3] },
      DECRYPTO_REASONS.invalidGuess,
      userForSeat(Number(blueDecoder)),
    );
    session.expectReject(
      { type: 'decrypto.guess.submit', kind: 'decode', guess: [1, 1, 1] },
      DECRYPTO_REASONS.invalidGuess,
      userForSeat(Number(blueDecoder)),
    );
    for (const team of ['blue', 'purple'] as const) {
      const game = session.state.phase.kind === 'playing' ? session.state.phase.game : null;
      if (game === null || game.encryptors === null) throw new Error('Missing active game');
      const seat = Object.entries(game.assignments).find(
        ([memberSeat, assignedTeam]) =>
          assignedTeam === team && Number(memberSeat) !== game.encryptors?.[team],
      )?.[0];
      if (seat === undefined) throw new Error(`Missing ${team} decoder`);
      session.send(
        { type: 'decrypto.guess.submit', kind: 'decode', guess: game.codes[team] },
        userForSeat(Number(seat)),
      );
    }
    if (session.state.phase.kind !== 'playing') throw new Error('Expected gameplay');
    expect(session.state.phase.game.step).toBe('reveal');
    expect(session.effects.some((effect) => effect.type === 'decrypto.reveal.due')).toBe(true);
  });

  it('distinguishes early and superseded reveal deliveries and advances once at the deadline', () => {
    const { session, effect } = startRevealingGame();
    const command = { type: 'decrypto.reveal.advance', ...effect.payload } as const;
    session.expectReject(command, REASON_SYSTEM_ACTOR_REQUIRED);
    session.setNow(effect.payload.revealAt - 1);
    expect(session.decideAs(command, session.systemContext('early'))).toEqual({
      kind: 'reject',
      reason: DECRYPTO_REASONS.revealEarly,
    });
    session.setNow(effect.payload.revealAt);
    const stalePins = [
      { ...effect.payload, gameSequence: effect.payload.gameSequence + 1 },
      { ...effect.payload, round: effect.payload.round + 1 },
      { ...effect.payload, team: effect.payload.team === 'blue' ? 'purple' : 'blue' },
      { ...effect.payload, revealIndex: effect.payload.revealIndex + 1 },
      { ...effect.payload, revealAt: effect.payload.revealAt + 1 },
    ] as const;
    for (const payload of stalePins) {
      expect(
        session.decideAs(
          { type: 'decrypto.reveal.advance', ...payload },
          session.systemContext('stale'),
        ),
      ).toEqual({ kind: 'reject', reason: DECRYPTO_REASONS.stale });
    }
    session.sendAs(command, session.systemContext('on-time'));
    if (session.state.phase.kind !== 'playing') throw new Error('Expected gameplay');
    expect(session.state.phase.game.revealIndex).toBe(1);
    expect(session.effects.at(-1)).toMatchObject({
      type: 'decrypto.reveal.due',
      payload: {
        revealIndex: 1,
        revealAt: effect.payload.revealAt + DECRYPTO_REVEAL_INTERVAL_MS,
      },
    });
    expect(session.decideAs(command, session.systemContext('replayed'))).toEqual({
      kind: 'reject',
      reason: DECRYPTO_REASONS.stale,
    });
  });

  it('redacts the opposing keywords and unrevealed answers from user snapshots', () => {
    const { session } = startPreparedGame();
    if (session.state.phase.kind !== 'playing') throw new Error('Expected gameplay');
    const game = session.state.phase.game;
    const blueSeat = Number(
      Object.entries(game.assignments).find(
        ([seat, team]) => team === 'blue' && Number(seat) !== game.encryptors?.blue,
      )?.[0],
    );
    const blueUser = blueSeat === 0 ? 'host' : `user-${blueSeat}`;
    const projected = projectDecryptoStateForUser(session.state, blueUser);
    if (projected.phase.kind !== 'playing') throw new Error('Expected projected gameplay');
    expect(projected.phase.game.keywords?.blue).toEqual(['苹果', '桥梁', '火山', '钢琴']);
    expect(projected.phase.game.keywords?.purple).not.toEqual(['月亮', '雨伞', '沙漠', '冰箱']);
    expect(projected.phase.game.codes).toEqual({ blue: [1, 1, 1], purple: [1, 1, 1] });
  });

  it('rotates each team encryptor between rounds in rotating mode', () => {
    const { session, userForSeat } = startPreparedGame();
    if (session.state.phase.kind !== 'playing') throw new Error('Expected gameplay');
    const first = session.state.phase.game;
    for (const team of ['blue', 'purple'] as const) {
      const encryptor = first.encryptors?.[team];
      if (encryptor === null || encryptor === undefined) throw new Error('Missing encryptor');
      session.send(
        { type: 'decrypto.clues.submit', clues: [`${team}甲`, `${team}乙`, `${team}丙`] },
        userForSeat(encryptor),
      );
    }
    for (const team of ['blue', 'purple'] as const) {
      const game = session.state.phase.kind === 'playing' ? session.state.phase.game : null;
      if (game === null || game.encryptors === null) throw new Error('Missing active game');
      const decoder = Object.entries(game.assignments).find(
        ([seat, assignedTeam]) => assignedTeam === team && Number(seat) !== game.encryptors?.[team],
      )?.[0];
      if (decoder === undefined) throw new Error('Missing decoder');
      session.send(
        { type: 'decrypto.guess.submit', kind: 'decode', guess: game.codes[team] },
        userForSeat(Number(decoder)),
      );
    }
    let revealIndex = 0;
    while (session.state.phase.kind === 'playing' && session.state.phase.game.step === 'reveal') {
      const due = session.effects.filter((effect) => effect.type === 'decrypto.reveal.due').at(-1);
      if (due?.type !== 'decrypto.reveal.due') throw new Error('Missing reveal timer');
      session.setNow(due.payload.revealAt);
      session.sendAs(
        { type: 'decrypto.reveal.advance', ...due.payload },
        session.systemContext(`reveal-${revealIndex++}`),
      );
    }
    if (session.state.phase.kind !== 'playing') throw new Error('Expected gameplay');
    expect(session.state.phase.game.step).toBe('continue');
    const previousEncryptors = session.state.phase.game.encryptors;
    if (previousEncryptors === null) throw new Error('Missing encryptors');
    session.send({
      type: 'decrypto.reveal.continue',
      gameSequence: session.state.gameSequence,
    });
    if (session.state.phase.kind !== 'playing') throw new Error('Expected next round');
    const nextEncryptors = session.state.phase.game.encryptors;
    expect(nextEncryptors?.blue).not.toBe(previousEncryptors.blue);
    expect(nextEncryptors?.purple).not.toBe(previousEncryptors.purple);
    expect(session.state.phase.game.round).toBe(2);
  });
});
