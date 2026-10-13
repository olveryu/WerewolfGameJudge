/** Undercover event projection; resets discard phase-owned fields and preserve the roster. */

import { appendRevelation } from '../../../platform/room/hostReveal';
import { markSeatViewed } from '../../../platform/room/identityViewing';
import { applyRosterChanges } from '../../../platform/room/seating';
import type { UndercoverState } from '../state/types';
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
        // Every round starts in the viewing stage: play opens only
        // when the host begins after every seat (bots via the host
        // scaffold action) has confirmed.
        phase: 'viewing',
        round: event.round,
        usedWordPairIds: [...new Set([...state.usedWordPairIds, event.round.wordPair.id])],
      };
    case 'undercover.round.confirmed': {
      if (state.phase !== 'viewing') throw new Error('Expected viewing Undercover state');
      const confirmedSeats = markSeatViewed(state.round.confirmedSeats, event.seat);
      return { ...base, phase: 'viewing', round: { ...state.round, confirmedSeats } };
    }
    case 'undercover.round.begun': {
      if (state.phase !== 'viewing') throw new Error('Expected viewing Undercover state');
      return { ...base, phase: 'ongoing', round: state.round };
    }
    case 'undercover.round.revealed': {
      if (state.phase !== 'ongoing') throw new Error('Expected ongoing Undercover state');
      const round = {
        ...state.round,
        revelations: appendRevelation(
          state.round.revelations,
          event.revelation.seat,
          event.revelation.role,
          event.revelation.revealedAt,
        ),
      };
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
