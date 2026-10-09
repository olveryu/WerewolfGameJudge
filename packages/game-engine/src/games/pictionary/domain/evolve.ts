/** Pure Pictionary event reducer. */

import { applyRosterChanges, isBotOccupant } from '../../../platform/room/seating';
import type { PictionaryEntry, PictionaryState } from '../state/types';
import type { PictionaryEvent } from './events';

function applySeatChanges(
  state: PictionaryState,
  event: Extract<PictionaryEvent, { readonly type: 'pictionary.seats.changed' }>,
): PictionaryState {
  return { ...state, roster: applyRosterChanges(state.roster, event.changes) };
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
      const occupant = state.roster[event.seat];
      if (occupant == null || isBotOccupant(occupant)) {
        throw new Error(`Pictionary profile event references empty seat ${event.seat}`);
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
    case 'pictionary.config.updated':
      return { ...state, config: event.config };
    case 'pictionary.round.started':
      return {
        ...state,
        phase: 'answering',
        phaseRevision: state.phaseRevision + 1,
        roundNumber: state.roundNumber + 1,
        roundId: event.roundId,
        participants: event.participants,
        seatOrder: event.seatOrder,
        stepOffsets: event.stepOffsets,
        stepIndex: 0,
        deadlineAt: event.deadlineAt,
        readySeats: [],
        reservations: [],
        chains: event.chains,
        gallery: null,
      };
    case 'pictionary.task.readiness.changed':
      return {
        ...state,
        readySeats: event.isReady
          ? [...state.readySeats, event.seat].sort((left, right) => left - right)
          : state.readySeats.filter((seat) => seat !== event.seat),
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
    case 'pictionary.round.aborted':
      return {
        ...state,
        phase: 'aborted',
        phaseRevision: state.phaseRevision + 1,
        deadlineAt: null,
        readySeats: [],
        reservations: [],
        gallery: null,
      };
    case 'pictionary.phase.changed':
      return {
        ...state,
        phase: event.phase,
        phaseRevision: state.phaseRevision + 1,
        stepIndex: event.stepIndex,
        deadlineAt: event.deadlineAt,
        readySeats: [],
        gallery: event.gallery,
      };
    case 'pictionary.game.returnedToLobby':
      return {
        ...state,
        phase: 'lobby',
        phaseRevision: state.phaseRevision + 1,
        roundId: null,
        participants: [],
        seatOrder: [],
        stepOffsets: [],
        stepIndex: -1,
        deadlineAt: null,
        readySeats: [],
        reservations: [],
        chains: [],
        gallery: null,
      };
  }
  const exhaustive: never = event;
  return exhaustive;
}
