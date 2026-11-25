/**
 * Player Iteration Helpers — eliminates Object.entries(state.players) boilerplate
 *
 * Provides type-safe wrappers for three common player iteration patterns,
 * avoiding manual Number.parseInt(seatStr, 10) key conversion every time.
 * Pure functions only, no IO.
 */
import {
  buildIdentityViewingParticipants,
  type IdentityViewingParticipant,
} from '../../../platform/room/identityViewing';
import { findRosterSeatByUserId } from '../../../platform/room/seating';
import type { RoleId } from './models';
import type { GameState } from './protocol/types';

type Players = GameState['players'];

/** Builds a seat -> RoleId map (only seats with assigned roles) */
export function buildSeatRoleMap(players: Players): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  for (const [seatStr, player] of Object.entries(players)) {
    if (player?.role) {
      map.set(Number.parseInt(seatStr, 10), player.role);
    }
  }
  return map;
}

/** Finds the seat holding the given role (returns null if not found) */
export function findSeatByRole(players: Players, roleId: RoleId): number | null {
  for (const [seatStr, player] of Object.entries(players)) {
    if (player?.role === roleId) {
      return Number.parseInt(seatStr, 10);
    }
  }
  return null;
}

/** Iterates over all non-empty seats, calling callback(seat, player) */
export function forEachSeatedPlayer(
  players: Players,
  callback: (seat: number, player: NonNullable<Players[number]>) => void,
): void {
  for (const [seatStr, player] of Object.entries(players)) {
    if (player !== null) {
      callback(Number.parseInt(seatStr, 10), player);
    }
  }
}

/**
 * Identity Viewing Protocol participants (AU-19): every seated player
 * with its bot flag. The viewed record itself lives in the state's
 * roleViewedSeats set; the participant list is derived from the
 * players record plus the roster's bot axis. `players` defaults to
 * the state's record; reducers pass the in-flight record they are
 * about to commit.
 */
export function getWerewolfViewingParticipants(
  state: GameState,
  players: Players = state.players,
): readonly IdentityViewingParticipant[] {
  // Werewolf's occupied seats live in the players record, not the
  // roster range; the {seat, isBot} construction itself is the
  // shared platform one.
  const seats: number[] = [];
  for (const [seatStr, player] of Object.entries(players)) {
    if (player === null) continue;
    seats.push(Number.parseInt(seatStr, 10));
  }
  return buildIdentityViewingParticipants(state.roster, seats);
}

/** Returns the seat held by a user, or null when they hold no seat. */
export function getWerewolfUserSeat(state: GameState, userId: string): number | null {
  return findRosterSeatByUserId(state.roster, Object.keys(state.players).length, userId);
}
