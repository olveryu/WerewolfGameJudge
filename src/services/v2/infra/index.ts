/**
 * Infrastructure Layer - External Adapters
 *
 * Phase 6: Infra layer complete with all services
 * - StateStore: Pure state storage with immutable updates
 * - Transport: Supabase Realtime communication
 * - Storage: AsyncStorage persistence
 * - Audio: Audio playback service
 * - Auth: Supabase authentication service
 * - Room: Room lifecycle management
 */

// StateStore - State management
export { StateStore } from './StateStore';
export type { StateStoreConfig, StateUpdater } from './StateStore';

// Re-export types from StateStore for convenience
export { GameStatus } from './StateStore';
export type {
  LocalGameState,
  LocalPlayer,
  GameStateListener,
  BroadcastGameState,
} from './StateStore';

// Transport - Supabase Realtime communication
export { Transport } from './Transport';
export type { ConnectionStatus, ConnectionStatusListener, TransportCallbacks } from './Transport';

// Storage - AsyncStorage persistence
export { Storage } from './Storage';
export type { StorageConfig } from './Storage';

// Audio - Audio playback service
export { Audio } from './Audio';

// Auth - Supabase authentication service
export { AuthService } from './Auth';

// Room - Room lifecycle management
export { SimplifiedRoomService, type RoomRecord } from './Room';
