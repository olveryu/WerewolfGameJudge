/**
 * Infrastructure Layer - External Adapters
 *
 * Phase 3: StateStore complete
 */

// StateStore - State management
export { StateStore } from './StateStore';
export type { StateStoreConfig, StateUpdater } from './StateStore';

// Re-export types from StateStore for convenience
export { GameStatus } from './StateStore';
export type { LocalGameState, LocalPlayer, GameStateListener, BroadcastGameState } from './StateStore';

// Placeholder exports for remaining Phase 3 modules
// export { Transport } from './Transport';
// export { Storage } from './Storage';
// export { Audio } from './Audio';
