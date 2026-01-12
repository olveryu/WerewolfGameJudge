/**
 * WitchActionCodec - Centralized encoding/decoding for witch actions
 *
 * The witch has two potions:
 * - Save potion: revive the wolf's victim
 * - Poison potion: kill a player
 *
 * Encoding scheme (single number for compact storage/transport):
 * - NO_ACTION (-1): Witch does nothing
 * - >= 0: Save target seat number
 * - < -1: Poison target seat number = -(value + 1)
 *
 * Examples:
 * - No action: -1
 * - Save seat 0: 0
 * - Save seat 5: 5
 * - Poison seat 0: -2
 * - Poison seat 1: -3
 * - Poison seat 5: -7
 */

// =============================================================================
// Constants
// =============================================================================

/** Encoded value for "no action" */
export const WITCH_NO_ACTION = -1;

// =============================================================================
// Types
// =============================================================================

/** Decoded witch action */
export interface WitchAction {
  type: 'none' | 'save' | 'poison';
  target?: number; // seat number (0-based), only for save/poison
}

// =============================================================================
// Encoding (structured → number)
// =============================================================================

/**
 * Encode witch action to a single number for storage/transport.
 */
export function encodeWitchAction(action: WitchAction): number {
  switch (action.type) {
    case 'none':
      return WITCH_NO_ACTION;
    case 'save':
      if (action.target === undefined) {
        throw new Error('Save action requires a target seat');
      }
      return action.target;
    case 'poison':
      if (action.target === undefined) {
        throw new Error('Poison action requires a target seat');
      }
      return -(action.target + 2); // seat 0 → -2, seat 1 → -3, etc.
  }
}

/**
 * Encode save action for a target seat.
 */
export function encodeWitchSave(targetSeat: number): number {
  return encodeWitchAction({ type: 'save', target: targetSeat });
}

/**
 * Encode poison action for a target seat.
 */
export function encodeWitchPoison(targetSeat: number): number {
  return encodeWitchAction({ type: 'poison', target: targetSeat });
}

/**
 * Encode no action.
 */
export function encodeWitchNoAction(): number {
  return WITCH_NO_ACTION;
}

// =============================================================================
// Decoding (number → structured)
// =============================================================================

/**
 * Decode a number to witch action.
 */
export function decodeWitchAction(encoded: number | undefined): WitchAction {
  if (encoded === undefined || encoded === WITCH_NO_ACTION) {
    return { type: 'none' };
  }
  if (encoded >= 0) {
    return { type: 'save', target: encoded };
  }
  // encoded < -1: poison, use Math.abs to avoid -0
  return { type: 'poison', target: Math.abs(encoded + 2) };
}

/**
 * Check if encoded value represents "no action".
 */
export function isWitchNoAction(encoded: number | undefined): boolean {
  return encoded === undefined || encoded === WITCH_NO_ACTION;
}

/**
 * Check if encoded value represents a save action.
 */
export function isWitchSave(encoded: number | undefined): boolean {
  return encoded !== undefined && encoded >= 0;
}

/**
 * Check if encoded value represents a poison action.
 */
export function isWitchPoison(encoded: number | undefined): boolean {
  return encoded !== undefined && encoded < WITCH_NO_ACTION;
}

/**
 * Get the save target from encoded value. Returns undefined if not a save action.
 */
export function getWitchSaveTarget(encoded: number | undefined): number | undefined {
  if (isWitchSave(encoded)) {
    return encoded;
  }
  return undefined;
}

/**
 * Get the poison target from encoded value. Returns undefined if not a poison action.
 */
export function getWitchPoisonTarget(encoded: number | undefined): number | undefined {
  if (encoded !== undefined && encoded < WITCH_NO_ACTION) {
    return -(encoded + 2);
  }
  return undefined;
}

// =============================================================================
// Legacy Compatibility
// =============================================================================

/**
 * Parse witch action into killed/saved (legacy format used by Room.ts).
 * Returns { killedByWitch, savedByWitch } where values are seat numbers or null.
 */
export function parseWitchActionLegacy(
  encoded: number | undefined
): { killedByWitch: number | null; savedByWitch: number | null } {
  const action = decodeWitchAction(encoded);
  switch (action.type) {
    case 'none':
      return { killedByWitch: null, savedByWitch: null };
    case 'save':
      return { killedByWitch: null, savedByWitch: action.target ?? null };
    case 'poison':
      return { killedByWitch: action.target ?? null, savedByWitch: null };
  }
}
