import { createEngineSession } from '../../../platform/engine/__tests__/engineSession';
import { SPOTMATCH_CARD_TYPES } from '../domain/cards';
import { SPOTMATCH_REASONS } from '../domain/decision';
import { projectSpotmatchStateForUser } from '../domain/visibility';
import { spotmatchEngine } from '../engine';
import { migratePersistedSpotmatchState, parseSpotmatchState } from '../state/parseState';
import {
  DEFAULT_SPOTMATCH_CONFIG,
  SPOTMATCH_SUCCESS_PAUSE_MS,
  type SpotmatchState,
} from '../state/types';

function game(count = 4, bots = 0, hostSeated = true, cardsPerPlayer = 8) {
  const session = createEngineSession(spotmatchEngine, {
    config: { ...DEFAULT_SPOTMATCH_CONFIG, numberOfPlayers: count, cardsPerPlayer },
    parse: parseSpotmatchState,
  });
  for (let seat = 0; seat < count - bots; seat++) {
    session.send(
      { type: 'room.seat.take', seat, profile: { displayName: `玩家${seat}` } },
      seat === 0 && hostSeated ? 'host' : `u${seat}`,
    );
  }
  if (bots > 0) session.send({ type: 'room.seat.fillBots' });
  session.send({ type: 'spotmatch.game.begin' });
  return session;
}

function claim(state: SpotmatchState, seat: number, wrong = false) {
  const round = state.round;
  const top = round?.players.find((player) => player.seat === seat)?.top;
  if (round == null || top == null) throw new Error('Missing test hand');
  const symbolId = top.symbols.find((symbol) => round.central.symbols.includes(symbol) !== wrong);
  if (symbolId === undefined) throw new Error('Missing test symbol');
  return {
    type: 'spotmatch.card.claim' as const,
    roundId: round.roundId,
    centralInstanceId: round.central.instanceId,
    topInstanceId: top.instanceId,
    symbolId,
  };
}

describe('Spotmatch finite projective plane and dynamic play', () => {
  it('deals every supported player count without sharing a current type', () => {
    for (let count = 2; count <= 20; count++) {
      const round = game(count).state.round!;
      expect(round.players).toHaveLength(count);
      expect(round.players.reduce((sum, player) => sum + player.remaining, 0)).toBe(count * 8);
      expect(
        new Set([round.central.typeId, ...round.players.map((player) => player.top!.typeId)]).size,
      ).toBe(count + 1);
    }
  });

  it('checks all 1596 distinct pairs, eight unique points on every type', () => {
    expect(SPOTMATCH_CARD_TYPES).toHaveLength(57);
    let pairs = 0;
    for (const [index, card] of SPOTMATCH_CARD_TYPES.entries()) {
      expect(card).toHaveLength(8);
      expect(new Set(card).size).toBe(8);
      for (const other of SPOTMATCH_CARD_TYPES.slice(index + 1)) {
        expect(card.filter((symbol) => other.includes(symbol))).toHaveLength(1);
        pairs++;
      }
    }
    expect(pairs).toBe(1596);
  });

  it('plays 140 claims with 20 players, keeping all other hands byte-identical', () => {
    const session = game(20);
    const instances = new Set<string>();
    for (let turn = 0; turn < 140; turn++) {
      const seat = turn % 20;
      const before = session.state.round!;
      instances.add(before.central.instanceId);
      const otherHands = before.players
        .filter((player) => player.seat !== seat)
        .map((player) => player.top);
      session.send(claim(session.state, seat), seat === 0 ? 'host' : `u${seat}`);
      session.advance(SPOTMATCH_SUCCESS_PAUSE_MS);
      const after = session.state.round!;
      expect(
        after.players.filter((player) => player.seat !== seat).map((player) => player.top),
      ).toEqual(otherHands);
      const types = [after.central.typeId, ...after.players.map((player) => player.top!.typeId)];
      expect(new Set(types).size).toBe(21);
    }
    expect(instances.size).toBe(140);
    expect(session.state.phase.kind).toBe('playing');
    expect(new Set(session.state.round!.symbolMap).size).toBe(57);
  });

  it('rejects concurrent stale central before checking correctness, without mutation or penalty', () => {
    const session = game();
    const loser = claim(session.state, 1, true);
    session.send(claim(session.state, 0));
    const before = session.state;
    session.expectReject(loser, SPOTMATCH_REASONS.stale, 'u1');
    expect(session.state).toBe(before);
    expect(session.state.round!.players[1]!.mistakes).toBe(0);
  });

  it('does not reinterpret a stale claim even when its symbol also matches the new central', () => {
    const session = game(20);
    const claims = session.state.round!.players.map((player) => ({
      seat: player.seat,
      command: claim(session.state, player.seat),
    }));
    const winner = claims.find((entry, index) =>
      claims.slice(index + 1).some((other) => other.command.symbolId === entry.command.symbolId),
    )!;
    const loser = claims.find(
      (entry) => entry.seat !== winner.seat && entry.command.symbolId === winner.command.symbolId,
    )!;
    session.send(winner.command, winner.seat === 0 ? 'host' : `u${winner.seat}`);
    expect(session.state.round!.central.symbols).toContain(loser.command.symbolId);
    session.expectReject(
      loser.command,
      SPOTMATCH_REASONS.stale,
      loser.seat === 0 ? 'host' : `u${loser.seat}`,
    );
    expect(session.state.round!.players[loser.seat]!.mistakes).toBe(0);
  });

  it('never accepts an old instance after its mathematical type recurs', () => {
    const session = game(20);
    const old = claim(session.state, 0);
    const oldType = session.state.round!.central.typeId;
    let recurred = false;
    for (let turn = 0; turn < 140; turn++) {
      const seat = turn % 20;
      session.send(claim(session.state, seat), seat === 0 ? 'host' : `u${seat}`);
      session.advance(SPOTMATCH_SUCCESS_PAUSE_MS);
      if (session.state.round!.central.typeId === oldType) {
        recurred = true;
        session.expectReject(old, SPOTMATCH_REASONS.stale);
        break;
      }
    }
    expect(recurred).toBe(true);
  });

  it('commits wrong outcomes, counts once per attempt, and unlocks at exactly 1000ms', () => {
    const session = game();
    const wrong = claim(session.state, 0, true);
    const decision = session.decide(wrong);
    expect(decision.kind === 'commit' && decision.outcome).toEqual({
      kind: 'domainRejected',
      reason: SPOTMATCH_REASONS.wrong,
    });
    session.send(wrong);
    expect(session.state.round!.players[0]!.mistakes).toBe(1);
    session.expectReject(wrong, SPOTMATCH_REASONS.cooldown);
    session.advance(999);
    session.expectReject(claim(session.state, 0), SPOTMATCH_REASONS.cooldown);
    session.advance(1);
    session.send(claim(session.state, 0));
    expect(session.state.round!.players[0]).toMatchObject({
      mistakes: 1,
      correct: 1,
      lockedUntil: 0,
    });
    session.advance(SPOTMATCH_SUCCESS_PAUSE_MS);
    session.send(claim(session.state, 0));
    expect(session.state.round!.players[0]!.correct).toBe(2);
  });

  it('validates seat and IDs before wrong-symbol interpretation', () => {
    const session = game();
    const command = claim(session.state, 0, true);
    expect(session.decide(command, 'spectator').kind).toBe('reject');
    expect(session.decide(command, 'u1', 0).kind).toBe('reject');
    session.expectReject({ ...command, roundId: 'old', symbolId: -1 }, SPOTMATCH_REASONS.stale);
    session.expectReject({ ...command, symbolId: -1 }, SPOTMATCH_REASONS.symbol);
    expect(session.state.round!.players.every((player) => player.mistakes === 0)).toBe(true);
  });
});

describe('Spotmatch natural completion, privacy and settlement', () => {
  it('restarts atomically without rewarding an unfinished game and rejects outdated confirmations', () => {
    const session = game(2, 0, true, 5);
    const restart = {
      type: 'spotmatch.game.restart' as const,
      gameSequence: session.state.gameSequence,
      expectedPhase: 'playing' as const,
    };
    const { roster, config } = session.state;
    expect(session.decide(restart, 'u1').kind).toBe('reject');
    session.send(claim(session.state, 0));
    session.send(restart);
    expect(session.state).toMatchObject({ phase: { kind: 'lobby' }, round: null, roster, config });
    expect(session.effects).toEqual([]);
    session.send({ type: 'spotmatch.game.begin' });
    session.expectReject(restart, SPOTMATCH_REASONS.staleRestart);

    const priorPlayingRestart = { ...restart, gameSequence: session.state.gameSequence };
    for (let index = 0; index < 5; index++) {
      session.send(claim(session.state, 0));
      session.advance(SPOTMATCH_SUCCESS_PAUSE_MS);
    }
    session.expectReject(priorPlayingRestart, SPOTMATCH_REASONS.staleRestart);
    expect(session.effects).toHaveLength(1);
    session.send({ ...priorPlayingRestart, expectedPhase: 'ended' });
    expect(session.state.phase.kind).toBe('lobby');
    expect(session.effects).toHaveLength(1);
  });

  it.each([5, 8, 10, 15])(
    'ends exactly after the configured %i cards, without a timer',
    (cardsPerPlayer) => {
      const session = game(2, 0, true, cardsPerPlayer);
      session.advance(24 * 60 * 60 * 1000);
      for (let index = 0; index < cardsPerPlayer; index++) {
        session.send(claim(session.state, 0));
        session.advance(SPOTMATCH_SUCCESS_PAUSE_MS);
      }
      expect(session.state.phase.kind).toBe('ended');
      expect(session.state.round!.players[0]).toMatchObject({
        remaining: 0,
        correct: cardsPerPlayer,
        top: null,
      });
    },
  );

  it('first-empty wins immediately, ranks ties, freezes recipient facts, and cannot finish twice', () => {
    const session = game();
    session.send(claim(session.state, 1), 'u1');
    for (let index = 0; index < 8; index++) {
      session.advance(SPOTMATCH_SUCCESS_PAUSE_MS);
      session.send(claim(session.state, 0));
    }
    expect(session.state.phase.kind).toBe('ended');
    expect(session.state.round!.winnerSeat).toBe(0);
    expect(session.effects).toHaveLength(1);
    expect(session.effects[0]!.payload).toMatchObject({
      completionVersion: 2,
      participantUserIds: ['host', 'u1'],
      stats: [
        { userId: 'host', gamesPlayed: 1, wins: 1, correctCards: 8, mistakes: 0 },
        { userId: 'u1', gamesPlayed: 1, wins: 0, correctCards: 1, mistakes: 0 },
      ],
    });
    expect(
      session.decide({
        type: 'spotmatch.card.claim',
        roundId: 'x',
        centralInstanceId: 'x',
        topInstanceId: 'x',
        symbolId: 0,
      }).kind,
    ).toBe('reject');
    expect(session.decide({ type: 'spotmatch.game.begin' }).kind).toBe('reject');
    session.send({
      type: 'spotmatch.game.restart',
      gameSequence: session.state.gameSequence,
      expectedPhase: 'ended',
    });
    session.send({ type: 'spotmatch.game.begin' });
    expect(session.state.round!.players.every((player) => player.correct === 0)).toBe(true);
    expect(session.state.round!.roundId).toBe('spotmatch:game:2');
  });

  it('counts anonymous humans before worker registration filtering; does not reassign the winner', () => {
    const session = game(2);
    session.send(claim(session.state, 1), 'u1');
    for (let index = 0; index < 8; index++) {
      session.advance(SPOTMATCH_SUCCESS_PAUSE_MS);
      session.send(claim(session.state, 0));
    }
    const payload = session.effects[0]!.payload;
    expect('stats' in payload && payload.stats.find((fact) => fact.userId === 'u1')?.wins).toBe(0);
  });

  it('any bot makes the frozen round test-only; host takeover cannot act for another human', () => {
    const session = game(4, 1);
    expect(session.decide(claim(session.state, 1), 'host', 1).kind).toBe('reject');
    for (let index = 0; index < 8; index++) {
      session.send(claim(session.state, 3), 'host', 3);
      session.advance(SPOTMATCH_SUCCESS_PAUSE_MS);
    }
    expect(session.state.phase.kind).toBe('ended');
    expect(session.effects).toEqual([]);
  });

  it('supports an unseated host and never discloses other human tops, including to host', () => {
    const session = game(4, 1, false);
    const host = parseSpotmatchState(projectSpotmatchStateForUser(session.state, 'host'));
    expect(
      host.round!.players.filter((player) => player.top !== null).map((player) => player.seat),
    ).toEqual([3]);
    const user = parseSpotmatchState(projectSpotmatchStateForUser(session.state, 'u1'));
    expect(
      user.round!.players.filter((player) => player.top !== null).map((player) => player.seat),
    ).toEqual([1]);
    expect(
      projectSpotmatchStateForUser(session.state, 'spectator').round!.players.every(
        (player) => player.top === null,
      ),
    ).toBe(true);
    expect(session.state.round!.players.every((player) => player.top !== null)).toBe(true);
  });

  it('round-trips persisted current state and rejects malformed/unsupported states', () => {
    const session = game();
    expect(migratePersistedSpotmatchState(JSON.parse(JSON.stringify(session.state)))).toEqual(
      session.state,
    );
    expect(() => migratePersistedSpotmatchState({ ...session.state, stateVersion: 0 })).toThrow();
    expect(() => parseSpotmatchState({ ...session.state, unexpected: true })).toThrow();
    expect(() =>
      parseSpotmatchState({
        ...session.state,
        round: { ...session.state.round, symbolMap: Array(57).fill(0) },
      }),
    ).toThrow();
  });

  it('pauses everyone for exactly three seconds after success, with stale taking precedence', () => {
    const session = game();
    const stale = claim(session.state, 1, true);
    session.send(claim(session.state, 0));
    session.expectReject(stale, SPOTMATCH_REASONS.stale, 'u1');
    session.advance(1000);
    session.expectReject(claim(session.state, 1), SPOTMATCH_REASONS.paused, 'u1');
    session.advance(1999);
    session.expectReject(claim(session.state, 1), SPOTMATCH_REASONS.paused, 'u1');
    session.expectReject(claim(session.state, 0), SPOTMATCH_REASONS.paused);
    expect(session.state.round!.players.every((player) => player.mistakes === 0)).toBe(true);
    session.advance(1);
    session.send(claim(session.state, 1), 'u1');
    expect(session.state.round!.players[1]!.correct).toBe(1);
  });

  it.each(['central', 'own'])(
    'penalizes a nonmatching symbol on the %s card exactly once',
    (side) => {
      const session = game();
      const round = session.state.round!;
      const top = round.players[0]!.top!;
      const source = side === 'central' ? round.central : top;
      const other = side === 'central' ? top : round.central;
      const symbolId = source.symbols.find((symbol) => !other.symbols.includes(symbol))!;
      const command = { ...claim(session.state, 0), symbolId };
      session.send(command);
      expect(session.state.round!.players[0]).toMatchObject({
        mistakes: 1,
        lockedUntil: session.now() + 1000,
        lastMistake: {
          symbolId,
          centralInstanceId: command.centralInstanceId,
          topInstanceId: command.topInstanceId,
        },
      });
      session.expectReject(command, SPOTMATCH_REASONS.cooldown);
      session.send(claim(session.state, 1), 'u1');
      expect(session.state.round!.players[1]!.correct).toBe(1);
    },
  );

  it('rejects an alien known symbol outside the union, with no penalty', () => {
    const session = game();
    const round = session.state.round!;
    const symbolId = Array.from({ length: 200 }, (_, value) => value).find(
      (symbol) =>
        !round.central.symbols.includes(symbol) && !round.players[0]!.top!.symbols.includes(symbol),
    )!;
    session.expectReject({ ...claim(session.state, 0), symbolId }, SPOTMATCH_REASONS.symbol);
    expect(session.state.round!.players[0]!.mistakes).toBe(0);
  });

  it('migrates active v1 rooms without losing hands or scores', () => {
    const session = game();
    const { success: _success, ...round } = session.state.round!;
    const legacy = {
      ...session.state,
      stateVersion: 1,
      round: {
        ...round,
        players: round.players.map(({ lastMistake: _mistake, ...player }) => player),
      },
    };
    expect(migratePersistedSpotmatchState(legacy)).toEqual(session.state);
    expect(() => parseSpotmatchState(legacy)).toThrow();
  });
});
