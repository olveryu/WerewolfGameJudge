/**
 * RoleAction - Unified structured type for all night actions
 *
 * This is a discriminated union that covers all possible night actions.
 * No magic numbers, no encoding/decoding - just plain structured data.
 *
 * ✅ 允许：类型定义、type guard 纯函数
 * ❌ 禁止：import service / 副作用 / 业务逻辑
 */

import { WitchAction } from './WitchAction';

// =============================================================================
// Types
// =============================================================================

/** No action taken by this role */
interface RoleActionNone {
  kind: 'none';
}

/** Single target action (wolf kill, seer check, guard protect, hunter, etc.) */
interface RoleActionTarget {
  kind: 'target';
  targetSeat: number; // 0-based seat number
}

/** Witch-specific action (save or poison) */
interface RoleActionWitch {
  kind: 'witch';
  witchAction: WitchAction;
}

/** Magician swap action (two targets) */
interface RoleActionMagicianSwap {
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
