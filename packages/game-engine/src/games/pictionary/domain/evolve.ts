/** Pure Pictionary event reducer. */

import {
  applyRelayEntryAppended,
  applyRelayPhaseChanged,
  applyRelayRoundStarted,
  applyRelayTaskReady,
  clearRelayRound,
} from '../../../platform/room/relay/evolve';
import { mergeRoomSeatProfile } from '../../../platform/room/roster';
import { applyRosterChanges, isBotOccupant } from '../../../platform/room/seating';
import type { PictionaryEntry, PictionaryState } from '../state/types';
import type { PictionaryEvent } from './events';

function applySeatChanges(
  state: PictionaryState,
  event: Extract<PictionaryEvent, { readonly type: 'pictionary.seats.changed' }>,
): PictionaryState {
  return { ...state, roster: applyRosterChanges(state.roster, event.changes) };
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
            profile: mergeRoomSeatProfile(occupant.profile, event.profile),
          },
        },
      };
    }
    case 'pictionary.config.updated':
      return { ...state, config: event.config };
    case 'pictionary.round.started':
      return {
        ...state,
        ...applyRelayRoundStarted(state, {
          participants: event.participants,
          seatOrder: event.seatOrder,
          stepOffsets: event.stepOffsets,
          chains: event.chains,
          deadlineAt: event.deadlineAt,
        }),
        roundId: event.roundId,
        reservations: [],
      };
    case 'pictionary.task.readiness.changed':
      return { ...state, ...applyRelayTaskReady(state.readySeats, event.seat, event.isReady) };
    case 'pictionary.task.submitted':
      return {
        ...state,
        ...applyRelayEntryAppended(state.chains, event.chainId, event.entry),
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
      return { ...state, ...applyRelayPhaseChanged(state, event) };
    case 'pictionary.game.returnedToLobby':
      return { ...state, ...clearRelayRound<PictionaryEntry>(state), reservations: [] };
  }
  const exhaustive: never = event;
  return exhaustive;
}
