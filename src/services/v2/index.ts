/**
 * V2 Services - New Architecture
 *
 * Phase 2: GameFacade delegates to legacy
 * Phase 3: Gradually replace with new engines
 *
 * @see /docs/architecture/SERVICE_REWRITE_PLAN.md
 */

// Facade Layer (public API)
export {
  GameFacade,
  type LocalGameState,
  type LocalPlayer,
  type GameStateListener,
  GameStatus,
} from './facade';

// Types
export type {
  BroadcastGameState,
  BroadcastPlayer,
  HostBroadcast,
  PlayerMessage,
  ConnectionStatus,
} from './types';
