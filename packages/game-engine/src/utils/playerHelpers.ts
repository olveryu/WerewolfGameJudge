/**
 * Player Iteration Helpers — eliminates Object.entries(state.players) boilerplate
 *
 * Provides type-safe wrappers for three common player iteration patterns,
 * avoiding manual Number.parseInt(seatStr, 10) key conversion every time.
 * Pure functions only, no IO.
 */
import type { RoleId } from '../werewolf/models';
import type { WerewolfState } from '../werewolf/protocol/types';

type Players = WerewolfState['players'];

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
 * Returns the effective role for deck-card roles (thief / treasureMaster).
 *
 * After a deck-card role selects a card, they act as that card's identity (wolf vote, witch potions, etc.),
 * but player.role always retains the original role. This function provides the unified
 * "original role -> effective role" mapping, used for wolf-vote participation, UI actioner
 * resolution, progression completeness checks, etc.
 *
 * Returns as-is for non-deck-card roles or when no card has been chosen.
 */
export function getBottomCardEffectiveRole(
  role: RoleId,
  thiefChosenCard?: RoleId | null,
  treasureMasterChosenCard?: RoleId | null,
): RoleId {
  if (role === 'thief' && thiefChosenCard) return thiefChosenCard;
  if (role === 'treasureMaster' && treasureMasterChosenCard) return treasureMasterChosenCard;
  return role;
}

/**
 * treasureMaster never participates in wolfVote (even after picking a wolf card,
 * they don't see wolves and don't vote). All wolfVote consumers exclude based on originalRole.
 */
export function isBottomCardWolfVoteExcluded(originalRole: RoleId): boolean {
  return originalRole === 'treasureMaster';
}
