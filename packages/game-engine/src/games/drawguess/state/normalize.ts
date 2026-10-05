/** DrawGuess semantic invariants; invalid persisted or evolved states fail explicitly. */

import { isValidWordChoice } from '../domain/rules';
import {
  DRAWGUESS_GAME_TYPE,
  DRAWGUESS_GUESS_TEXT_MAX_LENGTH,
  DRAWGUESS_MAX_STROKES_PER_TURN,
  DRAWGUESS_ROUNDS_PER_DRAWER,
  DRAWGUESS_STATE_VERSION,
  DRAWGUESS_WORD_CHOICE_COUNT,
  type DrawGuessState,
  type DrawGuessStroke,
  isValidDrawGuessConfig,
} from './types';

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid DrawGuess state: ${message}`);
}

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

/** Validates authoritative state without repairing or dropping submitted content. */
export function normalizeDrawGuessState(state: DrawGuessState): DrawGuessState {
  invariant(
    state.gameType === DRAWGUESS_GAME_TYPE && state.stateVersion === DRAWGUESS_STATE_VERSION,
    'identity',
  );
  invariant(isValidDrawGuessConfig(state.config), 'configuration');
  const count = state.config.numberOfPlayers;
  const isSeat = (seat: number) => Number.isSafeInteger(seat) && seat >= 0 && seat < count;
  invariant(
    Number.isSafeInteger(state.phaseRevision) && state.phaseRevision >= 0,
    'phase revision',
  );
  invariant(Number.isSafeInteger(state.turnIndex) && state.turnIndex >= 0, 'turn index');
  invariant(Number.isSafeInteger(state.gameSequence) && state.gameSequence >= 0, 'game sequence');
  const users = Object.entries(state.realSeats);
  invariant(
    users.every(
      ([seat, occupant]) =>
        occupant !== undefined &&
        isSeat(Number(seat)) &&
        occupant.seat === Number(seat) &&
        occupant.profile.displayName.trim().length > 0,
    ),
    'real seats',
  );
  invariant(
    new Set(users.map(([, occupant]) => occupant!.userId)).size === users.length,
    'duplicate user',
  );
  invariant(
    state.excludedBotSeats.every((seat) => isSeat(seat) && state.realSeats[seat] === undefined) &&
      new Set(state.excludedBotSeats).size === state.excludedBotSeats.length,
    'excluded bot seats',
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

  const totalTurns = state.drawerQueue.length * DRAWGUESS_ROUNDS_PER_DRAWER;
  const validateStrokes = (strokes: readonly DrawGuessStroke[]) =>
    strokes.length <= DRAWGUESS_MAX_STROKES_PER_TURN &&
    strokes.every((stroke) => isValidStroke(stroke, count)) &&
    new Set(strokes.map((stroke) => stroke.id)).size === strokes.length;

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
    case 'drawing': {
      const phase = state.phase;
      invariant(state.drawerQueue.length > 0, 'drawing queue');
      invariant(state.turnIndex < totalTurns, 'drawing turn bound');
      invariant(isSeat(phase.drawerSeat), 'drawing drawer');
      invariant(
        phase.drawerSeat === state.drawerQueue[state.turnIndex % state.drawerQueue.length],
        'drawing drawer matches queue',
      );
      invariant(phase.word.length >= 1 && phase.word.length <= 8, 'drawing word');
      invariant(
        phase.pinyinInitials.split(' ').length === phase.word.length,
        'pinyin initials length',
      );
      invariant(
        phase.revealOrder.length === phase.word.length &&
          new Set(phase.revealOrder).size === phase.word.length &&
          phase.revealOrder.every(
            (index) => Number.isSafeInteger(index) && index >= 0 && index < phase.word.length,
          ),
        'reveal order',
      );
      invariant(validateStrokes(phase.strokes), 'drawing strokes');
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
      return state;
    }
    case 'roundEnd': {
      const phase = state.phase;
      invariant(state.drawerQueue.length > 0, 'roundEnd queue');
      invariant(state.turnIndex < totalTurns, 'roundEnd turn bound');
      invariant(isSeat(phase.drawerSeat), 'roundEnd drawer');
      invariant(phase.word.length >= 1, 'roundEnd word');
      invariant(validateStrokes(phase.strokes), 'roundEnd strokes');
      invariant(
        Object.keys(phase.roundScores).every(
          (seat) => isSeat(Number(seat)) && Number.isSafeInteger(phase.roundScores[Number(seat)]),
        ),
        'round scores',
      );
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
      const pngEntry = phase.pngEntry;
      invariant(
        pngEntry === null ||
          (pngEntry.contentType === 'image/png' &&
            pngEntry.width === 1024 &&
            pngEntry.height === 768 &&
            pngEntry.byteLength > 0),
        'png entry',
      );
      invariant(
        Number.isSafeInteger(phase.deadlineAt) && phase.deadlineAt >= 0,
        'roundEnd deadline',
      );
      return state;
    }
    case 'ended':
      invariant(
        Object.keys(state.phase.totalScores).every((seat) => isSeat(Number(seat))),
        'total scores',
      );
      return state;
  }
}
