/** Authoritative FibKing round visibility for human and controlled-bot perspectives. */

import { findSeatByUserId } from '../../../platform/room/seating';
import type { FibRole, FibState } from '../state/types';
import { getFibRole } from '../state/types';

export interface FibOngoingRoundView {
  readonly phase: 'ongoing';
  readonly roundId: string;
  readonly viewerSeat: number;
  readonly viewerRole: FibRole;
  readonly word: string;
  readonly definition: string | null;
  readonly guesserSeat: number;
  readonly honestSeat: null;
}

export interface FibEndedRoundView {
  readonly phase: 'ended';
  readonly roundId: string;
  readonly viewerSeat: number | null;
  readonly viewerRole: FibRole | null;
  readonly word: string;
  readonly definition: string;
  readonly guesserSeat: number;
  readonly honestSeat: number;
}

export type FibRoundView = FibOngoingRoundView | FibEndedRoundView;

export function getFibUserSeat(state: FibState, userId: string): number | null {
  return findSeatByUserId(state.realSeats, state.numberOfPlayers, userId);
}

function assertViewerSeat(state: FibState, viewerSeat: number): void {
  if (!Number.isSafeInteger(viewerSeat) || viewerSeat < 0 || viewerSeat >= state.numberOfPlayers) {
    throw new Error(`Invalid Fib viewer seat: ${viewerSeat}`);
  }
}

export function getFibRoundView(state: FibState, viewerSeat: number | null): FibRoundView | null {
  if (state.phase === 'lobby' || state.phase === 'preparing') return null;

  if (viewerSeat !== null) assertViewerSeat(state, viewerSeat);

  if (state.phase === 'ended') {
    return {
      phase: 'ended',
      roundId: state.round.roundId,
      viewerSeat,
      viewerRole: viewerSeat === null ? null : getFibRole(state.round.roles, viewerSeat),
      word: state.round.word,
      definition: state.round.definition,
      guesserSeat: state.round.roles.guesserSeat,
      honestSeat: state.round.roles.honestSeat,
    };
  }

  if (viewerSeat === null) return null;
  const viewerRole = getFibRole(state.round.roles, viewerSeat);
  return {
    phase: 'ongoing',
    roundId: state.round.roundId,
    viewerSeat,
    viewerRole,
    word: state.round.word,
    definition: viewerRole === 'honest' ? state.round.definition : null,
    guesserSeat: state.round.roles.guesserSeat,
    honestSeat: null,
  };
}
