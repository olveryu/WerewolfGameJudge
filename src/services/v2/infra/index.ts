/**
 * Infrastructure Layer - External Adapters
 *
 * Phase 3: Infra layer complete
 * - StateStore: Pure state storage with immutable updates
 * - Transport: Supabase Realtime communication
 * - Storage: AsyncStorage persistence
 * - Audio: Audio playback service
 */

// StateStore - State management
export { StateStore } from './StateStore';
export type { StateStoreConfig, StateUpdater } from './StateStore';

// Re-export types from StateStore for convenience
export { GameStatus } from './StateStore';
export type { LocalGameState, LocalPlayer, GameStateListener, BroadcastGameState } from './StateStore';

// Transport - Supabase Realtime communication
export { Transport } from './Transport';
export type { ConnectionStatus, ConnectionStatusListener, TransportCallbacks } from './Transport';

// Storage - AsyncStorage persistence
export { Storage } from './Storage';
export type { StorageConfig } from './Storage';

// Audio - Audio playback service
export { Audio } from './Audio';
