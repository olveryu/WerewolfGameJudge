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
import type { GameState, IWritableGameStore, StoreStateListener } from './types';

const gameStoreLog = getEngineLogger().extend('GameStore');

export class GameStore implements IWritableGameStore {
  #state: GameState | null = null;
  #revision: number = 0;
  readonly #listeners: Set<StoreStateListener> = new Set();

  /** Action type carried by the most recent broadcast (consumed once) */
  #lastAction: string | null = null;

  /**
   * Get current state
   */
  getState(): GameState | null {
    return this.#state;
  }

  /**
   * Get current revision
   */
  getRevision(): number {
    return this.#revision;
  }

  /**
   * Subscribe to state changes
   * @returns unsubscribe function
   */
  subscribe(listener: StoreStateListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /**
   * Apply snapshot (player side)
   * Only applies when incoming revision > local revision
   * Applies normalizeState to ensure Host/Player shape consistency (anti-drift)
   */
  applySnapshot(state: GameState, revision: number, lastAction?: string): void {
    if (revision <= this.#revision) {
      // Drop older revision
      return;
    }

    this.#state = normalizeState(state);
    this.#revision = revision;
    this.#lastAction = lastAction ?? null;

    this.#notifyListeners();
  }

  /**
   * Set state (host only)
   * Auto-increments revision and normalizes
   */
  setState(state: GameState): void {
    this.#state = normalizeState(state);
    this.#revision += 1;
    this.#notifyListeners();
  }

  /**
   * Incrementally update state (host only)
   * @param updater state updater function
   */
  updateState(updater: (state: GameState) => GameState): void {
    if (!this.#state) {
      throw new Error('Cannot update state: no state initialized');
    }

    const newState = updater(this.#state);
    this.setState(newState);
  }

  /**
   * Initialize state (when host creates the room)
   */
  initialize(state: GameState): void {
    this.#state = normalizeState(state);
    this.#revision = 1;
    this.#notifyListeners();
  }

  /**
   * Reset store (only clears state, keeps listeners)
   * Used for scenarios like leaveRoom
   */
  reset(): void {
    this.#state = null;
    this.#revision = 0;
    this.#lastAction = null;
    // Note: do not clear listeners — React useEffect listener lifecycle is independent of the store
    // Notify listeners that state has become null
    for (const listener of this.#listeners) {
      try {
        listener(null, 0);
      } catch (error) {
        gameStoreLog.error('Listener error in reset', { error });
      }
    }
  }

  /**
   * Fully destroy store (including listeners)
   * Only used for test isolation
   */
  destroy(): void {
    this.#state = null;
    this.#revision = 0;
    this.#lastAction = null;
    this.#listeners.clear();
  }

  /**
   * Consume the lastAction carried by the most recent broadcast (read once, clears after read)
   */
  consumeLastAction(): string | null {
    const action = this.#lastAction;
    this.#lastAction = null;
    return action;
  }

  /**
   * Get current listener count (only for testing/debugging)
   */
  getListenerCount(): number {
    return this.#listeners.size;
  }

  /**
   * Notify all subscribers
   */
  #notifyListeners(): void {
    if (!this.#state) return;

    for (const listener of this.#listeners) {
      try {
        listener(this.#state, this.#revision);
      } catch (error) {
        // Prevent a single listener error from affecting other subscribers
        gameStoreLog.error('Listener error', { error });
      }
    }
  }
}
