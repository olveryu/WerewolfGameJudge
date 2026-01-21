/**
 * Core Services Index
 *
 * This module re-exports all core service implementations that are shared
 * between legacy GameStateService and v2 GameFacade.
 *
 * NOTE: Several modules have been moved to v2/:
 * - DeathCalculator → v2/domain/DeathCalculator
 * - Resolvers → v2/domain/resolvers/
 * - AuthService → v2/infra/Auth
 * - AvatarUploadService → v2/infra/AvatarUpload
 * - SimplifiedRoomService → v2/infra/Room
 * - GameStateTypes → v2/types/GameState
 * - PublicBroadcast → v2/types/Broadcast
 *
 * This index re-exports from v2 for backward compatibility.
 *
 * See /docs/architecture/SERVICE_REWRITE_PLAN.md for architecture details.
 */

// ============================================================================
// Core Services
// ============================================================================

export { default as AudioService } from './AudioService';
export { AuthService } from '../v2/infra/Auth';
export { AvatarUploadService } from '../v2/infra/AvatarUpload';

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

export { SimplifiedRoomService, type RoomRecord } from '../v2/infra/Room';

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
export * from '../v2/domain/resolvers';

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

export * from '../v2/domain/DeathCalculator';
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
} from '../v2/types/Broadcast';

// Connection status from BroadcastService (for external consumers)
export type { ConnectionStatus } from './BroadcastService';
