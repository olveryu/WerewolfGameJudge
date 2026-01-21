/**
 * Services Index
 *
 * Re-exports all services from legacy module.
 * This will be replaced by v2 architecture after Phase 2.
 *
 * @see /docs/architecture/SERVICE_REWRITE_PLAN.md
 */

// All services are now in legacy folder
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
} from './legacy';
