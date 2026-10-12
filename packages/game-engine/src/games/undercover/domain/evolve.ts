/** Undercover event projection; resets discard phase-owned fields and preserve the roster. */

import { haveAllViewed, markSeatViewed } from '../../../platform/room/identityViewing';
import { applyRosterChanges } from '../../../platform/room/seating';
import { getUndercoverViewingParticipants, type UndercoverState } from '../state/types';
import type { UndercoverEvent } from './events';

/** Projects validated domain events without side effects. */
export function evolveUndercoverState(
  state: UndercoverState,
  event: UndercoverEvent,
): UndercoverState {
  const base = {
    gameType: state.gameType,
    stateVersion: state.stateVersion,
    roomCode: state.roomCode,
    hostUserId: state.hostUserId,
    config: state.config,
    roster: state.roster,
    usedWordPairIds: state.usedWordPairIds,
  };
  switch (event.type) {
    case 'undercover.seats.changed':
      return { ...state, roster: applyRosterChanges(state.roster, event.changes) };
    case 'undercover.config.updated':
      return { ...state, config: event.config };
    case 'undercover.round.preparing':
      return { ...base, phase: 'preparing', pendingRound: event.pendingRound, round: null };
    case 'undercover.round.failed':
      if (state.phase !== 'preparing') throw new Error('Expected preparing Undercover state');
      return {
        ...base,
        phase: 'preparationFailed',
        round: null,
        pendingRound: state.pendingRound,
        failureCode: event.failureCode,
      };
    case 'undercover.round.started':
      return {
        ...base,
        // Every round starts in reading: the checkpoint completes
        // only when every seat (bots via the host scaffold action)
        // has confirmed.
        phase: 'reading',
        round: event.round,
        usedWordPairIds: [...new Set([...state.usedWordPairIds, event.round.wordPair.id])],
      };
    case 'undercover.round.confirmed': {
      if (state.phase !== 'reading') throw new Error('Expected reading Undercover state');
      const confirmedSeats = markSeatViewed(state.round.confirmedSeats, event.seat);
      const allViewed = haveAllViewed(getUndercoverViewingParticipants(state), confirmedSeats);
      return {
        ...base,
        phase: allViewed ? 'ongoing' : 'reading',
        round: { ...state.round, confirmedSeats },
      };
    }
    case 'undercover.round.revealed': {
      if (state.phase !== 'ongoing') throw new Error('Expected ongoing Undercover state');
      const round = { ...state.round, revelations: [...state.round.revelations, event.revelation] };
      return event.winner === null
        ? { ...base, phase: 'ongoing', round }
        : { ...base, phase: 'ended', round, winner: event.winner };
    }
    case 'undercover.round.aborted':
      return { ...base, phase: 'aborted', round: state.round };
    case 'undercover.game.returnedToLobby':
      return { ...base, phase: 'lobby', round: null };
  }
}
