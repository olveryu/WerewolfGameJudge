/**
 * WerewolfStore — werewolf state holder.
 *
 * Responsibilities:
 * - Holds normalized WerewolfState
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
 * - Store is the parse boundary: input accepts WerewolfState, internally stored after normalizeWerewolfState()
 * - applySnapshot only applies when incoming revision > local revision
 */

import { SnapshotStore } from '../../engine/store/SnapshotStore';
import { getEngineLogger } from '../../utils/logger';
import { normalizeWerewolfState } from '../state/normalizeWerewolfState';
import type { IWritableWerewolfStore, StoreStateListener, WerewolfState } from './types';

const werewolfStoreLog = getEngineLogger().extend('WerewolfStore');

export class WerewolfStore implements IWritableWerewolfStore {
  readonly #store = new SnapshotStore<WerewolfState>({
    normalize: normalizeWerewolfState,
    logger: werewolfStoreLog,
    label: 'WerewolfStore',
  });

  /**
   * Get current state
   */
  getState(): WerewolfState | null {
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
   * Applies normalizeWerewolfState to ensure Host/Player shape consistency (anti-drift)
   */
  applySnapshot(state: WerewolfState, revision: number, lastAction?: string): void {
    this.#store.applySnapshot(state, revision, lastAction);
  }

  /**
   * Set state (host only)
   * Auto-increments revision and normalizes
   */
  setState(state: WerewolfState): void {
    this.#store.setState(state);
  }

  /**
   * Incrementally update state (host only)
   * @param updater state updater function
   */
  updateState(updater: (state: WerewolfState) => WerewolfState): void {
    if (!this.#store.getState()) {
      throw new Error('Cannot update state: no state initialized');
    }
    this.#store.updateState(updater);
  }

  /**
   * Initialize state (when host creates the room)
   */
  initialize(state: WerewolfState): void {
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
