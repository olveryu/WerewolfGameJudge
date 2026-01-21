/**
 * Legacy Services Index
 *
 * This module re-exports all legacy service implementations.
 * These files are scheduled for replacement by the v2 architecture.
 *
 * @deprecated All exports from this module will be replaced.
 * See /docs/architecture/SERVICE_REWRITE_PLAN.md for migration plan.
 */

// ============================================================================
// Core Services
// ============================================================================

export { default as AudioService } from './AudioService';
export { AuthService } from './AuthService';
export { AvatarUploadService } from './AvatarUploadService';

// ============================================================================
// Broadcast Architecture (Host as Authority)
// ============================================================================

export {
  BroadcastService,
  type HostBroadcast,
  type PlayerMessage,
  type BroadcastGameState,
  type BroadcastPlayer,
} from './BroadcastService';

export {
  GameStateService,
  GameStatus,
  type LocalGameState,
  type LocalPlayer,
} from './GameStateService';

export { SimplifiedRoomService, type RoomRecord } from './SimplifiedRoomService';

// ============================================================================
// Sub-module Re-exports
// ============================================================================

// Action processing
export { ActionProcessor } from './action';

// Broadcast coordination
export { BroadcastCoordinator } from './broadcast';

// Host coordination
export { HostCoordinator } from './host';

// Night flow
export { NightFlowService } from './night';
export * from './night/resolvers';

// Persistence
export { StatePersistence } from './persistence';

// Player coordination
export { PlayerCoordinator } from './player';

// Seat management
export { SeatManager } from './seat';

// State management
export { StateManager } from './state';

// ============================================================================
// Utilities
// ============================================================================

export * from './DeathCalculator';
export { NightFlowController } from './NightFlowController';
export * from './WolfVoteResolver';

// ============================================================================
// Types
// ============================================================================

export type {
  PublicPayload,
  PublicStateUpdate,
  PublicRoleTurn,
  PublicNightEnd,
  PublicPlayerJoined,
  PublicPlayerLeft,
  PublicGameRestarted,
  PublicSeatActionAck,
  PublicSeatRejected,
  PublicSnapshotResponse,
  PublicGameState,
  PublicPlayer,
} from './types';

// Connection status from BroadcastService (for external consumers)
export type { ConnectionStatus } from './BroadcastService';
