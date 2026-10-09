/** Authoritative FibKing round visibility for human and controlled-bot perspectives. */

import { listUnviewedSeats } from '../../../platform/room/identityViewing';
import { findSeatByUserId } from '../../../platform/room/seating';
import type { FibRole, FibState, FibWordDefinition } from '../state/types';
import { getFibRole, getFibViewingParticipants } from '../state/types';

export interface FibViewingRoundView {
  readonly phase: 'viewing';
  readonly roundId: string;
  readonly viewerSeat: number | null;
  readonly viewerRole: FibRole | null;
  readonly word: string;
  readonly definition: FibWordDefinition | null;
  readonly guesserSeat: number;
  readonly honestSeat: null;
  /** The viewer (or the bot seat they control) has viewed this round's card. */
  readonly viewerHasViewed: boolean;
  /** Human seats still blocking the round start (bots never block). */
  readonly unviewedSeats: readonly number[];
}

export interface FibOngoingRoundView {
  readonly phase: 'ongoing';
  readonly roundId: string;
  readonly viewerSeat: number | null;
  readonly viewerRole: FibRole | null;
  readonly word: string;
  readonly definition: FibWordDefinition | null;
  readonly guesserSeat: number;
  readonly honestSeat: null;
}

export interface FibEndedRoundView {
  readonly phase: 'ended';
  readonly roundId: string;
  readonly viewerSeat: number | null;
  readonly viewerRole: FibRole | null;
  readonly word: string;
  readonly definition: FibWordDefinition;
  readonly guesserSeat: number;
  readonly honestSeat: number;
}

export type FibRoundView = FibViewingRoundView | FibOngoingRoundView | FibEndedRoundView;

export function getFibUserSeat(state: FibState, userId: string): number | null {
  return findSeatByUserId(state.realSeats, state.numberOfPlayers, userId);
}

function assertViewerSeat(state: FibState, viewerSeat: number): void {
  if (!Number.isSafeInteger(viewerSeat) || viewerSeat < 0 || viewerSeat >= state.numberOfPlayers) {
    throw new Error(`Invalid Fib viewer seat: ${viewerSeat}`);
  }
}

export function getFibRoundView(state: FibState, viewerSeat: number | null): FibRoundView | null {
  if (
    state.phase === 'lobby' ||
    state.phase === 'preparing' ||
    state.phase === 'preparationFailed'
  ) {
    return null;
  }

  if (viewerSeat !== null) assertViewerSeat(state, viewerSeat);

  if (state.phase === 'viewing') {
    const viewerRole = viewerSeat === null ? null : getFibRole(state.round.roles, viewerSeat);
    return {
      phase: 'viewing',
      roundId: state.round.roundId,
      viewerSeat,
      viewerRole,
      word: state.round.word,
      definition: viewerRole === 'honest' ? state.round.definition : null,
      guesserSeat: state.round.roles.guesserSeat,
      honestSeat: null,
      viewerHasViewed: viewerSeat !== null && state.round.viewedSeats.includes(viewerSeat),
      unviewedSeats: listUnviewedSeats(getFibViewingParticipants(state), state.round.viewedSeats)
        .filter((participant) => !participant.isBot)
        .map((participant) => participant.seat),
    };
  }

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

  if (viewerSeat === null) {
    return {
      phase: 'ongoing',
      roundId: state.round.roundId,
      viewerSeat: null,
      viewerRole: null,
      word: state.round.word,
      definition: state.round.definition,
      guesserSeat: state.round.roles.guesserSeat,
      honestSeat: null,
    };
  }
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
