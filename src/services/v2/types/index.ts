/**
 * V2 Types - Re-export types from legacy for Phase 2
 *
 * Phase 2: All types come from legacy
 * Phase 3: Will gradually migrate to new type definitions
 */

// Re-export all types from legacy
export type {
  LocalGameState,
  LocalPlayer,
  GameStateListener,
} from '../../core/types/GameStateTypes';

export { GameStatus } from '../../core/types/GameStateTypes';

// Broadcast types
export type {
  BroadcastGameState,
  BroadcastPlayer,
  HostBroadcast,
  PlayerMessage,
  ConnectionStatus,
} from '../../core';
