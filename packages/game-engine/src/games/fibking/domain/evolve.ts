/** Pure FibKing event reducer. */

import { FIB_USED_WORD_LIMIT, type FibHumanSeat, type FibState } from '../state/types';
import type { FibEvent } from './events';

function applySeatChanges(
  state: FibState,
  event: Extract<FibEvent, { readonly type: 'fib.seats.changed' }>,
): FibState {
  const realSeats: Record<number, FibHumanSeat | undefined> = { ...state.realSeats };
  for (const change of event.changes) {
    if (change.next === null) {
      delete realSeats[change.seat];
    } else {
      realSeats[change.seat] = change.next;
    }
  }
  return { ...state, realSeats };
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
      const occupant = state.realSeats[event.seat];
      if (occupant === undefined) {
        throw new Error(`Fib profile event references empty real seat ${event.seat}`);
      }
      return {
        ...state,
        realSeats: {
          ...state.realSeats,
          [event.seat]: {
            ...occupant,
            profile: { ...occupant.profile, ...event.profile },
          },
        },
      };
    }
    case 'fib.botFill.changed':
      return { ...state, fillEmptySeatsWithBots: event.isEnabled };
    case 'fib.config.updated':
      return { ...state, numberOfPlayers: event.numberOfPlayers };
    case 'fib.round.preparing':
      return {
        ...state,
        phase: 'preparing',
        pendingRound: event.pendingRound,
        round: null,
      };
    case 'fib.round.preparationCancelled':
      return { ...state, phase: 'lobby', pendingRound: null, round: null };
    case 'fib.round.started':
      return {
        ...state,
        phase: 'ongoing',
        pendingRound: null,
        round: {
          roundId: event.roundId,
          word: event.word,
          definition: event.definition,
          source: event.source,
          roles: event.roles,
        },
        usedWords: appendUsedWord(state.usedWords, event.word),
      };
    case 'fib.round.ended':
      if (state.round === null) {
        throw new Error('Fib round-ended event requires an active round');
      }
      return { ...state, phase: 'ended', pendingRound: null, round: state.round };
  }
  const exhaustive: never = event;
  return exhaustive;
}
