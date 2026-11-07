/** Canonical Pictionary states for client tests (AU-46): minimal, and a round played through. */

import type {
  PictionaryCommand,
  PictionaryCommandInput,
  PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import {
  createPictionaryCommand,
  DEFAULT_PICTIONARY_CONFIG,
  getPictionaryExpectedKind,
  getPictionaryRelayStepCount,
  PICTIONARY_DRAWING_HEIGHT,
  PICTIONARY_DRAWING_WIDTH,
  pictionaryEngine,
} from '@game-judge/game-engine/games/pictionary/public';

import type { ReviewTestRounds } from './reviewTestRounds';

const ROOM_CODE = 'ABCD';
const HOST_USER_ID = 'host-1';

/** The players of `playPictionaryTestRound`, by seat; the host sits at seat 0. */
export const PICTIONARY_TEST_PLAYER_NAMES = ['阿杰', '小雨', '大熊', '米粒'] as const;

/** One scripted round of `playPictionaryTestRound`. */
export interface PictionaryTestRound {
  /** Per relay step, the seats that hand nothing in; steps past the list miss nobody. */
  readonly missedSeats?: readonly (readonly number[])[];
  /** The host aborts as this step opens (0: before anything was handed in); omitted plays to the end. */
  readonly abortAtStep?: number;
}

type CommandContext = Parameters<typeof pictionaryEngine.decide>[2];

/** The engine's initial lobby state for room ABCD, with field overrides. */
export function buildPictionaryTestState(
  overrides: Partial<PictionaryState> = {},
): PictionaryState {
  return {
    ...pictionaryEngine.createInitialState(DEFAULT_PICTIONARY_CONFIG, {
      roomCode: ROOM_CODE,
      hostUserId: HOST_USER_ID,
      nowMs: 0,
      commandId: 'create',
    }),
    ...overrides,
  };
}

/** The text a seat writes at a text step of `playPictionaryTestRound` (the prompt or a guess). */
export function pictionaryTestText(stepIndex: number, seat: number): string {
  return `第${stepIndex + 1}棒·${PICTIONARY_TEST_PLAYER_NAMES[seat]}的文字`;
}

/**
 * Plays a four-seat round through the real engine: every step settles at
 * its deadline through the system channel, then each seat hands in its
 * text (`pictionaryTestText`), its uploaded drawing, or nothing as the
 * script says. The round ends with the host finishing the gallery, or
 * aborts as `abortAtStep` opens.
 */
export function playPictionaryTestRound(round: PictionaryTestRound = {}): PictionaryState {
  const numberOfPlayers = PICTIONARY_TEST_PLAYER_NAMES.length;
  let nowMs = 0;
  let commandNumber = 0;
  let state = pictionaryEngine.createInitialState(
    { ...DEFAULT_PICTIONARY_CONFIG, numberOfPlayers },
    { roomCode: ROOM_CODE, hostUserId: HOST_USER_ID, nowMs, commandId: 'create' },
  );
  const read = (): PictionaryState => state;
  const execution = () => {
    commandNumber += 1;
    return { nowMs, commandId: `command:${commandNumber}`, randomSeed: `seed:${commandNumber}` };
  };
  const apply = (command: PictionaryCommand, context: CommandContext) => {
    const decision = pictionaryEngine.decide(state, command, context);
    if (decision.kind === 'reject') {
      throw new Error(`[FAIL-FAST] ${command.type} rejected: ${decision.reason}`);
    }
    state = pictionaryEngine.normalize(decision.events.reduce(pictionaryEngine.evolve, state));
  };
  // Seat commands bind the seat's task; host and room commands bind none.
  const asSeat = (input: PictionaryCommandInput, seat: number, taskSeat: number | null) =>
    apply(createPictionaryCommand(read(), input, taskSeat), {
      actor: { kind: 'user', userId: seat === 0 ? HOST_USER_ID : `u${seat}` },
      controlledSeat: null,
      ...execution(),
    });
  const asSystem = (command: PictionaryCommand) =>
    apply(command, {
      actor: { kind: 'system', effectId: 'effect:test' },
      controlledSeat: null,
      ...execution(),
    });
  const settle = () => {
    const { deadlineAt, phase } = read();
    if (deadlineAt === null) throw new Error(`[FAIL-FAST] Pictionary ${phase} has no deadline`);
    nowMs = deadlineAt;
    asSystem({ type: 'pictionary.phase.settleExpired' });
  };
  const handIn = (stepIndex: number, seat: number) => {
    if (round.missedSeats?.[stepIndex]?.includes(seat) === true) {
      asSeat({ type: 'pictionary.task.empty.submit' }, seat, seat);
      return;
    }
    if (getPictionaryExpectedKind(stepIndex) === 'text') {
      asSeat(
        { type: 'pictionary.text.submit', text: pictionaryTestText(stepIndex, seat) },
        seat,
        seat,
      );
      return;
    }
    asSeat({ type: 'pictionary.drawing.reserve' }, seat, seat);
    const reservation = read().reservations.find((candidate) => candidate.authorSeat === seat);
    if (reservation === undefined) {
      throw new Error(`[FAIL-FAST] Pictionary seat ${seat} reserved no drawing`);
    }
    asSystem({
      type: 'pictionary.drawing.commit',
      submissionId: reservation.submissionId,
      media: {
        objectKey: `pictionary/test/${reservation.submissionId}.png`,
        contentType: 'image/png',
        width: PICTIONARY_DRAWING_WIDTH,
        height: PICTIONARY_DRAWING_HEIGHT,
        byteLength: 2048,
        sha256: `sha-${reservation.submissionId}`,
      },
    });
  };

  PICTIONARY_TEST_PLAYER_NAMES.forEach((displayName, seat) =>
    asSeat({ type: 'room.seat.take', seat, profile: { displayName } }, seat, null),
  );
  asSeat({ type: 'pictionary.game.begin' }, 0, null);
  const stepCount = getPictionaryRelayStepCount(numberOfPlayers);
  for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
    if (round.abortAtStep === stepIndex) {
      asSeat({ type: 'pictionary.game.abort' }, 0, null);
      return read();
    }
    settle();
    for (let seat = 0; seat < numberOfPlayers; seat += 1) handIn(stepIndex, seat);
    settle();
  }
  asSeat({ type: 'pictionary.gallery.finish' }, 0, null);
  const ended = read();
  if (ended.phase !== 'ended') {
    throw new Error(`[FAIL-FAST] Pictionary test round stopped in ${ended.phase}`);
  }
  return ended;
}

export const PICTIONARY_REVIEW_ROUNDS: ReviewTestRounds<PictionaryState> = {
  lobby: () => buildPictionaryTestState(),
  ended: () => playPictionaryTestRound(),
  nextRound: (ended) => ({ ...ended, roundNumber: ended.roundNumber + 1 }),
};
