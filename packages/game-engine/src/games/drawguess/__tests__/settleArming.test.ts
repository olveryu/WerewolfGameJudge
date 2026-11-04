/**
 * DrawGuess settle arming invariant: every decision that writes a
 * deadline returns exactly one settle.due effect pinned to the
 * evolved phase identity, and every decision that writes no deadline
 * returns none. The pin is compared field by field against the
 * evolved state, never against a hand-computed expectation.
 */

import { describe, expect, it } from 'vitest';

import { createEngineSession } from '../../../platform/engine/__tests__/engineSession';
import type { DrawGuessCommand, DrawGuessPublicCommand } from '../commands/types';
import type { DrawGuessEffect } from '../domain/decision';
import { drawGuessEngine } from '../engine';
import { parseDrawGuessState } from '../state/parseState';
import {
  DEFAULT_DRAWGUESS_CONFIG,
  type DrawGuessState,
  type DrawGuessWordChoice,
} from '../state/types';

const CHOICES: DrawGuessWordChoice[] = [
  { word: '大熊猫', pinyinInitials: 'd x m' },
  { word: '火锅', pinyinInitials: 'h g' },
  { word: '风筝', pinyinInitials: 'f z' },
];

type SettlePin = {
  readonly gameSequence: number;
  readonly phaseRevision: number;
  readonly turnIndex: number;
  readonly deadlineAt: number;
};

/** The pin the evolved state carries for its currently armed deadline. */
function pinOf(state: DrawGuessState): SettlePin {
  const phase = state.phase;
  if (
    (phase.kind !== 'wordSelect' && phase.kind !== 'drawing' && phase.kind !== 'roundEnd') ||
    phase.deadlineAt === null
  ) {
    throw new Error(`Expected an armed deadline, found phase ${phase.kind}`);
  }
  return {
    gameSequence: state.gameSequence,
    phaseRevision: state.phaseRevision,
    turnIndex: state.turnIndex,
    deadlineAt: phase.deadlineAt,
  };
}

function settleEffectsOf(effects: readonly DrawGuessEffect[]) {
  return effects.filter((effect) => effect.type === 'drawguess.settle.due');
}

function createGame() {
  const session = createEngineSession(drawGuessEngine, {
    config: { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 4 },
    parse: parseDrawGuessState,
  });
  const send = (
    command: DrawGuessPublicCommand,
    userId = 'host',
    controlledSeat: number | null = null,
  ) => {
    const before = session.effects.length;
    const state = session.send(command, userId, controlledSeat);
    return { state, effects: session.effects.slice(before) };
  };
  const sendInternal = (command: DrawGuessCommand) => {
    const before = session.effects.length;
    const state = session.sendAs(command, session.systemContext('effect:1'));
    return { state, effects: session.effects.slice(before) };
  };
  const seatUser = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);
  const revision = () => ({
    phaseRevision: session.state.phaseRevision,
    turnIndex: session.state.turnIndex,
  });
  for (let seat = 0; seat < 4; seat += 1) {
    send({ type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } }, seatUser(seat));
  }
  const expireNow = () => {
    const phase = session.state.phase;
    if (
      (phase.kind === 'wordSelect' || phase.kind === 'drawing' || phase.kind === 'roundEnd') &&
      phase.deadlineAt !== null
    ) {
      session.setNow(phase.deadlineAt);
    }
    return send({ type: 'drawguess.phase.expire', ...revision() });
  };
  const settleNow = () => {
    const phase = session.state.phase;
    if (
      (phase.kind === 'wordSelect' || phase.kind === 'drawing' || phase.kind === 'roundEnd') &&
      phase.deadlineAt !== null
    ) {
      session.setNow(phase.deadlineAt);
    }
    return sendInternal({ type: 'drawguess.phase.settleExpired' });
  };
  return {
    get state() {
      return session.state;
    },
    session,
    send,
    sendInternal,
    seatUser,
    revision,
    expireNow,
    settleNow,
    startGame() {
      const begun = send({ type: 'drawguess.game.begin' });
      const dealt = sendInternal({
        type: 'drawguess.words.dealt',
        turnIndex: 0,
        choices: CHOICES,
      });
      return { begun, dealt };
    },
    chooseFirstWord() {
      const drawerSeat =
        session.state.phase.kind === 'wordSelect' ? session.state.phase.drawerSeat : -1;
      const userId = drawerSeat === 0 ? 'host' : `u${drawerSeat}`;
      return send({ type: 'drawguess.word.choose', word: CHOICES[0]!.word, ...revision() }, userId);
    },
    guess(seat: number, text: string) {
      return send({ type: 'drawguess.guess.submit', text, ...revision() }, seatUser(seat));
    },
  };
}

function expectSingleSettle(effects: readonly DrawGuessEffect[], state: DrawGuessState): void {
  const settled = settleEffectsOf(effects);
  expect(settled).toHaveLength(1);
  const effect = settled[0];
  if (effect?.type !== 'drawguess.settle.due') throw new Error('Expected a settle.due effect');
  expect(effect.payload).toEqual(pinOf(state));
}

function expectNoSettle(effects: readonly DrawGuessEffect[]): void {
  expect(settleEffectsOf(effects)).toHaveLength(0);
}

describe('DrawGuess settle arming', () => {
  it('arms no settle on game begin; dealWords arms wordSelect', () => {
    const game = createGame();
    const { begun, dealt } = game.startGame();
    expectNoSettle(begun.effects);
    expectSingleSettle(dealt.effects, game.state);
  });

  it('chooseWord arms drawing with the evolved phaseRevision', () => {
    const game = createGame();
    game.startGame();
    const revisionBefore = game.state.phaseRevision;
    const chosen = game.chooseFirstWord();
    expect(game.state.phase.kind).toBe('drawing');
    expect(game.state.phaseRevision).toBe(revisionBefore + 1);
    expectSingleSettle(chosen.effects, game.state);
  });

  it('wordSelect timeout auto-assign arms drawing through the public expire channel', () => {
    const game = createGame();
    game.startGame();
    const expired = game.expireNow();
    expect(game.state.phase.kind).toBe('drawing');
    expectSingleSettle(expired.effects, game.state);
  });

  it('wordSelect timeout auto-assign arms drawing through the internal settle channel', () => {
    const game = createGame();
    game.startGame();
    const settled = game.settleNow();
    expect(game.state.phase.kind).toBe('drawing');
    expectSingleSettle(settled.effects, game.state);
  });

  it('expiring drawing arms roundEnd through both channels', () => {
    const publicGame = createGame();
    publicGame.startGame();
    publicGame.chooseFirstWord();
    const expired = publicGame.expireNow();
    expect(publicGame.state.phase.kind).toBe('roundEnd');
    expectSingleSettle(expired.effects, publicGame.state);

    const systemGame = createGame();
    systemGame.startGame();
    systemGame.chooseFirstWord();
    const settled = systemGame.settleNow();
    expect(systemGame.state.phase.kind).toBe('roundEnd');
    expectSingleSettle(settled.effects, systemGame.state);
  });

  it('expiring roundEnd advances to the next turn with no new settle (arming lives in dealWords)', () => {
    const game = createGame();
    game.startGame();
    game.chooseFirstWord();
    game.expireNow();
    const advanced = game.expireNow();
    expect(game.state.phase.kind).toBe('wordSelect');
    expect(game.state.turnIndex).toBe(1);
    expectNoSettle(advanced.effects);
    expect(advanced.effects.some((effect) => effect.type === 'drawguess.words.deal')).toBe(true);
    const dealt = game.sendInternal({
      type: 'drawguess.words.dealt',
      turnIndex: 1,
      choices: CHOICES,
    });
    expectSingleSettle(dealt.effects, game.state);
  });

  it('a correct first guess compresses the deadline and re-arms with the compressed deadline', () => {
    const game = createGame();
    game.startGame();
    game.chooseFirstWord();
    const drawingDeadline = pinOf(game.state).deadlineAt;
    game.session.advance(10000);
    const guessed = game.guess(1, '大熊猫');
    const pin = pinOf(game.state);
    expect(pin.deadlineAt).toBeLessThan(drawingDeadline);
    expectSingleSettle(guessed.effects, game.state);
    expect(guessed.effects[0]?.type).toBe('drawguess.settle.due');
  });

  it('a wrong guess writes no settle and leaves the deadline alone', () => {
    const game = createGame();
    game.startGame();
    game.chooseFirstWord();
    const before = pinOf(game.state);
    const guessed = game.guess(1, '还是错');
    expectNoSettle(guessed.effects);
    expect(pinOf(game.state)).toEqual(before);
  });

  it('a correct guess at the compressed floor writes no new settle', () => {
    const game = createGame();
    game.startGame();
    game.chooseFirstWord();
    game.session.advance(10000);
    game.guess(1, '大熊猫');
    const compressed = pinOf(game.state);
    // Second correct guess: remaining time is already at the
    // compressed deadline, so the deadline does not move.
    game.session.setNow(compressed.deadlineAt - 1000);
    const guessed = game.guess(2, '大熊猫');
    expectNoSettle(guessed.effects);
    expect(pinOf(game.state)).toEqual(compressed);
  });

  it('all guessers correct compresses to the 3-second floor and re-arms once', () => {
    const game = createGame();
    game.startGame();
    game.chooseFirstWord();
    game.session.advance(10000);
    game.guess(1, '大熊猫');
    game.session.advance(1000);
    const second = game.guess(2, '大熊猫');
    expectNoSettle(second.effects);
    game.session.advance(1000);
    const third = game.guess(3, '大熊猫');
    const pin = pinOf(game.state);
    expect(pin.deadlineAt).toBe(game.session.now() + 3000);
    expectSingleSettle(third.effects, game.state);
  });

  it('strokes, seats, and config writes arm nothing', () => {
    const lobby = createEngineSession(drawGuessEngine, {
      config: { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 4 },
      parse: parseDrawGuessState,
    });
    const beforeLobby = lobby.effects.length;
    lobby.send({ type: 'room.seat.take', seat: 0, profile: { displayName: 'P0' } }, 'host');
    lobby.send(
      {
        type: 'drawguess.config.update',
        config: { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 4 },
      },
      'host',
    );
    expectNoSettle(lobby.effects.slice(beforeLobby));

    const game = createGame();
    game.startGame();
    game.chooseFirstWord();
    const stroked = game.send(
      {
        type: 'drawguess.stroke.add',
        stroke: {
          id: 's1',
          kind: 'brush',
          color: '#ff0000',
          width: 5,
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.2, y: 0.2 },
          ],
          authorSeat: 0,
        },
        ...game.revision(),
      },
      'host',
    );
    expectNoSettle(stroked.effects);
  });

  it('expiring the last roundEnd ends the game with no settle', () => {
    const game = createGame();
    game.startGame();
    // 8 turns (4 seats x 2 rounds per drawer): drive every turn to
    // roundEnd through expiry, then expire the final roundEnd.
    for (let turn = 0; turn < 8; turn += 1) {
      if (turn > 0) {
        const dealt = game.sendInternal({
          type: 'drawguess.words.dealt',
          turnIndex: turn,
          choices: CHOICES,
        });
        expectSingleSettle(dealt.effects, game.state);
      }
      game.expireNow();
      expect(game.state.phase.kind).toBe('drawing');
      game.expireNow();
      expect(game.state.phase.kind).toBe('roundEnd');
      if (turn < 7) {
        const advanced = game.expireNow();
        expect(game.state.phase.kind).toBe('wordSelect');
        expectNoSettle(advanced.effects);
      }
    }
    const ended = game.expireNow();
    expect(game.state.phase.kind).toBe('ended');
    expectNoSettle(ended.effects);
    expect(ended.effects.some((effect) => effect.type === 'drawguess.game.completed')).toBe(true);
  });
});
