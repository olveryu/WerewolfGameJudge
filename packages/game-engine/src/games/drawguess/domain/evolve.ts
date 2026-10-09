/** Applies DrawGuess domain events; reset paths clear all turn-owned state. */

import { applyRosterChanges } from '../../../platform/room/seating';
import type { DrawGuessState } from '../state/types';
import type { DrawGuessEvent } from './decision';

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
      };
    }
    case 'drawguess.words.dealt': {
      if (state.phase.kind !== 'wordSelect' || state.turnIndex !== event.turnIndex) return state;
      return {
        ...state,
        phase: { ...state.phase, choices: [...event.choices], deadlineAt: event.deadlineAt },
        phaseRevision: state.phaseRevision + 1,
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
        phaseRevision: state.phaseRevision + 1,
      };
    }
    case 'drawguess.stroke.undone': {
      if (state.phase.kind !== 'drawing' || state.turnIndex !== event.turnIndex) return state;
      return {
        ...state,
        phase: { ...state.phase, strokes: state.phase.strokes.slice(0, -1) },
        phaseRevision: state.phaseRevision + 1,
      };
    }
    case 'drawguess.strokes.cleared': {
      if (state.phase.kind !== 'drawing' || state.turnIndex !== event.turnIndex) return state;
      return {
        ...state,
        phase: { ...state.phase, strokes: [] },
        phaseRevision: state.phaseRevision + 1,
      };
    }
    case 'drawguess.guess.submitted': {
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
        },
        scores,
        phaseRevision: state.phaseRevision + 1,
      };
    }
    case 'drawguess.round.ended': {
      if (state.turnIndex !== event.turnIndex) return state;
      const roundScores = state.phase.kind === 'drawing' ? { ...state.phase.turnScores } : {};
      return {
        ...state,
        phase: {
          kind: 'roundEnd',
          drawerSeat: event.drawerSeat,
          word: event.word,
          strokes: state.phase.kind === 'drawing' ? [...state.phase.strokes] : [],
          roundScores,
          pngEntry: null,
          reservation: null,
          deadlineAt: event.deadlineAt,
        },
        phaseRevision: state.phaseRevision + 1,
      };
    }
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
        phaseRevision: state.phaseRevision + 1,
      };
    }
    case 'drawguess.drawing.committed': {
      if (state.phase.kind !== 'roundEnd' || state.turnIndex !== event.turnIndex) return state;
      return {
        ...state,
        phase: { ...state.phase, pngEntry: { ...event.pngEntry } },
        phaseRevision: state.phaseRevision + 1,
      };
    }
    case 'drawguess.game.ended':
      return {
        ...state,
        phase: { kind: 'ended', totalScores: { ...event.totalScores } },
        phaseRevision: state.phaseRevision + 1,
      };
    case 'drawguess.game.returnedToLobby':
      return resetDrawGuessGame(state);
  }
}
