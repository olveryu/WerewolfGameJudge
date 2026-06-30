/**
 * FibStore — fibking client state holder (player-side).
 *
 * Mirrors GameStore but for FibState: holds the normalized broadcast state, tracks revision,
 * and notifies subscribers. The server is the sole authority, so the client only ever
 * applySnapshot()s (never setState). applySnapshot normalizes via normalizeFibState (anti-drift)
 * and drops stale revisions.
 */

import { getEngineLogger } from '../../utils/logger';
import { normalizeFibState } from '../normalizeFibState';
import type { FibState } from '../types';

const fibStoreLog = getEngineLogger().extend('FibStore');

export type FibStoreListener = (state: FibState | null, revision: number) => void;

export class FibStore {
  #state: FibState | null = null;
  #revision = 0;
  readonly #listeners = new Set<FibStoreListener>();
  #lastAction: string | null = null;

  getState(): FibState | null {
    return this.#state;
  }

  getRevision(): number {
    return this.#revision;
  }

  subscribe(listener: FibStoreListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  getListenerCount(): number {
    return this.#listeners.size;
  }

  /** Apply a broadcast/fetched snapshot. Only applies when incoming revision > local. */
  applySnapshot(state: FibState, revision: number, lastAction?: string): void {
    if (revision <= this.#revision) return;
    this.#state = normalizeFibState(state);
    this.#revision = revision;
    this.#lastAction = lastAction ?? null;
    this.#notify();
  }

  /** One-shot read of the lastAction carried by the most recent snapshot. */
  consumeLastAction(): string | null {
    const action = this.#lastAction;
    this.#lastAction = null;
    return action;
  }

  /** Clear state (e.g. on leave / room switch); retains listeners. */
  reset(): void {
    this.#state = null;
    this.#revision = 0;
    this.#lastAction = null;
    this.#notify();
  }

  #notify(): void {
    for (const listener of this.#listeners) {
      try {
        listener(this.#state, this.#revision);
      } catch (err) {
        fibStoreLog.error('listener error', err);
      }
    }
  }
}
