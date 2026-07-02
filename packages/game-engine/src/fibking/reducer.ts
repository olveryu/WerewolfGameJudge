/**
 * fibking reducer — pure, total, immutable FibState transitions.
 *
 * Mirrors the werewolf reducer contract (pure (state, action) -> state) but over FibState
 * and FibAction only. Phase/round invariants are enforced by normalizeFibState after the
 * full action batch is applied, so individual actions may transiently break them.
 */

import type { FibAction, FibSeat, FibState } from './types';
import { FIB_USED_WORDS_CAP } from './types';

/** Build a fresh sparse occupied-seat map. Empty seats are omitted. */
export function emptySeats(): Record<number, FibSeat> {
  return {};
}

/** Append a word, trimming oldest entries beyond the ring-buffer cap. */
function appendUsedWord(used: string[], word: string): string[] {
  const next = [...used, word];
  return next.length > FIB_USED_WORDS_CAP ? next.slice(next.length - FIB_USED_WORDS_CAP) : next;
}

export function fibReducer(state: FibState, action: FibAction): FibState {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.phase };

    case 'SET_SEAT': {
      const seats = { ...state.seats };
      if (action.value === null) {
        delete seats[action.seat];
      } else {
        seats[action.seat] = action.value;
      }
      return { ...state, seats };
    }

    case 'SET_ROSTER':
      return { ...state, roster: { ...state.roster, [action.userId]: action.entry } };

    case 'REMOVE_ROSTER': {
      const roster = { ...state.roster };
      delete roster[action.userId];
      return { ...state, roster };
    }

    case 'RESIZE_SEATS':
      return {
        ...state,
        numberOfPlayers: action.numberOfPlayers,
      };

    case 'CLEAR_ALL_SEATS':
      return { ...state, seats: emptySeats(), roster: {} };

    case 'SET_ROUND':
      return {
        ...state,
        word: action.word,
        definition: action.definition,
        roleBySeat: action.roleBySeat,
        wordSource: action.wordSource,
      };

    case 'CLEAR_ROUND':
      return {
        ...state,
        word: undefined,
        definition: undefined,
        roleBySeat: undefined,
        wordSource: undefined,
      };

    case 'ADD_USED_WORD':
      return { ...state, usedWords: appendUsedWord(state.usedWords, action.word) };

    case 'CLEAR_USED_WORDS':
      return { ...state, usedWords: [] };

    default: {
      const exhaustive: never = action;
      throw new Error(`fibReducer: unhandled action ${JSON.stringify(exhaustive)}`);
    }
  }
}
