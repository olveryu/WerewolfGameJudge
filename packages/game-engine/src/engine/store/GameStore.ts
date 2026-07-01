/**
 * GameStore — game state holder.
 *
 * Responsibilities:
 * - Holds normalized GameState
 * - Manages revision number
 * - Subscribe/notify mechanism
 * - Player side: applySnapshot (revision check)
 * - Host side: setState / updateState
 *
 * Not responsible for:
 * - Business logic (validation/settlement/progression)
 * - IO (network/audio/Alert)
 *
 * Boundary constraints:
 * - Store is the parse boundary: input accepts GameState, internally stored after normalizeState()
 * - applySnapshot only applies when incoming revision > local revision
 */

import { getEngineLogger } from '../../utils/logger';
import { normalizeState } from '../state/normalize';
import { SnapshotStore } from './SnapshotStore';
import type { GameState, IWritableGameStore, StoreStateListener } from './types';

const gameStoreLog = getEngineLogger().extend('GameStore');

export class GameStore implements IWritableGameStore {
  readonly #store = new SnapshotStore<GameState>({
    normalize: normalizeState,
    logger: gameStoreLog,
    label: 'GameStore',
  });

  /**
   * Get current state
   */
  getState(): GameState | null {
    return this.#store.getState();
  }

  /**
   * Get current revision
   */
  getRevision(): number {
    return this.#store.getRevision();
  }

  /**
   * Subscribe to state changes
   * @returns unsubscribe function
   */
  subscribe(listener: StoreStateListener): () => void {
    return this.#store.subscribe(listener);
  }

  /**
   * Apply snapshot (player side)
   * Only applies when incoming revision > local revision
   * Applies normalizeState to ensure Host/Player shape consistency (anti-drift)
   */
  applySnapshot(state: GameState, revision: number, lastAction?: string): void {
    this.#store.applySnapshot(state, revision, lastAction);
  }

  /**
   * Set state (host only)
   * Auto-increments revision and normalizes
   */
  setState(state: GameState): void {
    this.#store.setState(state);
  }

  /**
   * Incrementally update state (host only)
   * @param updater state updater function
   */
  updateState(updater: (state: GameState) => GameState): void {
    if (!this.#store.getState()) {
      throw new Error('Cannot update state: no state initialized');
    }
    this.#store.updateState(updater);
  }

  /**
   * Initialize state (when host creates the room)
   */
  initialize(state: GameState): void {
    this.#store.initialize(state);
  }

  /**
   * Reset store (only clears state, keeps listeners)
   * Used for scenarios like leaveRoom
   */
  reset(): void {
    this.#store.reset();
  }

  /**
   * Fully destroy store (including listeners)
   * Only used for test isolation
   */
  destroy(): void {
    this.#store.destroy();
  }

  /**
   * Consume the lastAction carried by the most recent broadcast (read once, clears after read)
   */
  consumeLastAction(): string | null {
    return this.#store.consumeLastAction();
  }

  /**
   * Get current listener count (only for testing/debugging)
   */
  getListenerCount(): number {
    return this.#store.getListenerCount();
  }
}
