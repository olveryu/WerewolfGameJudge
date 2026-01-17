/**
 * RoleAction - Unified structured type for all night actions
 *
 * This is a discriminated union that covers all possible night actions.
 * No magic numbers, no encoding/decoding - just plain structured data.
 */

import { WitchAction } from './WitchAction';

// =============================================================================
// Types
// =============================================================================

/** No action taken by this role */
export interface RoleActionNone {
  kind: 'none';
}

/** Single target action (wolf kill, seer check, guard protect, hunter, etc.) */
export interface RoleActionTarget {
  kind: 'target';
  targetSeat: number; // 0-based seat number
}

/** Witch-specific action (save or poison) */
export interface RoleActionWitch {
  kind: 'witch';
  witchAction: WitchAction;
}

/** Magician swap action (two targets) */
export interface RoleActionMagicianSwap {
  kind: 'magicianSwap';
  firstSeat: number;
  secondSeat: number;
}

/** Discriminated union for all role actions */
export type RoleAction =
  | RoleActionNone
  | RoleActionTarget
  | RoleActionWitch
  | RoleActionMagicianSwap;

// =============================================================================
// Factory Functions
// =============================================================================

/** Create a "no action" */
export function makeActionNone(): RoleActionNone {
  return { kind: 'none' };
}

/** Create a single target action */
export function makeActionTarget(targetSeat: number): RoleActionTarget {
  return { kind: 'target', targetSeat };
}

/** Create a witch action wrapper */
export function makeActionWitch(witchAction: WitchAction): RoleActionWitch {
  return { kind: 'witch', witchAction };
}

/** Create a magician swap action */
export function makeActionMagicianSwap(
  firstSeat: number,
  secondSeat: number,
): RoleActionMagicianSwap {
  return { kind: 'magicianSwap', firstSeat, secondSeat };
}

// =============================================================================
// Type Guards
// =============================================================================

export function isActionNone(action: RoleAction): action is RoleActionNone {
  return action.kind === 'none';
}

export function isActionTarget(action: RoleAction): action is RoleActionTarget {
  return action.kind === 'target';
}

export function isActionWitch(action: RoleAction): action is RoleActionWitch {
  return action.kind === 'witch';
}

export function isActionMagicianSwap(action: RoleAction): action is RoleActionMagicianSwap {
  return action.kind === 'magicianSwap';
}

// =============================================================================
// Accessors
// =============================================================================

/** Get target seat from a target action, or undefined */
export function getActionTargetSeat(action: RoleAction | undefined): number | undefined {
  if (!action) return undefined;
  if (isActionTarget(action)) return action.targetSeat;
  return undefined;
}
