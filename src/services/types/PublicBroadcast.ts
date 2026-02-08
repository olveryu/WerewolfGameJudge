/**
 * PublicBroadcast.ts - Public broadcast payload types (whitelist-based)
 *
 * ANTI-CHEAT PRINCIPLE:
 * - Only these whitelisted fields can be broadcast to all players
 * - Sensitive information (killedIndex, checkResult, etc.) MUST use PrivateBroadcast
 * - Compiler enforces type separation via broadcastPublic() API
 *
 * @see docs/phase4-final-migration.md for full architecture
 */

import type { RoleId } from '@/models/roles';
import type { SchemaId } from '@/models/roles/spec';

// =============================================================================
// Public Payload Union (Whitelist)
// =============================================================================

/**
 * Public broadcast payload union type.
 * broadcastPublic() ONLY accepts these types (compiler-enforced).
 *
 * ❌ FORBIDDEN in public payloads:
 *    killedIndex, checkResult, seerResult, psychicResult, canSave,
 *    selectableSeats, blockedSeat, nightmareBlockedSeat, actions
 */
export type PublicPayload =
  | PublicStateUpdate
  | PublicRoleTurn
  | PublicNightEnd
  | PublicPlayerJoined
  | PublicPlayerLeft
  | PublicGameRestarted
  | PublicSeatActionAck
  | PublicSeatRejected
  | PublicSnapshotResponse;

// =============================================================================
// Public Message Types
// =============================================================================

export interface PublicStateUpdate {
  type: 'STATE_UPDATE';
  revision: number;
  state: PublicGameState;
}

export interface PublicRoleTurn {
  type: 'ROLE_TURN';
  role: RoleId;
  stepId?: SchemaId;
  pendingSeats?: number[];
  // ❌ FORBIDDEN: killedIndex, checkResult, canSave, selectableSeats
}

export interface PublicNightEnd {
  type: 'NIGHT_END';
  deaths: number[];
}

export interface PublicPlayerJoined {
  type: 'PLAYER_JOINED';
  seat: number;
  player: PublicPlayer;
}

export interface PublicPlayerLeft {
  type: 'PLAYER_LEFT';
  seat: number;
}

export interface PublicGameRestarted {
  type: 'GAME_RESTARTED';
}

export interface PublicSeatActionAck {
  type: 'SEAT_ACTION_ACK';
  requestId: string;
  toUid: string;
  success: boolean;
  seat: number;
  reason?: string;
}

export interface PublicSeatRejected {
  type: 'SEAT_REJECTED';
  seat: number;
  requestUid: string;
  reason: 'seat_taken';
}

export interface PublicSnapshotResponse {
  type: 'SNAPSHOT_RESPONSE';
  requestId: string;
  toUid: string;
  state: PublicGameState;
  revision: number;
}

// =============================================================================
// Public Game State (Whitelist)
// =============================================================================

/**
 * Public game state - only whitelisted fields.
 * This is what all players can see.
 *
 * ❌ FORBIDDEN fields (must use private messages):
 *    - nightmareBlockedSeat (use BLOCKED private message)
 *    - killedIndex (use WITCH_CONTEXT private message)
 *    - selectableSeats (UI calculates locally from schema)
 *    - actions (never broadcast)
 */
export interface PublicGameState {
  roomCode: string;
  hostUid: string;
  status: 'unseated' | 'seated' | 'assigned' | 'ready' | 'ongoing' | 'ended';
  templateRoles: RoleId[];
  players: Record<number, PublicPlayer | null>;
  currentActionerIndex: number;
  isAudioPlaying: boolean;
}

// =============================================================================
// Public Player
// =============================================================================

export interface PublicPlayer {
  uid: string;
  seatNumber: number;
  displayName?: string;
  avatarUrl?: string;
  /** Only sent to the player themselves, or wolves can see wolves */
  role?: RoleId | null;
  hasViewedRole: boolean;
}
