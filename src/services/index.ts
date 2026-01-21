/**
 * Services Index
 *
 * Phase 2: Exports from both legacy (current) and v2 (facade skeleton)
 *
 * Migration path:
 *   - Phase 2: GameFacade delegates to legacy GameStateService
 *   - Phase 3: Migrate business logic from legacy to v2/domain
 *   - Phase 4: Remove legacy, GameFacade becomes the main export
 *
 * @see /docs/architecture/SERVICE_REWRITE_PLAN.md
 */

// ============================================================
// Legacy Exports (current implementation)
// ============================================================
export {
  // Core Services
  AudioService,
  AuthService,
  AvatarUploadService,

  // Broadcast Architecture
  BroadcastService,
  type HostBroadcast,
  type PlayerMessage,
  type BroadcastGameState,
  type BroadcastPlayer,
  type ConnectionStatus,

  // Game State
  GameStateService,
  GameStatus,
  type LocalGameState,
  type LocalPlayer,

  // Room Service
  SimplifiedRoomService,
  type RoomRecord,
} from './core';

// ============================================================
// V2 Exports (facade skeleton - Phase 2)
// ============================================================
export { GameFacade } from './v2';
