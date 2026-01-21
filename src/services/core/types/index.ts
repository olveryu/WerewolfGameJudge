/**
 * Types index - Re-exports from v2/types for backward compatibility
 *
 * NOTE: Types have been moved to v2/types/
 * This file re-exports for backward compatibility.
 */

// Public broadcast types (whitelist) - now in v2/types/Broadcast
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
} from '../../v2/types/Broadcast';

// Game state types - now in v2/types/GameState
export { GameStatus } from '../../v2/types/GameState';
export type { LocalGameState, LocalPlayer, GameStateListener } from '../../v2/types/GameState';
