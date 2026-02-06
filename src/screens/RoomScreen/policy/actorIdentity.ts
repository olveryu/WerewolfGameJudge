/**
 * actorIdentity.ts - Single source of truth for UI actor identity
 *
 * This module provides a pure function to determine the current actor identity
 * for UI interactions. When Host is controlling a bot seat (debug mode),
 * the actor identity switches to the bot's seat/role.
 *
 * Rules:
 * - actorSeatForUi/actorRoleForUi: Used for ALL action-related decisions
 *   (can I tap? what intent? what prompt? what submit actor?)
 * - mySeat/myRole: Only used for displaying "my real identity" in UI
 *
 * ❌ Do NOT import: React hooks, services, navigation, any IO
 * ❌ Do NOT provide default values (null means fail-fast at caller)
 */

import type { RoleId } from '../../../models/roles';

/**
 * Input for actor identity calculation.
 * All fields come from useGameRoom.
 */
export interface ActorIdentityInput {
  /** My real seat number (null if not seated) */
  mySeatNumber: number | null;
  /** My real role (null if no role assigned) */
  myRole: RoleId | null;
  /** Effective seat (= controlledSeat ?? mySeatNumber) */
  effectiveSeat: number | null;
  /** Effective role (= role of effectiveSeat) */
  effectiveRole: RoleId | null;
  /** Currently controlled bot seat (null if not controlling) */
  controlledSeat: number | null;
}

/**
 * Output: the actor identity to use for UI interactions.
 */
export interface ActorIdentity {
  /**
   * The seat number to use for all action-related UI decisions.
   * null if no valid actor (should NOOP/ALERT).
   */
  actorSeatForUi: number | null;

  /**
   * The role to use for all action-related UI decisions.
   * null if no valid actor role (should NOOP/ALERT).
   */
  actorRoleForUi: RoleId | null;

  /**
   * True if Host is currently delegating to a bot seat.
   * Used for UI hints (e.g., showing "controlling bot X" banner).
   */
  isDelegating: boolean;
}

/**
 * Calculate the actor identity for UI interactions.
 *
 * This is the SINGLE SOURCE OF TRUTH for determining:
 * - Which seat's perspective to use for action prompts
 * - Which role to check for imActioner / schema matching
 * - Which actor to submit actions as
 *
 * @param input - Identity fields from useGameRoom
 * @returns Actor identity for UI, with null values if invalid
 */
export function getActorIdentity(input: ActorIdentityInput): ActorIdentity {
  const { effectiveSeat, effectiveRole, controlledSeat } = input;

  const isDelegating = controlledSeat !== null;

  // When delegating, use effective (bot's) identity
  // When not delegating, use my real identity
  // Note: effectiveSeat/effectiveRole already handle the fallback in useGameRoom
  // so we just pass them through here
  const actorSeatForUi = effectiveSeat;
  const actorRoleForUi = effectiveRole;

  return {
    actorSeatForUi,
    actorRoleForUi,
    isDelegating,
  };
}

/**
 * Type guard: check if actor identity is valid for action submission.
 * If this returns false, the caller should NOOP/ALERT, not use default values.
 */
export function isActorIdentityValid(identity: ActorIdentity): boolean {
  return identity.actorSeatForUi !== null && identity.actorRoleForUi !== null;
}
