/**
 * Player Iteration Helpers — eliminates Object.entries(state.players) boilerplate
 *
 * Provides type-safe wrappers for three common player iteration patterns,
 * avoiding manual Number.parseInt(seatStr, 10) key conversion every time.
 * Pure functions only, no IO.
 */
import type { RoleId, SchemaId } from './models';
import { getStepSpec } from './models/roles/spec';
import type { GameState } from './protocol/types';
import type { CurrentNightResults } from './resolvers/types';

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

export interface NightStepActor {
  readonly seat: number;
  readonly role: RoleId;
}

/**
 * Resolve the player who owns a role's night step.
 *
 * A directly seated role takes precedence. Otherwise, a treasure master or
 * thief that selected the role owns the step under their original role ID.
 */
export function resolveNightStepActor(state: GameState, stepRoleId: RoleId): NightStepActor | null {
  const directSeat = findSeatByRole(state.players, stepRoleId);
  if (directSeat !== null) return { seat: directSeat, role: stepRoleId };

  const results = state.currentNightResults;
  if (results === undefined) return null;

  const isTreasureMasterActor = results.treasureMasterChosenCard === stepRoleId;
  const isThiefActor = results.thiefChosenCard === stepRoleId;
  if (isTreasureMasterActor && isThiefActor) {
    throw new Error(`[FAIL-FAST] Night step ${stepRoleId} has two bottom-card actors`);
  }

  const actorRole = isTreasureMasterActor ? 'treasureMaster' : isThiefActor ? 'thief' : null;
  if (actorRole === null) return null;

  const actorSeat = actorRole === 'treasureMaster' ? state.treasureMasterSeat : state.thiefSeat;
  if (actorSeat === undefined) {
    throw new Error(`[FAIL-FAST] ${actorRole} selected ${stepRoleId} without an actor seat`);
  }
  const actor = state.players[actorSeat];
  if (actor === undefined || actor === null || actor.role !== actorRole) {
    throw new Error(`[FAIL-FAST] ${actorRole} actor seat ${actorSeat} is invalid`);
  }
  return { seat: actorSeat, role: actorRole };
}

/** Whether a planned step belongs only to an unselected physical bottom card. */
export function isVacantBottomCardStep(state: GameState, stepId: SchemaId): boolean {
  if (state.bottomCards === undefined) return false;
  const step = getStepSpec(stepId);
  if (step === undefined) throw new Error(`[FAIL-FAST] Unknown night step: ${stepId}`);
  if (!state.bottomCards.includes(step.roleId)) return false;
  if (state.currentNightResults === undefined) {
    throw new Error('[FAIL-FAST] Bottom-card step resolution requires currentNightResults');
  }
  return resolveNightStepActor(state, step.roleId) === null;
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
  currentNightResults?: CurrentNightResults,
): RoleId {
  if (role === 'thief' && currentNightResults?.thiefChosenCard) {
    return currentNightResults.thiefChosenCard;
  }
  if (role === 'treasureMaster' && currentNightResults?.treasureMasterChosenCard) {
    return currentNightResults.treasureMasterChosenCard;
  }
  return role;
}

/**
 * treasureMaster never participates in wolfVote (even after picking a wolf card,
 * they don't see wolves and don't vote). All wolfVote consumers exclude based on originalRole.
 */
export function isBottomCardWolfVoteExcluded(originalRole: RoleId): boolean {
  return originalRole === 'treasureMaster';
}
