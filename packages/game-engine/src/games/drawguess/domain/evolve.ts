/** Applies DrawGuess domain events; reset paths clear all turn-owned state.
 * @remarks phaseRevision advances only on phase transitions (game start,
 * turn start, word chosen, round ended, game ended, return to lobby).
 * Content events inside a phase (words dealt, strokes, guesses, drawing
 * reservation/commit) do not advance it, so an in-flight guess is never
 * invalidated by drawing activity in the same phase. Closing a roundEnd
 * (next turn started, game ended) freezes that turn into turnHistory. */

import { applyRosterChanges } from '../../../platform/room/seating';
import type { DrawGuessPhase, DrawGuessState, DrawGuessTurnRecord } from '../state/types';
import type { DrawGuessEvent } from './decision';

type RoundEndPhase = Extract<DrawGuessPhase, { readonly kind: 'roundEnd' }>;
type GuessSubmittedEvent = Extract<DrawGuessEvent, { readonly type: 'drawguess.guess.submitted' }>;
type RoundEndedEvent = Extract<DrawGuessEvent, { readonly type: 'drawguess.round.ended' }>;

/** Resets mutable game data while preserving room configuration and seats. */
function resetDrawGuessGame(state: DrawGuessState): DrawGuessState {
  return {
    ...state,
    phase: { kind: 'lobby' },
    phaseRevision: state.phaseRevision + 1,
    drawerQueue: [],
    turnIndex: 0,
    scores: {},
    usedWords: [],
    turnHistory: [],
  };
}

/** The drawing filed in a closing roundEnd; its reservation names the media-route entry. */
function filedDrawing(phase: RoundEndPhase): Pick<DrawGuessTurnRecord, 'entryId' | 'pngEntry'> {
  if (phase.pngEntry === null) return { entryId: null, pngEntry: null };
  if (phase.reservation === null) {
    throw new Error('DrawGuess roundEnd drawing was filed without a reservation');
  }
  return { entryId: phase.reservation.entryId, pngEntry: phase.pngEntry };
}

/**
 * Freezes the closing roundEnd into the turn history.
 * @throws When the closing event does not follow a roundEnd phase.
 */
function closeRoundEnd(
  state: DrawGuessState,
  eventType: DrawGuessEvent['type'],
): readonly DrawGuessTurnRecord[] {
  const phase = state.phase;
  if (phase.kind !== 'roundEnd') {
    throw new Error(`DrawGuess ${eventType} event requires a roundEnd state`);
  }
  return [
    ...state.turnHistory,
    {
      turnIndex: state.turnIndex,
      drawerSeat: phase.drawerSeat,
      word: phase.word,
      guessedSeats: phase.guessedSeats,
      roundScores: phase.roundScores,
      drawerZeroed: phase.drawerZeroed,
      ...filedDrawing(phase),
    },
  ];
}

/** Logs a guess; a correct one locks the seat and credits guesser and drawer. */
function applyGuess(state: DrawGuessState, event: GuessSubmittedEvent): DrawGuessState {
  if (state.phase.kind !== 'drawing' || state.turnIndex !== event.turnIndex) return state;
  const scores = { ...state.scores };
  const turnScores = { ...state.phase.turnScores };
  if (event.correct) {
    scores[event.seat] = (scores[event.seat] ?? 0) + event.guesserScore;
    const drawerSeat = state.phase.drawerSeat;
    scores[drawerSeat] = (scores[drawerSeat] ?? 0) + event.drawerScore;
    turnScores[event.seat] = (turnScores[event.seat] ?? 0) + event.guesserScore;
    turnScores[drawerSeat] = (turnScores[drawerSeat] ?? 0) + event.drawerScore;
  }
  return {
    ...state,
    phase: {
      ...state.phase,
      guessedSeats: event.correct
        ? [...state.phase.guessedSeats, event.seat]
        : state.phase.guessedSeats,
      guessLog: [
        ...state.phase.guessLog,
        { seat: event.seat, text: event.text, correct: event.correct, at: event.at },
      ],
      turnScores,
      deadlineAt: event.deadlineAt,
    },
    scores,
  };
}

/** Settles the round into roundEnd, carrying the guess order and round scores. */
function endRound(state: DrawGuessState, event: RoundEndedEvent): DrawGuessState {
  if (state.turnIndex !== event.turnIndex) return state;
  const fromDrawing = state.phase.kind === 'drawing';
  const roundScores = fromDrawing ? { ...state.phase.turnScores } : {};
  const scores = { ...state.scores };
  // 全员猜中 = 画得太简单：画手本轮收入清零，猜中者得分不动。
  // 口径与“全员猜中压到 3 秒”一致（猜题者数 = 席位数 − 画手）。
  const drawerSeat = event.drawerSeat;
  const allGuessed =
    fromDrawing && state.phase.guessedSeats.length >= state.config.numberOfPlayers - 1;
  const drawerZeroed = allGuessed && (roundScores[drawerSeat] ?? 0) > 0;
  if (drawerZeroed) {
    scores[drawerSeat] = (scores[drawerSeat] ?? 0) - (roundScores[drawerSeat] ?? 0);
    roundScores[drawerSeat] = 0;
  }
  return {
    ...state,
    phase: {
      kind: 'roundEnd',
      drawerSeat,
      word: event.word,
      strokes: fromDrawing ? [...state.phase.strokes] : [],
      guessedSeats: fromDrawing ? [...state.phase.guessedSeats] : [],
      roundScores,
      drawerZeroed,
      pngEntry: null,
      reservation: null,
      deadlineAt: event.deadlineAt,
    },
    phaseRevision: state.phaseRevision + 1,
    scores,
  };
}

/** Evolves a committed domain event without persistence or broadcasts. */
export function evolveDrawGuessState(state: DrawGuessState, event: DrawGuessEvent): DrawGuessState {
  switch (event.type) {
    case 'drawguess.seats.changed':
      return { ...state, roster: applyRosterChanges(state.roster, event.changes) };
    case 'drawguess.config.updated':
      return { ...state, config: event.config };
    case 'drawguess.game.started':
      return {
        ...resetDrawGuessGame(state),
        phase: { kind: 'wordSelect', drawerSeat: event.drawerSeat, choices: [], deadlineAt: null },
        phaseRevision: state.phaseRevision + 1,
        drawerQueue: [...event.drawerQueue],
        turnIndex: 0,
        gameSequence: state.gameSequence + 1,
      };
    case 'drawguess.turn.started': {
      if (state.turnIndex + 1 !== event.turnIndex) return state;
      return {
        ...state,
        phase: { kind: 'wordSelect', drawerSeat: event.drawerSeat, choices: [], deadlineAt: null },
        phaseRevision: state.phaseRevision + 1,
        turnIndex: event.turnIndex,
        turnHistory: closeRoundEnd(state, event.type),
      };
    }
    case 'drawguess.words.dealt': {
      if (state.phase.kind !== 'wordSelect' || state.turnIndex !== event.turnIndex) return state;
      return {
        ...state,
        phase: { ...state.phase, choices: [...event.choices], deadlineAt: event.deadlineAt },
      };
    }
    case 'drawguess.word.chosen': {
      if (state.phase.kind !== 'wordSelect' || state.turnIndex !== event.turnIndex) return state;
      return {
        ...state,
        phase: {
          kind: 'drawing',
          drawerSeat: state.phase.drawerSeat,
          word: event.word,
          pinyinInitials: event.pinyinInitials,
          revealOrder: [...event.revealOrder],
          strokes: [],
          guessedSeats: [],
          guessLog: [],
          turnScores: {},
          phaseStartAt: event.phaseStartAt,
          deadlineAt: event.deadlineAt,
        },
        phaseRevision: state.phaseRevision + 1,
        usedWords: state.usedWords.includes(event.word)
          ? state.usedWords
          : [...state.usedWords, event.word],
      };
    }
    case 'drawguess.stroke.added': {
      if (state.phase.kind !== 'drawing' || state.turnIndex !== event.turnIndex) return state;
      return {
        ...state,
        phase: { ...state.phase, strokes: [...state.phase.strokes, event.stroke] },
      };
    }
    case 'drawguess.stroke.undone': {
      if (state.phase.kind !== 'drawing' || state.turnIndex !== event.turnIndex) return state;
      return {
        ...state,
        phase: { ...state.phase, strokes: state.phase.strokes.slice(0, -1) },
      };
    }
    case 'drawguess.strokes.cleared': {
      if (state.phase.kind !== 'drawing' || state.turnIndex !== event.turnIndex) return state;
      return {
        ...state,
        phase: { ...state.phase, strokes: [] },
      };
    }
    case 'drawguess.guess.submitted':
      return applyGuess(state, event);
    case 'drawguess.round.ended':
      return endRound(state, event);
    case 'drawguess.drawing.reserved': {
      if (
        state.phase.kind !== 'roundEnd' ||
        state.turnIndex !== event.turnIndex ||
        state.phase.reservation !== null
      )
        return state;
      return {
        ...state,
        phase: {
          ...state.phase,
          reservation: {
            submissionId: event.submissionId,
            entryId: event.entryId,
            authorSeat: event.authorSeat,
            turnIndex: event.turnIndex,
            reservedAt: event.reservedAt,
          },
        },
      };
    }
    case 'drawguess.drawing.committed': {
      if (state.phase.kind !== 'roundEnd' || state.turnIndex !== event.turnIndex) return state;
      return {
        ...state,
        phase: { ...state.phase, pngEntry: { ...event.pngEntry } },
      };
    }
    case 'drawguess.game.ended':
      return {
        ...state,
        phase: { kind: 'ended', totalScores: { ...event.totalScores } },
        phaseRevision: state.phaseRevision + 1,
        turnHistory: closeRoundEnd(state, event.type),
      };
    case 'drawguess.game.returnedToLobby':
      return resetDrawGuessGame(state);
  }
}
