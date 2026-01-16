/**
 * GameStateTypes - Pure type definitions extracted from GameStateService
 * 
 * This file contains only:
 * - Enums
 * - Interfaces
 * - Type aliases
 * - Pure mapping functions (no side effects)
 * 
 * No runtime logic or service dependencies.
 */

import { RoleName } from '../../models/roles';
import { GameTemplate } from '../../models/Template';

// =============================================================================
// Game Status Enum
// =============================================================================

export enum GameStatus {
  unseated = 'unseated',    // Waiting for players to join
  seated = 'seated',        // All seats filled, waiting for host to assign roles
  assigned = 'assigned',    // Roles assigned, players viewing their cards
  ready = 'ready',          // All players have viewed cards, ready to start
  ongoing = 'ongoing',      // Night phase in progress
  ended = 'ended',          // Game ended (first night complete)
}

// =============================================================================
// Status Mapping (Pure function, no side effects)
// =============================================================================

/**
 * Convert GameStatus to RoomStatus number (for backward compatibility)
 * 
 * Note: This maps to legacy numeric room status values.
 * Future consideration: reverse dependency direction if RoomStatus becomes authoritative.
 */
export const gameStatusToRoomStatus = (status: GameStatus): number => {
  switch (status) {
    case GameStatus.unseated: return 0;
    case GameStatus.seated: return 1;
    case GameStatus.assigned: return 2;
    case GameStatus.ready: return 3;
    case GameStatus.ongoing: return 4;
    case GameStatus.ended: return 5;  // Night finished, daytime
    default: return 0;
  }
};

// =============================================================================
// Player Types
// =============================================================================

export interface LocalPlayer {
  uid: string;
  seatNumber: number;
  displayName?: string;
  avatarUrl?: string;
  role: RoleName | null;
  hasViewedRole: boolean;
}

// =============================================================================
// Game State Types
// =============================================================================

import { RoleAction } from '../../models/actions/RoleAction';

export interface LocalGameState {
  roomCode: string;
  hostUid: string;
  status: GameStatus;
  template: GameTemplate;
  players: Map<number, LocalPlayer | null>;  // seat -> player
  actions: Map<RoleName, RoleAction>;  // role -> structured action
  wolfVotes: Map<number, number>;  // wolf seat -> target
  currentActionerIndex: number;
  /**
   * UI-only: authoritative current stepId broadcast from Host via ROLE_TURN.
   * This is used for schema-driven UI mapping (e.g. NIGHT_STEPS.audioKey display).
   * It must not be used to drive game logic.
   */
  currentStepId?: import('../../models/roles/spec').SchemaId;
  isAudioPlaying: boolean;
  lastNightDeaths: number[];  // Calculated after night ends
  nightmareBlockedSeat?: number;  // Seat blocked by nightmare (skill disabled for this night)
}

// =============================================================================
// Listener Types
// =============================================================================

export type GameStateListener = (state: LocalGameState) => void;
