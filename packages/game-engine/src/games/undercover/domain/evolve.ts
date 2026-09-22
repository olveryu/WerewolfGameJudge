/** Undercover event projection; resets discard phase-owned fields and preserve the roster. */

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
    realSeats: state.realSeats,
    botSeats: state.botSeats,
    usedWordPairIds: state.usedWordPairIds,
  };
  switch (event.type) {
    case 'undercover.seats.changed': {
      const realSeats = { ...state.realSeats };
      for (const change of event.changes) {
        if (change.next === null) delete realSeats[change.seat];
        else realSeats[change.seat] = change.next;
      }
      return { ...state, realSeats, botSeats: event.botSeats };
    }
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
        phase: 'reading',
        round: event.round,
        usedWordPairIds: [...new Set([...state.usedWordPairIds, event.round.wordPair.id])],
      };
    case 'undercover.round.confirmed': {
      if (state.phase !== 'reading') throw new Error('Expected reading Undercover state');
      const confirmedSeats = [...state.round.confirmedSeats, event.seat].sort(
        (left, right) => left - right,
      );
      return {
        ...base,
        phase: confirmedSeats.length === state.config.numberOfPlayers ? 'ongoing' : 'reading',
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
