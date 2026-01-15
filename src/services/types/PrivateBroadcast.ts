/**
 * PrivateBroadcast.ts - Private message payload types (sensitive information)
 * 
 * ANTI-CHEAT PRINCIPLE:
 * - All sensitive game information MUST be sent via sendPrivate(toUid, payload)
 * - Only the recipient (toUid) can see the message
 * - Host player also only sees messages sent TO them (no visibility privilege)
 * - Zero-Trust: UI filters by toUid === myUid
 * 
 * @see docs/phase4-final-migration.md for full architecture
 */

// =============================================================================
// Private Message Container
// =============================================================================

/**
 * Private message wrapper.
 * 
 * IMPORTANT:
 * - `toUid` is REQUIRED - specifies the sole recipient
 * - `revision` binds the message to a specific game turn (prevents cross-turn contamination)
 * - UI must filter: only process if toUid === myUid
 */
export interface PrivateMessage {
  type: 'PRIVATE_EFFECT';
  toUid: string;           // Required: sole recipient
  revision: number;        // Required: bind to game turn
  payload: PrivatePayload;
}

// =============================================================================
// Private Payload Union
// =============================================================================

/**
 * Private payload types - sensitive information only.
 * sendPrivate() ONLY accepts these types (compiler-enforced).
 */
export type PrivatePayload =
  | WitchContextPayload
  | SeerRevealPayload
  | PsychicRevealPayload
  | GargoyleRevealPayload
  | WolfRobotRevealPayload
  | BlockedPayload
  | ActionRejectedPayload;

// =============================================================================
// Private Payload Types
// =============================================================================

/**
 * Witch context - sent to witch when her turn starts.
 * Contains sensitive kill info that only witch should see.
 */
export interface WitchContextPayload {
  kind: 'WITCH_CONTEXT';
  /** Seat killed by wolves (-1 = empty kill) */
  killedIndex: number;
  /** Whether witch can save (Host already checked: not self, has antidote) */
  canSave: boolean;
  /** Whether witch has poison available */
  canPoison: boolean;
  /** Current phase of witch action */
  phase: 'save' | 'poison';
}

/**
 * Seer reveal - sent to seer after checking a target.
 */
export interface SeerRevealPayload {
  kind: 'SEER_REVEAL';
  targetSeat: number;
  result: '好人' | '狼人';
}

/**
 * Psychic reveal - sent to psychic after checking a target.
 */
export interface PsychicRevealPayload {
  kind: 'PSYCHIC_REVEAL';
  targetSeat: number;
  /** The specific role name */
  result: string;
}

/**
 * Gargoyle reveal - sent to gargoyle after checking a target.
 * Returns exact role identity (same as psychic).
 */
export interface GargoyleRevealPayload {
  kind: 'GARGOYLE_REVEAL';
  targetSeat: number;
  /** The specific role name */
  result: string;
}

/**
 * Wolf Robot reveal - sent to wolf robot after learning a target's identity.
 * Returns exact role identity.
 */
export interface WolfRobotRevealPayload {
  kind: 'WOLF_ROBOT_REVEAL';
  targetSeat: number;
  /** The specific role name */
  result: string;
}

/**
 * Blocked notification - sent to a player whose action is blocked.
 * E.g., nightmare blocking another role's skill.
 */
export interface BlockedPayload {
  kind: 'BLOCKED';
  reason: 'nightmare';
}

/**
 * Action rejected - sent when Host rejects a player's action.
 * 
 * Use cases:
 * - Nightmare-blocked player attempts non-skip action
 * - (Future) Other gate rejections
 * 
 * UI should display `reason` to the player.
 */
export interface ActionRejectedPayload {
  kind: 'ACTION_REJECTED';
  /** Which action was rejected */
  action: 'submitAction' | 'submitWolfVote';
  /** Human-readable reason (display to player) */
  reason: string;
}

// =============================================================================
// Inbox Key Helper
// =============================================================================

/**
 * Generate inbox key for private message storage.
 * Format: `${revision}_${kind}` or `${revision}_${schemaId}_${requestId}`
 * 
 * Used by usePrivateInbox hook to prevent cross-turn contamination.
 */
export type InboxKey = `${number}_${string}`;

export function makeInboxKey(revision: number, kind: string, requestId?: string): InboxKey {
  if (requestId) {
    return `${revision}_${kind}_${requestId}`;
  }
  return `${revision}_${kind}`;
}
