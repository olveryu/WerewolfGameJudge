/** Canonical DrawGuess states for client tests (AU-46): minimal, and played to the end. */

import type {
  DrawGuessCommand,
  DrawGuessState,
  DrawGuessWordChoice,
} from '@game-judge/game-engine/games/drawguess/public';
import {
  DEFAULT_DRAWGUESS_CONFIG,
  drawGuessEngine,
} from '@game-judge/game-engine/games/drawguess/public';

import type { ReviewTestRounds } from './reviewTestRounds';

const ROOM_CODE = 'ABCD';
const HOST_USER_ID = 'host-1';
const SECOND_USER_ID = 'u1';
const GUESS_INTERVAL_MS = 2000;

/** The word each turn's drawer picks, in turn order (a four-seat game has eight turns). */
const TEST_WORDS: readonly DrawGuessWordChoice[] = [
  { word: '大熊猫', pinyinInitials: 'd x m' },
  { word: '火锅', pinyinInitials: 'h g' },
  { word: '风筝', pinyinInitials: 'f z' },
  { word: '长城', pinyinInitials: 'ch ch' },
  { word: '月亮', pinyinInitials: 'y l' },
  { word: '雪人', pinyinInitials: 'x r' },
  { word: '钢琴', pinyinInitials: 'g q' },
  { word: '西瓜', pinyinInitials: 'x g' },
];

/** The human players of `playDrawGuessTestGame`: the host at seat 0, a second player at seat 1. */
export const DRAWGUESS_TEST_PLAYER_NAMES = ['阿杰', '小雨'] as const;

/** One scripted turn of `playDrawGuessTestGame`. */
export interface DrawGuessTestTurn {
  /** Seats that guess the word, in order, two seconds apart from the drawing start. */
  readonly guessers: readonly number[];
  /** Whether the drawer reserves and files a final drawing during roundEnd. */
  readonly filesDrawing: boolean;
}

type CommandContext = Parameters<typeof drawGuessEngine.decide>[2];

/** The engine's initial lobby state for room ABCD, with field overrides. */
export function buildDrawGuessTestState(overrides: Partial<DrawGuessState> = {}): DrawGuessState {
  return {
    ...drawGuessEngine.createInitialState(DEFAULT_DRAWGUESS_CONFIG, {
      roomCode: ROOM_CODE,
      hostUserId: HOST_USER_ID,
      nowMs: 0,
      commandId: 'create',
    }),
    ...overrides,
  };
}

/**
 * Plays a four-seat game through the real engine until it ends. The host
 * sits at seat 0 and a second player at seat 1; bots fill seats 2 and 3
 * and the host acts for them. Turn k's drawer picks the k-th test word
 * (大熊猫, 火锅, 风筝, 长城, 月亮, 雪人, 钢琴, 西瓜); turns past the script pass
 * with no guess and no drawing. Every phase settles at its deadline through
 * the system channel.
 */
export function playDrawGuessTestGame(script: readonly DrawGuessTestTurn[]): DrawGuessState {
  let nowMs = 0;
  let commandNumber = 0;
  let state = drawGuessEngine.createInitialState(
    { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 4 },
    { roomCode: ROOM_CODE, hostUserId: HOST_USER_ID, nowMs, commandId: 'create' },
  );
  const read = (): DrawGuessState => state;
  const execution = () => {
    commandNumber += 1;
    return { nowMs, commandId: `command:${commandNumber}`, randomSeed: `seed:${commandNumber}` };
  };
  const apply = (command: DrawGuessCommand, context: CommandContext) => {
    const decision = drawGuessEngine.decide(state, command, context);
    if (decision.kind === 'reject') {
      throw new Error(`[FAIL-FAST] ${command.type} rejected: ${decision.reason}`);
    }
    state = drawGuessEngine.normalize(decision.events.reduce(drawGuessEngine.evolve, state));
  };
  // The host acts for seat 0 and, as a controlled seat, for the bots.
  const asSeat = (command: DrawGuessCommand, seat: number) =>
    apply(command, {
      actor: { kind: 'user', userId: seat === 1 ? SECOND_USER_ID : HOST_USER_ID },
      controlledSeat: seat <= 1 ? null : seat,
      ...execution(),
    });
  const asSystem = (command: DrawGuessCommand) =>
    apply(command, {
      actor: { kind: 'system', effectId: 'effect:test' },
      controlledSeat: null,
      ...execution(),
    });
  const settle = () => {
    const { phase } = read();
    if (phase.kind !== 'drawing' && phase.kind !== 'roundEnd') {
      throw new Error(`[FAIL-FAST] Cannot settle DrawGuess ${phase.kind}`);
    }
    nowMs = phase.deadlineAt;
    asSystem({ type: 'drawguess.phase.settleExpired' });
  };

  DRAWGUESS_TEST_PLAYER_NAMES.forEach((displayName, seat) =>
    asSeat({ type: 'room.seat.take', seat, profile: { displayName } }, seat),
  );
  asSeat({ type: 'room.seat.fillBots' }, 0);
  asSeat({ type: 'drawguess.game.begin' }, 0);
  for (let turnIndex = 0; read().phase.kind === 'wordSelect'; turnIndex += 1) {
    const choices = [0, 1, 2].map((offset) => {
      const choice = TEST_WORDS[(turnIndex + offset) % TEST_WORDS.length];
      if (choice === undefined) throw new Error('[FAIL-FAST] DrawGuess test word missing');
      return choice;
    });
    asSystem({ type: 'drawguess.words.dealt', turnIndex, choices });
    const dealt = read().phase;
    const [choice] = choices;
    if (dealt.kind !== 'wordSelect' || choice === undefined) {
      throw new Error(`[FAIL-FAST] DrawGuess turn ${turnIndex} dealt no words`);
    }
    const revision = () => ({ phaseRevision: read().phaseRevision, turnIndex });
    asSeat({ type: 'drawguess.word.choose', word: choice.word, ...revision() }, dealt.drawerSeat);
    const turn = script[turnIndex] ?? { guessers: [], filesDrawing: false };
    for (const guesser of turn.guessers) {
      nowMs += GUESS_INTERVAL_MS;
      asSeat({ type: 'drawguess.guess.submit', text: choice.word, ...revision() }, guesser);
    }
    settle();
    if (turn.filesDrawing) {
      asSeat({ type: 'drawguess.drawing.reserve' }, dealt.drawerSeat);
      const reserved = read().phase;
      if (reserved.kind !== 'roundEnd' || reserved.reservation === null) {
        throw new Error(`[FAIL-FAST] DrawGuess turn ${turnIndex} has no drawing reservation`);
      }
      asSystem({
        type: 'drawguess.drawing.committed',
        turnIndex,
        submissionId: reserved.reservation.submissionId,
        objectKey: `drawguess/test/turn-${turnIndex}.png`,
        byteLength: 2048,
        sha256: `sha-turn-${turnIndex}`,
      });
    }
    settle();
  }
  const ended = read();
  if (ended.phase.kind !== 'ended') {
    throw new Error(`[FAIL-FAST] DrawGuess test game stopped in ${ended.phase.kind}`);
  }
  return ended;
}

export const DRAWGUESS_REVIEW_ROUNDS: ReviewTestRounds<DrawGuessState> = {
  lobby: () => buildDrawGuessTestState(),
  ended: () => playDrawGuessTestGame([{ guessers: [1], filesDrawing: true }]),
  nextRound: (ended) => ({ ...ended, gameSequence: ended.gameSequence + 1 }),
};
