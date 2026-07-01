/**
 * FibStore — fibking client state holder (player-side).
 *
 * Mirrors GameStore but for FibState: holds the normalized broadcast state, tracks revision,
 * and notifies subscribers. The server is the sole authority, so the client only ever
 * applySnapshot()s (never setState). applySnapshot normalizes via normalizeFibState (anti-drift)
 * and drops stale revisions.
 */

import { SnapshotStore } from '../../engine/store/SnapshotStore';
import { getEngineLogger } from '../../utils/logger';
import { normalizeFibState } from '../normalizeFibState';
import type { FibState } from '../types';

const fibStoreLog = getEngineLogger().extend('FibStore');

export type FibStoreListener = (state: FibState | null, revision: number) => void;

export class FibStore {
  readonly #store = new SnapshotStore<FibState>({
    normalize: normalizeFibState,
    logger: fibStoreLog,
    label: 'FibStore',
  });

  getState(): FibState | null {
    return this.#store.getState();
  }

  getRevision(): number {
    return this.#store.getRevision();
  }

  subscribe(listener: FibStoreListener): () => void {
    return this.#store.subscribe(listener);
  }

  getListenerCount(): number {
    return this.#store.getListenerCount();
  }

  /** Apply a broadcast/fetched snapshot. Only applies when incoming revision > local. */
  applySnapshot(state: FibState, revision: number, lastAction?: string): void {
    this.#store.applySnapshot(state, revision, lastAction);
  }

  /** One-shot read of the lastAction carried by the most recent snapshot. */
  consumeLastAction(): string | null {
    return this.#store.consumeLastAction();
  }

  /** Clear state (e.g. on leave / room switch); retains listeners. */
  reset(): void {
    this.#store.reset();
  }
}
