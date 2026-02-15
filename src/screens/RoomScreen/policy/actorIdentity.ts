/**
 * actorIdentity.ts - Single source of truth for UI actor identity
 *
 * This module provides a pure function to determine the current actor identity
 * for UI interactions. When Host is controlling a bot seat (debug mode),
 * the actor identity switches to the bot's seat/role.
 *
 * Rules:
 * - When NOT delegating (controlledSeat === null):
 *   actorSeatForUi = mySeatNumber, actorRoleForUi = myRole
 * - When delegating (controlledSeat !== null):
 *   actorSeatForUi = effectiveSeat, actorRoleForUi = effectiveRole
 *   (with consistency check: effectiveSeat must equal controlledSeat)
 *
 * ❌ Do NOT import: React hooks, services, navigation, any IO
 * ❌ Do NOT provide default values (null means fail-fast at caller)
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

/**
 * Input for actor identity calculation.
 * All fields come from useGameRoom.
 */
export interface ActorIdentityInput {
  /** My real seat number (null if not seated) */
  mySeatNumber: number | null;
  /** My real role (null if no role assigned) */
  myRole: RoleId | null;
  /** Effective seat (= controlledSeat ?? mySeatNumber, computed by useGameRoom) */
  effectiveSeat: number | null;
  /** Effective role (= role of effectiveSeat, computed by useGameRoom) */
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
 * Rules:
 * - NOT delegating: use my real identity (mySeatNumber, myRole)
 * - Delegating: use bot identity (effectiveSeat, effectiveRole)
 *   with consistency check (effectiveSeat must equal controlledSeat)
 *
 * @param input - Identity fields from useGameRoom
 * @returns Actor identity for UI, with null values if invalid/inconsistent
 */
export function getActorIdentity(input: ActorIdentityInput): ActorIdentity {
  const { mySeatNumber, myRole, effectiveSeat, effectiveRole, controlledSeat } = input;

  const isDelegating = controlledSeat !== null;

  if (!isDelegating) {
    // Not delegating: use my real identity
    return {
      actorSeatForUi: mySeatNumber,
      actorRoleForUi: myRole,
      isDelegating: false,
    };
  }

  // Delegating: use bot identity with consistency check
  // FAIL-FAST: effectiveSeat must equal controlledSeat (prevent drift)
  if (effectiveSeat !== controlledSeat) {
    // Inconsistent state - return invalid identity
    // Caller should NOOP/ALERT, not use default values
    return {
      actorSeatForUi: null,
      actorRoleForUi: null,
      isDelegating: true,
    };
  }

  return {
    actorSeatForUi: effectiveSeat,
    actorRoleForUi: effectiveRole,
    isDelegating: true,
  };
}

/**
 * Type guard: check if actor identity is valid for action submission.
 * If this returns false, the caller should NOOP/ALERT, not use default values.
 */
export function isActorIdentityValid(identity: ActorIdentity): boolean {
  return identity.actorSeatForUi !== null && identity.actorRoleForUi !== null;
}
