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
import type { CurrentNightResults } from '../night/resolvers/types';
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
  /**
   * Night-1 complete (results ready).
   *
   * IMPORTANT: This app does not decide winners. "ended" only means the app's
   * Night-1 flow is complete and players can view the summary/deaths.
   */
  ended = 'ended',
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

  /**
   * Current night's accumulated resolver results.
   * Used to pass resolved results between steps (e.g., nightmare block → wolf kill disabled).
   * Reset at the start of each night.
   */
  currentNightResults: CurrentNightResults;

  // =========================================================================
  // Role-specific context (previously sent via PRIVATE_EFFECT, now public)
  // UI filters what to display based on myRole.
  // =========================================================================

  /** Witch turn context - only display to witch via UI filter */
  witchContext?: {
    killedIndex: number; // seat killed by wolves (-1 = empty kill)
    canSave: boolean;
    canPoison: boolean;
  };

  /** Seer reveal result - only display to seer via UI filter */
  seerReveal?: {
    targetSeat: number;
    result: '好人' | '狼人';
  };

  /** Psychic reveal result - only display to psychic via UI filter */
  psychicReveal?: {
    targetSeat: number;
    result: string; // specific role name
  };

  /** Gargoyle reveal result - only display to gargoyle via UI filter */
  gargoyleReveal?: {
    targetSeat: number;
    result: string;
  };

  /** Wolf Robot reveal result - only display to wolf robot via UI filter */
  wolfRobotReveal?: {
    targetSeat: number;
    result: string;
  };

  /** Confirm status for hunter/darkWolfKing - only display to that role via UI filter */
  confirmStatus?: {
    role: 'hunter' | 'darkWolfKing';
    canShoot: boolean;
  };

  /** Action rejected feedback - only display to the rejected player via UI filter */
  actionRejected?: {
    action: string;
    reason: string;
    targetUid: string; // which player was rejected
  /** Unique id for this rejection event (UI uses it for dedupe). */
  rejectionId: string;
  };
}

// =============================================================================
// Listener Types
// =============================================================================

export type GameStateListener = (state: LocalGameState) => void;
