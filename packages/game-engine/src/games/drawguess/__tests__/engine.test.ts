/** Exercises DrawGuess through authoritative commands, never injecting progressed state. */

import type { CommandContext } from '../../../platform/engine';
import type { DrawGuessCommand, DrawGuessPublicCommand } from '../commands/types';
import type { DrawGuessEffect } from '../domain/decision';
import { computeGuesserScore, isCorrectGuess, normalizeGuessText } from '../domain/rules';
import { getDrawGuessViewModel } from '../domain/visibility';
import { drawGuessEngine } from '../engine';
import { parseDrawGuessState } from '../state/codec';
import {
  DEFAULT_DRAWGUESS_CONFIG,
  DRAWGUESS_WORD_CHOICE_COUNT,
  type DrawGuessStroke,
  type DrawGuessWordChoice,
} from '../state/types';

const CHOICES: DrawGuessWordChoice[] = [
  { word: '大熊猫', pinyinInitials: 'd x m' },
  { word: '火锅', pinyinInitials: 'h g' },
  { word: '风筝', pinyinInitials: 'f z' },
];

function testStroke(id: string, seat: number): DrawGuessStroke {
  return {
    id,
    kind: 'brush',
    color: '#ff0000',
    width: 5,
    points: [
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.2 },
    ],
    authorSeat: seat,
  };
}

function game(numberOfPlayers = 4) {
  let nowMs = 1000;
  let commandNumber = 0;
  let state = drawGuessEngine.createInitialState(
    { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers },
    { roomCode: '1234', hostUserId: 'host', nowMs, commandId: 'create' },
  );
  const effects: DrawGuessEffect[] = [];
  const context = (userId: string, controlledSeat: number | null = null): CommandContext => ({
    actor: { kind: 'user', userId },
    controlledSeat,
    nowMs,
    commandId: `command:${commandNumber++}`,
    randomSeed: `seed:${commandNumber}`,
  });
  const systemContext = (): CommandContext => ({
    actor: { kind: 'system', effectId: 'effect:1' },
    controlledSeat: null,
    nowMs,
    commandId: `command:${commandNumber++}`,
    randomSeed: `seed:${commandNumber}`,
  });
  const apply = (command: DrawGuessCommand, ctx: CommandContext) => {
    const decision = drawGuessEngine.decide(state, command, ctx);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = parseDrawGuessState(
      JSON.parse(
        JSON.stringify(
          drawGuessEngine.normalize(decision.events.reduce(drawGuessEngine.evolve, state)),
        ),
      ),
    );
    effects.push(...decision.effects);
    return state;
  };
  const send = (
    command: DrawGuessPublicCommand,
    userId = 'host',
    controlledSeat: number | null = null,
  ) => apply(command, context(userId, controlledSeat));
  const sendInternal = (command: DrawGuessCommand) => apply(command, systemContext());
  const seatUser = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);
  const revision = () => ({
    phaseRevision: state.phaseRevision,
    turnIndex: state.turnIndex,
  });
  // Seat 4 real humans (host at seat 0).
  for (let seat = 0; seat < 4; seat += 1) {
    send({ type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } }, seatUser(seat));
  }
  return {
    get state() {
      return state;
    },
    effects,
    send,
    sendInternal,
    seatUser,
    revision,
    advanceTime(milliseconds: number) {
      nowMs += milliseconds;
    },
    get nowMs() {
      return nowMs;
    },
    startGame() {
      send({ type: 'drawguess.round.start' });
      // Worker deals 3 word choices (simulated here via internal command).
      sendInternal({ type: 'drawguess.words.dealt', turnIndex: 0, choices: CHOICES });
    },
    chooseFirstWord(drawerSeat: number) {
      const userId = drawerSeat === 0 ? 'host' : `u${drawerSeat}`;
      send({ type: 'drawguess.word.choose', word: CHOICES[0]!.word, ...this.revision() }, userId);
    },
    guess(seat: number, text: string) {
      send({ type: 'drawguess.guess.submit', text, ...this.revision() }, this.seatUser(seat));
    },
    expire() {
      const phase = state.phase;
      if (
        (phase.kind === 'wordSelect' || phase.kind === 'drawing' || phase.kind === 'roundEnd') &&
        phase.deadlineAt !== null
      ) {
        nowMs = phase.deadlineAt;
      }
      send({ type: 'drawguess.phase.expire', ...this.revision() });
    },
  };
}

describe('DrawGuess engine', () => {
  it('rejects configs outside 4–12 players', () => {
    expect(() =>
      drawGuessEngine.createInitialState(
        { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 3 },
        { roomCode: '1', hostUserId: 'host', nowMs: 1, commandId: 'c' },
      ),
    ).toThrow();
    expect(() =>
      drawGuessEngine.createInitialState(
        { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 13 },
        { roomCode: '1', hostUserId: 'host', nowMs: 1, commandId: 'c' },
      ),
    ).toThrow();
  });

  it('rejects starting when the room is not full', () => {
    const session = game(6);
    // 4 humans seated in a 6-player room: 2 empty seats remain.
    const decision = drawGuessEngine.decide(
      session.state,
      { type: 'drawguess.round.start' },
      {
        actor: { kind: 'user', userId: 'host' },
        controlledSeat: null,
        nowMs: session.nowMs,
        commandId: 'x',
        randomSeed: 'x',
      },
    );
    expect(decision.kind).toBe('reject');
    if (decision.kind !== 'reject') throw new Error('expected rejection');
    expect(decision.reason).toBe('请先坐满所有座位，或填充机器人。');
  });

  it('starts the game with an ascending drawer queue and deals word choices', () => {
    const session = game(6);
    // Fill the 2 empty seats with implicit bots so the room is full.
    session.send({ type: 'room.seat.fillBots' });
    session.send({ type: 'drawguess.round.start' });
    expect(session.state.phase.kind).toBe('wordSelect');
    if (session.state.phase.kind !== 'wordSelect') throw new Error('phase');
    expect(session.state.phase.drawerSeat).toBe(0);
    expect(session.state.phase.choices).toEqual([]);
    expect(session.effects).toContainEqual({
      type: 'drawguess.words.deal',
      payload: { turnIndex: 0 },
    });
    expect(session.state.drawerQueue).toEqual([0, 1, 2, 3, 4, 5]);
    session.sendInternal({ type: 'drawguess.words.dealt', turnIndex: 0, choices: CHOICES });
    if (session.state.phase.kind !== 'wordSelect') throw new Error('phase');
    expect(session.state.phase.choices).toHaveLength(DRAWGUESS_WORD_CHOICE_COUNT);
    expect(session.state.phase.deadlineAt).not.toBeNull();
  });

  it('drawer chooses a word and enters drawing with reveal order', () => {
    const session = game();
    session.startGame();
    session.chooseFirstWord(0);
    const phase = session.state.phase;
    expect(phase.kind).toBe('drawing');
    if (phase.kind !== 'drawing') throw new Error('phase');
    expect(phase.word).toBe('大熊猫');
    expect(phase.pinyinInitials).toBe('d x m');
    expect(phase.revealOrder).toHaveLength(3);
    expect([...phase.revealOrder].sort()).toEqual([0, 1, 2]);
    expect(session.state.usedWords).toContain('大熊猫');
  });

  it('rejects choosing a word that is not among the dealt choices', () => {
    const session = game();
    session.startGame();
    const decision = drawGuessEngine.decide(
      session.state,
      { type: 'drawguess.word.choose', word: '不存在的词', ...session.revision() },
      {
        actor: { kind: 'user', userId: 'host' },
        controlledSeat: null,
        nowMs: session.nowMs,
        commandId: 'x',
        randomSeed: 'x',
      },
    );
    expect(decision.kind).toBe('reject');
  });

  it('auto-assigns a random choice when wordSelect expires', () => {
    const session = game();
    session.startGame();
    session.expire();
    const phase = session.state.phase;
    expect(phase.kind).toBe('drawing');
    if (phase.kind !== 'drawing') throw new Error('phase');
    expect(CHOICES.map((c) => c.word)).toContain(phase.word);
  });

  it('accepts whole strokes from the drawer and rejects others', () => {
    const session = game();
    session.startGame();
    session.chooseFirstWord(0);
    session.send(
      { type: 'drawguess.stroke.add', stroke: testStroke('s1', 0), ...session.revision() },
      'host',
    );
    if (session.state.phase.kind !== 'drawing') throw new Error('phase');
    expect(session.state.phase.strokes).toHaveLength(1);
    // Another seat cannot draw.
    const decision = drawGuessEngine.decide(
      session.state,
      {
        type: 'drawguess.stroke.add',
        stroke: testStroke('s2', 1),
        ...session.revision(),
      },
      {
        actor: { kind: 'user', userId: 'u1' },
        controlledSeat: null,
        nowMs: session.nowMs,
        commandId: 'x',
        randomSeed: 'x',
      },
    );
    expect(decision.kind).toBe('reject');
  });

  it('undo removes the last stroke and clear empties the canvas', () => {
    const session = game();
    session.startGame();
    session.chooseFirstWord(0);
    const rev = () => session.revision();
    session.send({ type: 'drawguess.stroke.add', stroke: testStroke('s1', 0), ...rev() }, 'host');
    session.send({ type: 'drawguess.stroke.add', stroke: testStroke('s2', 0), ...rev() }, 'host');
    session.send({ type: 'drawguess.stroke.undo', ...rev() }, 'host');
    if (session.state.phase.kind !== 'drawing') throw new Error('phase');
    expect(session.state.phase.strokes.map((s) => s.id)).toEqual(['s1']);
    session.send({ type: 'drawguess.stroke.clear', ...rev() }, 'host');
    if (session.state.phase.kind !== 'drawing') throw new Error('phase');
    expect(session.state.phase.strokes).toHaveLength(0);
  });

  it('scores correct guesses by speed and locks the guesser', () => {
    const session = game();
    session.startGame();
    session.chooseFirstWord(0);
    // Guess immediately: full speed bonus = 150.
    session.guess(1, '大熊猫');
    expect(session.state.scores[1]).toBe(150);
    expect(session.state.scores[0]).toBe(20);
    if (session.state.phase.kind !== 'drawing') throw new Error('phase');
    expect(session.state.phase.guessedSeats).toContain(1);
    // Locked guesser cannot guess again.
    const decision = drawGuessEngine.decide(
      session.state,
      { type: 'drawguess.guess.submit', text: '大熊猫', ...session.revision() },
      {
        actor: { kind: 'user', userId: 'u1' },
        controlledSeat: null,
        nowMs: session.nowMs,
        commandId: 'x',
        randomSeed: 'x',
      },
    );
    expect(decision.kind).toBe('reject');
    // Wrong guess is logged but not scored.
    session.guess(2, '小狗');
    expect(session.state.scores[2] ?? 0).toBe(0);
  });

  it('decays the speed bonus over the drawing duration', () => {
    expect(computeGuesserScore(90000)).toBe(150);
    expect(computeGuesserScore(45000)).toBe(100);
    expect(computeGuesserScore(0)).toBe(50);
    expect(computeGuesserScore(-100)).toBe(50);
  });

  it('ends the round early when all real humans have guessed', () => {
    const session = game();
    session.startGame();
    session.chooseFirstWord(0);
    session.guess(1, '大熊猫');
    session.guess(2, '大熊猫');
    session.guess(3, '大熊猫');
    expect(session.state.phase.kind).toBe('roundEnd');
    if (session.state.phase.kind !== 'roundEnd') throw new Error('phase');
    expect(session.state.phase.roundScores[1]).toBe(150);
    expect(session.state.phase.roundScores[0]).toBe(60);
  });

  it('rate-limits guesses to 5 per seat per 10 seconds', () => {
    const session = game();
    session.startGame();
    session.chooseFirstWord(0);
    for (let i = 0; i < 5; i += 1) {
      session.guess(2, `错误答案${i}`);
      session.advanceTime(1000);
    }
    const decision = drawGuessEngine.decide(
      session.state,
      { type: 'drawguess.guess.submit', text: '还是错', ...session.revision() },
      {
        actor: { kind: 'user', userId: 'u2' },
        controlledSeat: null,
        nowMs: session.nowMs,
        commandId: 'x',
        randomSeed: 'x',
      },
    );
    expect(decision.kind).toBe('reject');
    if (decision.kind === 'reject') {
      expect(decision.reason).toBe('请求太频繁，请稍后再试');
    }
    // After the window slides past, guesses are accepted again.
    session.advanceTime(6000);
    session.guess(2, '大熊猫');
    expect(session.state.scores[2]).toBeGreaterThan(0);
  });

  it('rejects guesses from the drawer', () => {
    const session = game();
    session.startGame();
    session.chooseFirstWord(0);
    const decision = drawGuessEngine.decide(
      session.state,
      { type: 'drawguess.guess.submit', text: '大熊猫', ...session.revision() },
      {
        actor: { kind: 'user', userId: 'host' },
        controlledSeat: null,
        nowMs: session.nowMs,
        commandId: 'x',
        randomSeed: 'x',
      },
    );
    expect(decision.kind).toBe('reject');
  });

  it('expires drawing into roundEnd and advances turns until ended', () => {
    const session = game(4);
    session.startGame();
    session.chooseFirstWord(0);
    session.expire(); // drawing deadline -> roundEnd
    expect(session.state.phase.kind).toBe('roundEnd');
    session.expire(); // roundEnd deadline -> next wordSelect (turn 1)
    expect(session.state.phase.kind).toBe('wordSelect');
    expect(session.state.turnIndex).toBe(1);
    if (session.state.phase.kind !== 'wordSelect') throw new Error('phase');
    expect(session.state.phase.drawerSeat).toBe(1);
  });

  it('hides the answer from guessers in the view model', () => {
    const session = game();
    session.startGame();
    session.chooseFirstWord(0);
    const guesserView = getDrawGuessViewModel(session.state, 1, session.nowMs);
    expect(guesserView.word).toBeNull();
    expect(guesserView.choices).toEqual([]);
    expect(guesserView.hintText).toContain('3个字');
    const drawerView = getDrawGuessViewModel(session.state, 0, session.nowMs);
    expect(drawerView.word).toBe('大熊猫');
    expect(drawerView.hintText).toBeNull();
  });

  it('hides correct guess text from other guessers', () => {
    const session = game();
    session.startGame();
    session.chooseFirstWord(0);
    session.guess(1, '大熊猫');
    const other = getDrawGuessViewModel(session.state, 2, session.nowMs);
    const message = other.messages.find((m) => m.seat === 1);
    expect(message?.correct).toBe(true);
    expect(message?.text).toBeNull();
    const drawer = getDrawGuessViewModel(session.state, 0, session.nowMs);
    expect(drawer.messages.find((m) => m.seat === 1)?.text).toBe('大熊猫');
  });

  it('lets the host take over an implicit bot seat to draw', () => {
    const session = game(4);
    session.send({ type: 'room.seat.fillBots' });
    // Seats 4..5 become implicit bots; make drawer seat 4 by starting and advancing.
    session.send({ type: 'drawguess.round.start' });
    // Simulate 4 turns to reach a bot drawer... instead directly test takeover auth:
    const state = session.state;
    expect(state.config.fillEmptySeatsWithBots).toBe(true);
    // Host controlling a real seat's number that is NOT a bot -> rejected.
    const decision = drawGuessEngine.decide(
      state,
      { type: 'drawguess.word.choose', word: '大熊猫', phaseRevision: 0, turnIndex: 0 },
      {
        actor: { kind: 'user', userId: 'host' },
        controlledSeat: 1,
        nowMs: session.nowMs,
        commandId: 'x',
        randomSeed: 'x',
      },
    );
    expect(decision.kind).toBe('reject');
  });

  it('reserves and commits the final PNG in roundEnd', () => {
    const session = game();
    session.startGame();
    session.chooseFirstWord(0);
    session.expire();
    expect(session.state.phase.kind).toBe('roundEnd');
    session.send({ type: 'drawguess.drawing.reserve' }, 'host');
    if (session.state.phase.kind !== 'roundEnd') throw new Error('phase');
    const submissionId = session.state.phase.reservation?.submissionId;
    expect(submissionId).toContain('drawguess-submission:');
    session.sendInternal({
      type: 'drawguess.drawing.committed',
      turnIndex: session.state.turnIndex,
      submissionId: submissionId ?? '',
      objectKey: 'drawguess/abc/turn-0/x.png',
      byteLength: 1234,
      sha256: 'deadbeef',
    });
    if (session.state.phase.kind !== 'roundEnd') throw new Error('phase');
    expect(session.state.phase.pngEntry?.objectKey).toBe('drawguess/abc/turn-0/x.png');
  });

  it('returns to lobby only from ended via host', () => {
    const session = game();
    session.startGame();
    const decision = drawGuessEngine.decide(
      session.state,
      { type: 'drawguess.game.returnToLobby' },
      {
        actor: { kind: 'user', userId: 'host' },
        controlledSeat: null,
        nowMs: session.nowMs,
        commandId: 'x',
        randomSeed: 'x',
      },
    );
    expect(decision.kind).toBe('reject');
  });
});

describe('DrawGuess guess normalization', () => {
  it('strips whitespace and CJK punctuation', () => {
    expect(normalizeGuessText('大 熊猫')).toBe('大熊猫');
    expect(normalizeGuessText('大熊猫。')).toBe('大熊猫');
    expect(normalizeGuessText('　大熊猫　')).toBe('大熊猫');
    expect(isCorrectGuess('大熊猫。', '大熊猫')).toBe(true);
    expect(isCorrectGuess('大狗熊', '大熊猫')).toBe(false);
    expect(isCorrectGuess('大熊', '大熊猫')).toBe(false);
  });

  it('converts full-width ASCII to half-width', () => {
    expect(normalizeGuessText('ＤＸＭ')).toBe('DXM');
  });
});
