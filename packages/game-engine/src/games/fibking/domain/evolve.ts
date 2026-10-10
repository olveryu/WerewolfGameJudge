/** Pure FibKing event reducer. */

import { markSeatViewed } from '../../../platform/room/identityViewing';
import { applyRosterChanges, isBotOccupant } from '../../../platform/room/seating';
import { FIB_USED_WORD_LIMIT, type FibState } from '../state/types';
import type { FibEvent } from './events';

function applySeatChanges(
  state: FibState,
  event: Extract<FibEvent, { readonly type: 'fib.seats.changed' }>,
): FibState {
  return { ...state, roster: applyRosterChanges(state.roster, event.changes) };
}

function appendUsedWord(words: readonly string[], word: string): readonly string[] {
  const next = [...words, word];
  return next.length <= FIB_USED_WORD_LIMIT ? next : next.slice(next.length - FIB_USED_WORD_LIMIT);
}

export function evolveFibState(state: FibState, event: FibEvent): FibState {
  switch (event.type) {
    case 'fib.seats.changed':
      return applySeatChanges(state, event);
    case 'fib.profile.updated': {
      const occupant = state.roster[event.seat];
      if (occupant == null || isBotOccupant(occupant)) {
        throw new Error(`Fib profile event references empty real seat ${event.seat}`);
      }
      return {
        ...state,
        roster: {
          ...state.roster,
          [event.seat]: {
            ...occupant,
            profile: { ...occupant.profile, ...event.profile },
          },
        },
      };
    }
    case 'fib.config.updated':
      return { ...state, numberOfPlayers: event.numberOfPlayers };
    case 'fib.round.preparing':
      return {
        ...state,
        phase: 'preparing',
        pendingRound: event.pendingRound,
        preparationFailure: null,
        round: null,
      };
    case 'fib.round.preparationStageUpdated':
      if (state.phase !== 'preparing') {
        throw new Error('Fib preparation-stage event requires a preparing state');
      }
      return {
        ...state,
        pendingRound: {
          ...state.pendingRound,
          stage: event.stage,
        },
      };
    case 'fib.round.preparationCancelled':
      return {
        ...state,
        phase: 'lobby',
        pendingRound: null,
        preparationFailure: null,
        round: null,
      };
    case 'fib.round.preparationFailed':
      if (state.phase !== 'preparing') {
        throw new Error('Fib preparation-failed event requires a preparing state');
      }
      return {
        ...state,
        phase: 'preparationFailed',
        pendingRound: null,
        preparationFailure: {
          roundId: state.pendingRound.roundId,
          requestedAt: state.pendingRound.requestedAt,
          failedAt: event.failedAt,
          failureCode: event.failureCode,
        },
        round: null,
      };
    case 'fib.round.started':
      return {
        ...state,
        phase: 'viewing',
        pendingRound: null,
        preparationFailure: null,
        round: {
          roundId: event.roundId,
          word: event.word,
          definition: event.definition,
          source: event.source,
          roles: event.roles,
          viewedSeats: [...event.initialViewedSeats],
        },
        usedWords: appendUsedWord(state.usedWords, event.word),
      };
    case 'fib.role.viewed': {
      if (state.phase !== 'viewing' || state.round === null) {
        throw new Error('Fib role-viewed event requires a viewing state');
      }
      if (state.round.viewedSeats.includes(event.seat)) return state;
      return {
        ...state,
        round: {
          ...state.round,
          viewedSeats: markSeatViewed(state.round.viewedSeats, event.seat),
        },
      };
    }
    case 'fib.round.viewingCompleted': {
      if (state.phase !== 'viewing') {
        throw new Error('Fib viewing-completed event requires a viewing state');
      }
      return { ...state, phase: 'ongoing' };
    }
    case 'fib.round.ended':
      if (state.round === null) {
        throw new Error('Fib round-ended event requires an active round');
      }
      return {
        ...state,
        phase: 'ended',
        pendingRound: null,
        preparationFailure: null,
        round: state.round,
      };
    case 'fib.game.returnedToLobby':
      return {
        ...state,
        phase: 'lobby',
        pendingRound: null,
        preparationFailure: null,
        round: null,
      };
  }
  const exhaustive: never = event;
  return exhaustive;
}
