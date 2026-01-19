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

import { RoleId } from '../../models/roles';
import { GameTemplate } from '../../models/Template';

// =============================================================================
// Game Status Enum
// =============================================================================

export enum GameStatus {
  unseated = 'unseated', // Waiting for players to join
  seated = 'seated', // All seats filled, waiting for host to assign roles
  assigned = 'assigned', // Roles assigned, players viewing their cards
  ready = 'ready', // All players have viewed cards, ready to start
  ongoing = 'ongoing', // Night phase in progress
  ended = 'ended', // Game ended (first night complete)
}

// =============================================================================
// Player Types
// =============================================================================

export interface LocalPlayer {
  uid: string;
  seatNumber: number;
  displayName?: string;
  avatarUrl?: string;
  role: RoleId | null;
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
  players: Map<number, LocalPlayer | null>; // seat -> player
  actions: Map<RoleId, RoleAction>; // role -> structured action
  wolfVotes: Map<number, number>; // wolf seat -> target
  currentActionerIndex: number;
  /**
   * UI-only: authoritative current stepId broadcast from Host via ROLE_TURN.
   * This is used for schema-driven UI mapping (e.g. NIGHT_STEPS.audioKey display).
   * It must not be used to drive game logic.
   */
  currentStepId?: import('../../models/roles/spec').SchemaId;
  isAudioPlaying: boolean;
  lastNightDeaths: number[]; // Calculated after night ends
  nightmareBlockedSeat?: number; // Seat blocked by nightmare (skill disabled for this night)
  /**
   * Wolf kill disabled: true if nightmare blocked a wolf.
   * When true, all wolves can only skip during wolf vote phase (no kill this night).
   */
  wolfKillDisabled?: boolean;
}

// =============================================================================
// Listener Types
// =============================================================================

export type GameStateListener = (state: LocalGameState) => void;
