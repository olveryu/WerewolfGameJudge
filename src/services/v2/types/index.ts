/**
 * V2 Types - Unified type exports
 *
 * Phase 6: Types now live directly in v2/types/
 */

// Game state types (from GameState.ts)
export type { LocalGameState, LocalPlayer, GameStateListener } from './GameState';
export { GameStatus } from './GameState';

// Broadcast types (from Broadcast.ts)
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
} from './Broadcast';

// Re-export common types that consumers need from core (temporary, until full migration)
export type {
  BroadcastGameState,
  BroadcastPlayer,
  HostBroadcast,
  PlayerMessage,
  ConnectionStatus,
} from '../../core';
