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
      return { ...state, fillEmptySeatsWithBots: event.isEnabled, excludedBotSeats: [] };
    case 'fib.botSeat.excluded':
      if (!state.fillEmptySeatsWithBots) {
        throw new Error('Fib bot-seat exclusion requires bot fill to be enabled');
      }
      if (state.excludedBotSeats.includes(event.seat)) {
        throw new Error(`Fib bot seat ${event.seat} is already excluded`);
      }
      return {
        ...state,
        excludedBotSeats: [...state.excludedBotSeats, event.seat].sort(
          (left, right) => left - right,
        ),
      };
    case 'fib.config.updated':
      return {
        ...state,
        numberOfPlayers: event.numberOfPlayers,
        excludedBotSeats: state.excludedBotSeats.filter((seat) => seat < event.numberOfPlayers),
      };
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
        phase: 'ongoing',
        pendingRound: null,
        preparationFailure: null,
        round: {
          roundId: event.roundId,
          catalogEntryId: event.catalogEntryId,
          catalogVersion: event.catalogVersion,
          word: event.word,
          definition: event.definition,
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
