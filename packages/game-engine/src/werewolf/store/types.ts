/**
 * Werewolf store type definitions.
 *
 * WerewolfState is defined in protocol/types.ts (single source of truth).
 * The store is the parse boundary: input accepts WerewolfState, output returns WerewolfState.
 */

// Re-export from protocol (canonical definition)
export type { WerewolfState } from '../protocol/types';
import type { WerewolfState } from '../protocol/types';

/**
 * State subscriber callback (Store layer)
 * state may be null (after reset); when non-null it is the normalized WerewolfState
 */
export type StoreStateListener = (state: WerewolfState | null, revision: number) => void;

/**
 * State store interface
 */
interface IWerewolfStore {
  /** Get the current state (normalized WerewolfState) */
  getState(): WerewolfState | null;

  /** Get the current revision */
  getRevision(): number;

  /** Subscribe to state changes */
  subscribe(listener: StoreStateListener): () => void;

  /** Apply snapshot (player side) — receives wire payload, normalizes internally */
  applySnapshot(state: WerewolfState, revision: number, lastAction?: string): void;

  /** Consume the lastAction carried by the most recent broadcast (one-shot read, cleared after reading) */
  consumeLastAction(): string | null;
}

/**
 * Writable store interface (includes setState/updateState/initialize/reset/destroy)
 */
export interface IWritableWerewolfStore extends IWerewolfStore {
  /** Set state (host only) — receives raw state, normalizes internally */
  setState(state: WerewolfState): void;

  /** Incrementally update state (host only) — updater reads WerewolfState and returns WerewolfState */
  updateState(updater: (state: WerewolfState) => WerewolfState): void;

  /** Initialize state — receives raw state, normalizes internally */
  initialize(state: WerewolfState): void;

  /** Reset the store (clears state only, retains listeners) */
  reset(): void;

  /** Fully destroy the store (including listeners, for tests only) */
  destroy(): void;
}
