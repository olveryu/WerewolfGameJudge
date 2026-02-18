/**
 * WitchAction - Structured type for witch night actions
 *
 * The witch has two potions (first night only in this app):
 * - Save potion: revive the wolf's victim
 * - Poison potion: kill a player
 *
 * This is a discriminated union type for type-safe handling.
 * 导出类型定义、type guard 纯函数及工厂函数，不依赖 service、不含副作用或业务逻辑。
 */

// =============================================================================
// Types
// =============================================================================

/** Witch does nothing this night */
interface WitchActionNone {
  kind: 'none';
}

/** Witch uses save potion on a target */
interface WitchActionSave {
  kind: 'save';
  targetSeat: number; // 0-based seat number
}

/** Witch uses poison potion on a target */
interface WitchActionPoison {
  kind: 'poison';
  targetSeat: number; // 0-based seat number
}

/** Discriminated union for witch actions */
export type WitchAction = WitchActionNone | WitchActionSave | WitchActionPoison;

// =============================================================================
// Factory Functions
// =============================================================================

/** Create a "no action" witch action */
export function makeWitchNone(): WitchActionNone {
  return { kind: 'none' };
}

/** Create a "save" witch action */
export function makeWitchSave(targetSeat: number): WitchActionSave {
  return { kind: 'save', targetSeat };
}

/** Create a "poison" witch action */
export function makeWitchPoison(targetSeat: number): WitchActionPoison {
  return { kind: 'poison', targetSeat };
}

// =============================================================================
// Type Guards
// =============================================================================

/** Check if action is "none" */
export function isWitchNone(action: WitchAction): action is WitchActionNone {
  return action.kind === 'none';
}

/** Check if action is "save" */
export function isWitchSave(action: WitchAction): action is WitchActionSave {
  return action.kind === 'save';
}

/** Check if action is "poison" */
export function isWitchPoison(action: WitchAction): action is WitchActionPoison {
  return action.kind === 'poison';
}

// =============================================================================
// Accessors
// =============================================================================

/** Get save target seat, or undefined if not a save action or action is undefined */
export function getWitchSaveTarget(action: WitchAction | undefined): number | undefined {
  if (!action) return undefined;
  return isWitchSave(action) ? action.targetSeat : undefined;
}

/** Get poison target seat, or undefined if not a poison action or action is undefined */
export function getWitchPoisonTarget(action: WitchAction | undefined): number | undefined {
  if (!action) return undefined;
  return isWitchPoison(action) ? action.targetSeat : undefined;
}
