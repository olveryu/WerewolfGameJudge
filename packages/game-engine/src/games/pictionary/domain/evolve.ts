/** Pure Pictionary event reducer. */

import type { PictionaryEntry, PictionaryHumanSeat, PictionaryState } from '../state/types';
import type { PictionaryEvent } from './events';

function applySeatChanges(
  state: PictionaryState,
  event: Extract<PictionaryEvent, { readonly type: 'pictionary.seats.changed' }>,
): PictionaryState {
  const realSeats: Record<number, PictionaryHumanSeat | undefined> = { ...state.realSeats };
  for (const change of event.changes) {
    if (change.next === null) delete realSeats[change.seat];
    else realSeats[change.seat] = change.next;
  }
  return { ...state, realSeats };
}

function appendEntry(
  state: PictionaryState,
  chainId: string,
  entry: PictionaryEntry,
): PictionaryState['chains'] {
  return state.chains.map((chain) =>
    chain.id === chainId ? { ...chain, entries: [...chain.entries, entry] } : chain,
  );
}

export function evolvePictionaryState(
  state: PictionaryState,
  event: PictionaryEvent,
): PictionaryState {
  switch (event.type) {
    case 'pictionary.seats.changed':
      return applySeatChanges(state, event);
    case 'pictionary.profile.updated': {
      const occupant = state.realSeats[event.seat];
      if (occupant === undefined) {
        throw new Error(`Pictionary profile event references empty seat ${event.seat}`);
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
    case 'pictionary.config.updated':
      return { ...state, config: event.config };
    case 'pictionary.round.started':
      return {
        ...state,
        phase: 'answering',
        phaseRevision: state.phaseRevision + 1,
        roundNumber: state.roundNumber + 1,
        roundId: event.roundId,
        seatOrder: event.seatOrder,
        stepIndex: 0,
        deadlineAt: event.deadlineAt,
        reservations: [],
        chains: event.chains,
        gallery: null,
      };
    case 'pictionary.task.submitted':
      return {
        ...state,
        chains: appendEntry(state, event.chainId, event.entry),
        reservations:
          event.submissionId === null
            ? state.reservations
            : state.reservations.filter(
                (reservation) => reservation.submissionId !== event.submissionId,
              ),
      };
    case 'pictionary.drawing.reserved':
      return { ...state, reservations: [...state.reservations, event.reservation] };
    case 'pictionary.tasks.missed': {
      let chains = state.chains;
      for (const missed of event.entries) {
        chains = appendEntry({ ...state, chains }, missed.chainId, missed.entry);
      }
      const removedSubmissionIds = new Set(event.submissionIds);
      return {
        ...state,
        chains,
        reservations: state.reservations.filter(
          (reservation) => !removedSubmissionIds.has(reservation.submissionId),
        ),
      };
    }
    case 'pictionary.phase.changed':
      return {
        ...state,
        phase: event.phase,
        phaseRevision: state.phaseRevision + 1,
        stepIndex: event.stepIndex,
        deadlineAt: event.deadlineAt,
        gallery: event.gallery,
      };
    case 'pictionary.game.returnedToLobby':
      return {
        ...state,
        phase: 'lobby',
        phaseRevision: state.phaseRevision + 1,
        roundId: null,
        seatOrder: [],
        stepIndex: -1,
        deadlineAt: null,
        reservations: [],
        chains: [],
        gallery: null,
      };
  }
  const exhaustive: never = event;
  return exhaustive;
}
