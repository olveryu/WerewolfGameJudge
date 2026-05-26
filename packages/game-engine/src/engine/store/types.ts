/**
 * Store Types - state store type definitions
 *
 * GameState is defined in protocol/types.ts (single source of truth).
 * The store is the parse boundary: input accepts GameState, output returns GameState.
 */

// Re-export from protocol (canonical definition)
export type { GameState } from '../../protocol/types';
import type { GameState } from '../../protocol/types';

/**
 * State subscriber callback (Store layer)
 * state may be null (after reset); when non-null it is the normalized GameState
 */
export type StoreStateListener = (state: GameState | null, revision: number) => void;

/**
 * State store interface
 */
interface IGameStore {
  /** Get the current state (normalized GameState) */
  getState(): GameState | null;

  /** Get the current revision */
  getRevision(): number;

  /** Subscribe to state changes */
  subscribe(listener: StoreStateListener): () => void;

  /** Apply snapshot (player side) — receives wire payload, normalizes internally */
  applySnapshot(state: GameState, revision: number, lastAction?: string): void;

  /** Consume the lastAction carried by the most recent broadcast (one-shot read, cleared after reading) */
  consumeLastAction(): string | null;
}

/**
 * Writable store interface (includes setState/updateState/initialize/reset/destroy)
 */
export interface IWritableGameStore extends IGameStore {
  /** Set state (host only) — receives raw state, normalizes internally */
  setState(state: GameState): void;

  /** Incrementally update state (host only) — updater reads GameState and returns GameState */
  updateState(updater: (state: GameState) => GameState): void;

  /** Initialize state — receives raw state, normalizes internally */
  initialize(state: GameState): void;

  /** Reset the store (clears state only, retains listeners) */
  reset(): void;

  /** Fully destroy the store (including listeners, for tests only) */
  destroy(): void;
}
