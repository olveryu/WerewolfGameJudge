/**
 * Services Index
 *
 * Phase 8: Migrating exports from core/ to v2/
 *
 * Migration status:
 *   - v2/: GameFacade, AuthService, AvatarUploadService, SimplifiedRoomService
 *   - core/: Legacy GameStateService, BroadcastService, AudioService (to be removed)
 *
 * @see /docs/architecture/SERVICE_REWRITE_PLAN.md
 */

// ============================================================
// V2 Exports (primary)
// ============================================================
export { GameFacade } from './v2';

// Auth and Avatar services (from v2)
export { AuthService, AvatarUploadService, SimplifiedRoomService } from './v2/infra';
export type { RoomRecord } from './v2/infra';

// Types (from v2)
export type {
  HostBroadcast,
  PlayerMessage,
  BroadcastGameState,
  BroadcastPlayer,
  ConnectionStatus,
} from './v2/types/Broadcast';

export type { LocalGameState, LocalPlayer } from './v2/types/GameState';
export { GameStatus } from './v2/types/GameState';

// ============================================================
// Legacy Exports (deprecated - from core/)
// ============================================================
export { default as AudioService } from './core/AudioService';
export { BroadcastService } from './core/BroadcastService';
export { GameStateService } from './core/GameStateService';
