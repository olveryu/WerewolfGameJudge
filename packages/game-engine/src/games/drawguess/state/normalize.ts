/** DrawGuess semantic invariants; invalid persisted or evolved states fail explicitly. */

import {
  assertStateIdentity,
  createStateInvariant,
  type StateInvariant,
} from '../../../platform/protocol/stateInvariant';
import { isBotOccupant } from '../../../platform/room/seating';
import { isValidWordChoice } from '../domain/rules';
import {
  DRAWGUESS_GUESS_TEXT_MAX_LENGTH,
  DRAWGUESS_MAX_STROKES_PER_TURN,
  DRAWGUESS_ROUNDS_PER_DRAWER,
  DRAWGUESS_WORD_CHOICE_COUNT,
  type DrawGuessHumanSeat,
  type DrawGuessMedia,
  type DrawGuessPhase,
  type DrawGuessState,
  type DrawGuessStroke,
  type DrawGuessTurnRecord,
  isValidDrawGuessConfig,
} from './types';
import { DRAWGUESS_STATE_IDENTITY } from './version';

const invariant: StateInvariant = createStateInvariant('DrawGuess');

type SeatCheck = (seat: number) => boolean;
type DrawingPhase = Extract<DrawGuessPhase, { readonly kind: 'drawing' }>;
type RoundEndPhase = Extract<DrawGuessPhase, { readonly kind: 'roundEnd' }>;

function isValidStroke(stroke: DrawGuessStroke, seatCount: number): boolean {
  if (
    !Number.isSafeInteger(stroke.authorSeat) ||
    stroke.authorSeat < 0 ||
    stroke.authorSeat >= seatCount
  )
    return false;
  if (typeof stroke.id !== 'string' || stroke.id.length === 0) return false;
  if (typeof stroke.color !== 'string' || !/^#[\da-f]{6}$/i.test(stroke.color)) return false;
  if (!Number.isSafeInteger(stroke.width) || stroke.width <= 0) return false;
  const isPoint = (x: number, y: number) =>
    typeof x === 'number' && typeof y === 'number' && x >= 0 && x <= 1 && y >= 0 && y <= 1;
  switch (stroke.kind) {
    case 'brush':
    case 'eraser':
      return stroke.points.length > 0 && stroke.points.every((p) => isPoint(p.x, p.y));
    case 'line':
    case 'rectangle':
    case 'ellipse':
      return isPoint(stroke.start.x, stroke.start.y) && isPoint(stroke.end.x, stroke.end.y);
    case 'fill':
      return (
        stroke.rectangles.length > 0 &&
        stroke.rectangles.every(
          (r) =>
            Number.isSafeInteger(r.x) &&
            Number.isSafeInteger(r.y) &&
            Number.isSafeInteger(r.width) &&
            r.width > 0 &&
            Number.isSafeInteger(r.height) &&
            r.height > 0,
        )
      );
  }
}

function isValidPngEntry(entry: DrawGuessMedia): boolean {
  return (
    entry.contentType === 'image/png' &&
    entry.width === 1024 &&
    entry.height === 768 &&
    entry.byteLength > 0
  );
}

function areValidRoundScores(
  roundScores: Readonly<Record<number, number>>,
  isSeat: SeatCheck,
): boolean {
  return Object.entries(roundScores).every(
    ([seat, score]) => isSeat(Number(seat)) && Number.isSafeInteger(score),
  );
}

/** Guessers are exactly the non-drawer seats holding a round score, each listed once. */
function isValidGuessedSeats(
  guessedSeats: readonly number[],
  drawerSeat: number,
  roundScores: Readonly<Record<number, number>>,
): boolean {
  const scoredGuessers = Object.keys(roundScores)
    .map(Number)
    .filter((seat) => seat !== drawerSeat);
  return (
    new Set(guessedSeats).size === guessedSeats.length &&
    guessedSeats.length === scoredGuessers.length &&
    scoredGuessers.every((seat) => guessedSeats.includes(seat))
  );
}

function isValidTurnRecord(
  record: DrawGuessTurnRecord,
  drawerQueue: readonly number[],
  isSeat: SeatCheck,
): boolean {
  return (
    record.drawerSeat === drawerQueue[record.turnIndex % drawerQueue.length] &&
    record.word.length >= 1 &&
    areValidRoundScores(record.roundScores, isSeat) &&
    isValidGuessedSeats(record.guessedSeats, record.drawerSeat, record.roundScores) &&
    typeof record.drawerZeroed === 'boolean' &&
    (record.entryId === null
      ? record.pngEntry === null
      : record.entryId.length > 0 && record.pngEntry !== null && isValidPngEntry(record.pngEntry))
  );
}

/**
 * Finished turns are contiguous and end at the last closed turn: the
 * previous turn while one is running, the final turn once ended; the
 * lobby holds none. A room migrated from v3 mid-game starts its history
 * at the migration turn, so the first record may come after turn 0.
 */
function isValidTurnHistory(state: DrawGuessState, isSeat: SeatCheck): boolean {
  const history = state.turnHistory;
  if (state.phase.kind === 'lobby') return history.length === 0;
  const lastTurn = state.phase.kind === 'ended' ? state.turnIndex : state.turnIndex - 1;
  const firstTurn = lastTurn - history.length + 1;
  const entryIds = history.flatMap((record) => (record.entryId === null ? [] : [record.entryId]));
  return (
    firstTurn >= 0 &&
    history.every(
      (record, index) =>
        record.turnIndex === firstTurn + index &&
        isValidTurnRecord(record, state.drawerQueue, isSeat),
    ) &&
    new Set(entryIds).size === entryIds.length
  );
}

function areValidStrokes(strokes: readonly DrawGuessStroke[], seatCount: number): boolean {
  return (
    strokes.length <= DRAWGUESS_MAX_STROKES_PER_TURN &&
    strokes.every((stroke) => isValidStroke(stroke, seatCount)) &&
    new Set(strokes.map((stroke) => stroke.id)).size === strokes.length
  );
}

function assertDrawingPhase(state: DrawGuessState, phase: DrawingPhase, isSeat: SeatCheck): void {
  const totalTurns = state.drawerQueue.length * DRAWGUESS_ROUNDS_PER_DRAWER;
  invariant(state.drawerQueue.length > 0, 'drawing queue');
  invariant(state.turnIndex < totalTurns, 'drawing turn bound');
  invariant(isSeat(phase.drawerSeat), 'drawing drawer');
  invariant(
    phase.drawerSeat === state.drawerQueue[state.turnIndex % state.drawerQueue.length],
    'drawing drawer matches queue',
  );
  invariant(phase.word.length >= 1 && phase.word.length <= 8, 'drawing word');
  invariant(phase.pinyinInitials.split(' ').length === phase.word.length, 'pinyin initials length');
  invariant(
    phase.revealOrder.length === phase.word.length &&
      new Set(phase.revealOrder).size === phase.word.length &&
      phase.revealOrder.every(
        (index) => Number.isSafeInteger(index) && index >= 0 && index < phase.word.length,
      ),
    'reveal order',
  );
  invariant(areValidStrokes(phase.strokes, state.config.numberOfPlayers), 'drawing strokes');
  invariant(
    Object.keys(phase.turnScores).every(
      (seat) => isSeat(Number(seat)) && Number.isSafeInteger(phase.turnScores[Number(seat)]),
    ),
    'turn scores',
  );
  invariant(
    phase.guessedSeats.every(isSeat) &&
      !phase.guessedSeats.includes(phase.drawerSeat) &&
      new Set(phase.guessedSeats).size === phase.guessedSeats.length,
    'guessed seats',
  );
  invariant(
    phase.guessLog.every(
      (entry) =>
        isSeat(entry.seat) &&
        entry.seat !== phase.drawerSeat &&
        typeof entry.text === 'string' &&
        entry.text.length <= DRAWGUESS_GUESS_TEXT_MAX_LENGTH &&
        Number.isSafeInteger(entry.at) &&
        entry.at >= 0,
    ),
    'guess log',
  );
  invariant(Number.isSafeInteger(phase.phaseStartAt) && phase.phaseStartAt >= 0, 'phase start');
  invariant(
    Number.isSafeInteger(phase.deadlineAt) && phase.deadlineAt > phase.phaseStartAt,
    'drawing deadline',
  );
}

function assertRoundEndPhase(state: DrawGuessState, phase: RoundEndPhase, isSeat: SeatCheck): void {
  const totalTurns = state.drawerQueue.length * DRAWGUESS_ROUNDS_PER_DRAWER;
  invariant(state.drawerQueue.length > 0, 'roundEnd queue');
  invariant(state.turnIndex < totalTurns, 'roundEnd turn bound');
  invariant(isSeat(phase.drawerSeat), 'roundEnd drawer');
  invariant(phase.word.length >= 1, 'roundEnd word');
  invariant(areValidStrokes(phase.strokes, state.config.numberOfPlayers), 'roundEnd strokes');
  invariant(areValidRoundScores(phase.roundScores, isSeat), 'round scores');
  invariant(
    isValidGuessedSeats(phase.guessedSeats, phase.drawerSeat, phase.roundScores),
    'roundEnd guessed seats',
  );
  invariant(typeof phase.drawerZeroed === 'boolean', 'drawer zeroed');
  const reservation = phase.reservation;
  invariant(
    reservation === null ||
      (typeof reservation.submissionId === 'string' &&
        reservation.submissionId.length > 0 &&
        typeof reservation.entryId === 'string' &&
        reservation.entryId.length > 0 &&
        reservation.authorSeat === phase.drawerSeat &&
        reservation.turnIndex === state.turnIndex),
    'reservation',
  );
  // A drawing is filed only against its reservation, whose entryId is the media-route handle.
  invariant(
    phase.pngEntry === null || (reservation !== null && isValidPngEntry(phase.pngEntry)),
    'png entry',
  );
  invariant(Number.isSafeInteger(phase.deadlineAt) && phase.deadlineAt >= 0, 'roundEnd deadline');
}

/** Validates authoritative state without repairing or dropping submitted content. */
export function normalizeDrawGuessState(state: DrawGuessState): DrawGuessState {
  assertStateIdentity(state, DRAWGUESS_STATE_IDENTITY, 'DrawGuess');
  invariant(isValidDrawGuessConfig(state.config), 'configuration');
  const count = state.config.numberOfPlayers;
  const isSeat = (seat: number) => Number.isSafeInteger(seat) && seat >= 0 && seat < count;
  invariant(
    Number.isSafeInteger(state.phaseRevision) && state.phaseRevision >= 0,
    'phase revision',
  );
  invariant(Number.isSafeInteger(state.turnIndex) && state.turnIndex >= 0, 'turn index');
  invariant(Number.isSafeInteger(state.gameSequence) && state.gameSequence >= 0, 'game sequence');
  const occupants = Object.entries(state.roster);
  invariant(
    occupants.every(
      ([seat, occupant]) =>
        occupant != null && isSeat(Number(seat)) && occupant.seat === Number(seat),
    ),
    'roster seats',
  );
  const humans = occupants.filter(
    (entry): entry is [string, DrawGuessHumanSeat] => !isBotOccupant(entry[1]),
  );
  invariant(
    humans.every(([, occupant]) => occupant.profile.displayName.trim().length > 0),
    'human seat profiles',
  );
  invariant(
    new Set(humans.map(([, occupant]) => occupant.userId)).size === humans.length,
    'duplicate user',
  );
  invariant(
    state.drawerQueue.every(isSeat) && new Set(state.drawerQueue).size === state.drawerQueue.length,
    'drawer queue',
  );
  invariant(
    Object.keys(state.scores).every(
      (seat) =>
        isSeat(Number(seat)) &&
        Number.isSafeInteger(state.scores[Number(seat)]) &&
        (state.scores[Number(seat)] ?? 0) >= 0,
    ),
    'scores',
  );
  invariant(
    state.usedWords.every((word) => typeof word === 'string' && word.length > 0) &&
      new Set(state.usedWords).size === state.usedWords.length,
    'used words',
  );
  invariant(isValidTurnHistory(state, isSeat), 'turn history');

  const totalTurns = state.drawerQueue.length * DRAWGUESS_ROUNDS_PER_DRAWER;

  switch (state.phase.kind) {
    case 'lobby':
      invariant(
        state.drawerQueue.length === 0 &&
          state.turnIndex === 0 &&
          Object.keys(state.scores).length === 0 &&
          state.usedWords.length === 0,
        'lobby game data',
      );
      return state;
    case 'wordSelect': {
      const phase = state.phase;
      invariant(state.drawerQueue.length > 0, 'wordSelect queue');
      invariant(state.turnIndex < totalTurns, 'wordSelect turn bound');
      invariant(isSeat(phase.drawerSeat), 'wordSelect drawer');
      invariant(
        phase.drawerSeat === state.drawerQueue[state.turnIndex % state.drawerQueue.length],
        'wordSelect drawer matches queue',
      );
      invariant(
        phase.choices.length === 0 ||
          (phase.choices.length === DRAWGUESS_WORD_CHOICE_COUNT &&
            phase.choices.every(isValidWordChoice) &&
            new Set(phase.choices.map((c) => c.word)).size === DRAWGUESS_WORD_CHOICE_COUNT),
        'wordSelect choices',
      );
      invariant(
        phase.deadlineAt === null ||
          (Number.isSafeInteger(phase.deadlineAt) && phase.deadlineAt >= 0),
        'wordSelect deadline',
      );
      return state;
    }
    case 'drawing':
      assertDrawingPhase(state, state.phase, isSeat);
      return state;
    case 'roundEnd':
      assertRoundEndPhase(state, state.phase, isSeat);
      return state;
    case 'ended':
      invariant(
        Object.keys(state.phase.totalScores).every((seat) => isSeat(Number(seat))),
        'total scores',
      );
      return state;
  }
}
