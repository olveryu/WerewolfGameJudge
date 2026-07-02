/**
 * SnapshotStore — generic normalized room snapshot holder.
 *
 * Owns revision checks, one-shot lastAction, listener lifecycle, reset, and destroy.
 * Game-specific stores provide normalization and expose only the mutation surface they need.
 */

export type SnapshotStoreListener<TState> = (state: TState | null, revision: number) => void;

interface SnapshotStoreLogger {
  error(message: string, meta?: unknown): void;
}

interface SnapshotStoreOptions<TState> {
  normalize: (state: TState) => TState;
  logger: SnapshotStoreLogger;
  label: string;
}

export class SnapshotStore<TState> {
  #state: TState | null = null;
  #revision = 0;
  readonly #listeners = new Set<SnapshotStoreListener<TState>>();
  #lastAction: string | null = null;

  constructor(private readonly options: SnapshotStoreOptions<TState>) {}

  getState(): TState | null {
    return this.#state;
  }

  getRevision(): number {
    return this.#revision;
  }

  subscribe(listener: SnapshotStoreListener<TState>): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  getListenerCount(): number {
    return this.#listeners.size;
  }

  applySnapshot(state: TState, revision: number, lastAction?: string): void {
    if (revision <= this.#revision) return;

    this.#state = this.options.normalize(state);
    this.#revision = revision;
    this.#lastAction = lastAction ?? null;

    this.#notifyListeners();
  }

  setState(state: TState): void {
    this.#state = this.options.normalize(state);
    this.#revision += 1;
    this.#notifyListeners();
  }

  updateState(updater: (state: TState) => TState): void {
    if (!this.#state) {
      throw new Error(`${this.options.label}: cannot update state before initialization`);
    }

    this.setState(updater(this.#state));
  }

  initialize(state: TState): void {
    this.#state = this.options.normalize(state);
    this.#revision = 1;
    this.#lastAction = null;
    this.#notifyListeners();
  }

  reset(): void {
    this.#state = null;
    this.#revision = 0;
    this.#lastAction = null;
    this.#notifyListeners();
  }

  destroy(): void {
    this.#state = null;
    this.#revision = 0;
    this.#lastAction = null;
    this.#listeners.clear();
  }

  consumeLastAction(): string | null {
    const action = this.#lastAction;
    this.#lastAction = null;
    return action;
  }

  #notifyListeners(): void {
    for (const listener of this.#listeners) {
      try {
        listener(this.#state, this.#revision);
      } catch (error) {
        this.options.logger.error(`${this.options.label}: listener error`, { error });
      }
    }
  }
}
