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

import type { RoleId } from '../../../models/roles';
import type { SchemaId } from '../../../models/roles/spec';

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
  /** Wolf vote progress (seat → hasVoted), does NOT reveal targets */
  wolfVoteStatus?: Record<number, boolean>;
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

// =============================================================================
// Wire Protocol Types (from legacy BroadcastService)
// =============================================================================

/** Connection status type */
export type ConnectionStatus = 'connecting' | 'syncing' | 'live' | 'disconnected';

/** Status change listener */
export type ConnectionStatusListener = (status: ConnectionStatus) => void;

/** Player data in broadcast messages */
export interface BroadcastPlayer {
  uid: string;
  seatNumber: number;
  displayName?: string;
  avatarUrl?: string;
  role?: RoleId | null;
  hasViewedRole: boolean;
}

/** Game state in broadcast messages */
export interface BroadcastGameState {
  roomCode: string;
  hostUid: string;
  status: 'unseated' | 'seated' | 'assigned' | 'ready' | 'ongoing' | 'ended';
  templateRoles: RoleId[];
  players: Record<number, BroadcastPlayer | null>;
  currentActionerIndex: number;
  isAudioPlaying: boolean;
  wolfVoteStatus?: Record<number, boolean>;
  nightmareBlockedSeat?: number;
  wolfKillDisabled?: boolean;
  witchContext?: {
    killedIndex: number;
    canSave: boolean;
    canPoison: boolean;
  };
  seerReveal?: {
    targetSeat: number;
    result: '好人' | '狼人';
  };
  psychicReveal?: {
    targetSeat: number;
    result: string;
  };
  gargoyleReveal?: {
    targetSeat: number;
    result: string;
  };
  wolfRobotReveal?: {
    targetSeat: number;
    result: string;
  };
  confirmStatus?: {
    role: 'hunter' | 'darkWolfKing';
    canShoot: boolean;
  };
  actionRejected?: {
    action: string;
    reason: string;
    targetUid: string;
  };
}

/** Messages broadcast by Host to all players */
export type HostBroadcast =
  | { type: 'STATE_UPDATE'; state: BroadcastGameState; revision: number }
  | {
      type: 'ROLE_TURN';
      role: RoleId;
      pendingSeats: number[];
      killedIndex?: number;
      stepId?: SchemaId;
    }
  | { type: 'NIGHT_END'; deaths: number[] }
  | { type: 'PLAYER_JOINED'; seat: number; player: BroadcastPlayer }
  | { type: 'PLAYER_LEFT'; seat: number }
  | { type: 'GAME_RESTARTED' }
  | { type: 'SEAT_REJECTED'; seat: number; requestUid: string; reason: 'seat_taken' }
  | {
      type: 'SEAT_ACTION_ACK';
      requestId: string;
      toUid: string;
      success: boolean;
      seat: number;
      reason?: string;
    }
  | {
      type: 'SNAPSHOT_RESPONSE';
      requestId: string;
      toUid: string;
      state: BroadcastGameState;
      revision: number;
    };

/** Messages sent by players to Host */
export type PlayerMessage =
  | { type: 'REQUEST_STATE'; uid: string }
  | { type: 'JOIN'; seat: number; uid: string; displayName: string; avatarUrl?: string }
  | { type: 'LEAVE'; seat: number; uid: string }
  | { type: 'ACTION'; seat: number; role: RoleId; target: number | null; extra?: unknown }
  | { type: 'WOLF_VOTE'; seat: number; target: number }
  | { type: 'VIEWED_ROLE'; seat: number }
  | { type: 'REVEAL_ACK'; seat: number; role: RoleId; revision: number }
  | {
      type: 'SEAT_ACTION_REQUEST';
      requestId: string;
      action: 'sit' | 'standup';
      seat: number;
      uid: string;
      displayName?: string;
      avatarUrl?: string;
    }
  | { type: 'SNAPSHOT_REQUEST'; requestId: string; uid: string; lastRevision?: number };
