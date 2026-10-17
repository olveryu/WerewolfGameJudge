/**
 * RoomAudioOrchestrator — framework-agnostic host audio lifecycle core.
 *
 * Moved from the Werewolf `WerewolfAudioOrchestrator` lifecycle: this class
 * is the single implementation of the client audio reliability protocol for
 * every game with narration audio. Games keep only a player adapter (what
 * sound an effect makes) and an ack adapter (how their ack command is
 * prepared/dispatched); all lifecycle decisions live here.
 *
 * Responsibilities:
 * - Reactively watch the queue source -> play pending effects in order -> ack
 * - Prepared envelope ack lifecycle: one prepared ack command is retained
 *   until a terminal decision is observed (server dedupes by commandId)
 * - Three-layer connection recovery for a retained ack: connection-status
 *   listener (L2), browser 'online' event + immediate check (L3a), and a
 *   5s poll fallback with exponential backoff up to a retry cap
 * - After a successful ack, re-check the queue source and chain-play any
 *   new queue the ack's progression produced
 * - Rejoin bookkeeping: `wasAudioInterrupted` marks that playback was
 *   interrupted; the game-side resume flow replays and acks through
 *   `dispatchAudioAck`
 *
 * Boundary constraints:
 * - Only active for the host (plays/retries only when isHost() === true)
 * - Not reusable after dispose(), must create a new instance
 *
 * @remarks #isPlayingEffects re-entry guard: only one effect queue plays at
 *   a time. MAX iterations=20 prevents infinite loops. Queue identity is the
 *   queue observed in the source snapshot: an un-acked queue that is still
 *   present on reconnect is replayed in full before the retained ack is
 *   resent, so interrupted playback is never acked away unheard.
 */

import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { RoomConnectionStatus } from '@/features/room/model/RoomConnection';
import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
} from '@/features/room/session/roomCommandResult';
import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';

/** The queue view of room state the lifecycle reads from a snapshot. */
export interface RoomAudioQueueSnapshot<TEffect> {
  readonly pendingAudioEffects: readonly TEffect[] | undefined;
  readonly connection: RoomConnectionStatus;
}

/** Connection + queue source port (adapts a game's room session). */
export interface RoomAudioQueueSource<TEffect> {
  getSnapshot(): RoomAudioQueueSnapshot<TEffect> | null;
  subscribe(listener: (snapshot: RoomAudioQueueSnapshot<TEffect> | null) => void): () => void;
}

/**
 * Player port: game-owned playback. `playEffect` resolves when the clip
 * finished (or was skipped by the platform player). A missing-asset error
 * (asset registry gap = programming error) must be reported through
 * `isMissingAssetError` so the core can fail fast instead of skipping it.
 */
export interface RoomAudioPlayerPort<TEffect> {
  playEffect(effect: TEffect): Promise<void>;
  /** Optional batch preparation (asset preload) before sequential playback. */
  prepareQueue?(effects: readonly TEffect[]): Promise<void>;
  /** Whether an error is a missing-asset failure (fail-fast, never skipped). */
  isMissingAssetError?(error: unknown): boolean;
}

/** Ack port: prepares and dispatches the game's audio ack command. */
export interface RoomAudioAckPort<TPrepared, TState extends BaseGameState<string>> {
  prepare(): TPrepared;
  dispatch(prepared: TPrepared): Promise<RoomCommandDispatchOutcome<TState>>;
}

/** Clock port: timer primitives (defaults to the platform globals). */
export interface RoomAudioClock {
  setTimeout(handler: () => void, ms: number): ReturnType<typeof setTimeout>;
  setInterval(handler: () => void, ms: number): ReturnType<typeof setInterval>;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
  clearInterval(handle: ReturnType<typeof setInterval>): void;
}

/** Logger port: the game's named runtime logger. */
export interface RoomAudioLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

/** RoomAudioOrchestrator injectable dependencies. */
export interface RoomAudioOrchestratorDeps<
  TEffect,
  TPrepared,
  TState extends BaseGameState<string>,
> {
  /** Queue + connection snapshot source. */
  queueSource: RoomAudioQueueSource<TEffect>;
  /** Game-owned player adapter. */
  player: RoomAudioPlayerPort<TEffect>;
  /** Game-owned ack command adapter. */
  ack: RoomAudioAckPort<TPrepared, TState>;
  /** Whether currently host (lazy-evaluated). */
  isHost: () => boolean;
  /** Whether the owning session is aborted/torn down (lazy-evaluated). */
  isAborted: () => boolean;
  /** Game logger for lifecycle events. */
  logger: RoomAudioLogger;
  /** Error pipeline hook for playback/retry failures caught by the core. */
  onError?: (error: unknown, label: string) => void;
  /** Timer primitives; defaults to the platform globals. */
  clock?: RoomAudioClock;
}

const systemClock: RoomAudioClock = {
  setTimeout: (handler, ms) => setTimeout(handler, ms),
  setInterval: (handler, ms) => setInterval(handler, ms),
  clearTimeout: (handle) => clearTimeout(handle),
  clearInterval: (handle) => clearInterval(handle),
};

/**
 * RoomAudioOrchestrator — host narration lifecycle.
 *
 * Responsibilities: play the pending effect queue in order, ack it through
 * one prepared envelope, and recover the ack across reconnects. Does not
 * decide "when to play what", only executes.
 */
export class RoomAudioOrchestrator<
  TEffect extends { readonly audioKey: string },
  TPrepared extends { readonly commandId: string },
  TState extends BaseGameState<string>,
> {
  readonly #deps: RoomAudioOrchestratorDeps<TEffect, TPrepared, TState>;
  readonly #clock: RoomAudioClock;

  /**
   * Prevents #playPendingAudioEffects re-entry.
   * Same batch of pendingAudioEffects plays only once at a time.
   */
  #isPlayingEffects = false;

  /**
   * Marks whether audio was interrupted during host rejoin (cached
   * isAudioPlaying === true on the game side). Used by the game-side
   * resume flow to determine whether current audio needs replay.
   */
  #wasAudioInterrupted = false;

  /** Exact command retained until its receipt or a terminal rejection is observed. */
  #pendingAudioAck: TPrepared | null = null;

  /** Browser 'online' event handler: retry the ack on network restore (Web platform fallback when SDK doesn't fire Live event) */
  #onlineRetryHandler: (() => void) | null = null;

  /** Delayed retry timer for check+listen pattern (scheduled immediately when navigator.onLine is already true) */
  #onlineRetryTimer: ReturnType<typeof setTimeout> | null = null;

  /** Periodic poll fallback: check navigator.onLine every POLL_INTERVAL_MS and retry (guards against lost online events) */
  #onlineRetryPollTimer: ReturnType<typeof setInterval> | null = null;

  /** Consecutive retry count (exponential backoff + cap to prevent infinite polling) */
  #onlineRetryAttempt = 0;

  /** Unsubscribe handles for constructor subscriptions */
  #unsubscribeRoom: (() => void) | null = null;
  #lastConnectionStatus: RoomConnectionStatus = 'disconnected';

  /** Maximum retry count (stops retrying after exceeded, waits for user manual refresh) */
  static readonly #maxOnlineRetries = 5;

  /** Poll interval for periodic ack retry fallback (ms) */
  static readonly #pollIntervalMs = 5_000;

  constructor(deps: RoomAudioOrchestratorDeps<TEffect, TPrepared, TState>) {
    this.#deps = deps;
    this.#clock = deps.clock ?? systemClock;

    this.#unsubscribeRoom = deps.queueSource.subscribe((snapshot) => {
      const previousStatus = this.#lastConnectionStatus;
      this.#lastConnectionStatus = snapshot?.connection ?? 'disconnected';
      if (snapshot === null || !deps.isHost()) return;

      if (
        snapshot.pendingAudioEffects &&
        snapshot.pendingAudioEffects.length > 0 &&
        !this.#wasAudioInterrupted
      ) {
        void this.#playPendingAudioEffects(snapshot.pendingAudioEffects).catch((error: unknown) => {
          this.#deps.onError?.(error, '音频效果队列');
        });
      }

      if (
        previousStatus !== 'live' &&
        snapshot.connection === 'live' &&
        this.#pendingAudioAck !== null
      ) {
        this.#unregisterOnlineRetry();
        this.#onlineRetryAttempt = 0;
        deps.logger.info('SDK reconnected: retrying pending audio ack', { layer: 'L2' });
        this.#retryPendingAudioAck('reconnect');
      }
    });
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /** Whether audio was interrupted after host rejoin (cached isAudioPlaying === true) */
  get wasAudioInterrupted(): boolean {
    return this.#wasAudioInterrupted;
  }

  /** Set wasAudioInterrupted flag (used by the game runtime to pre-set/modify) */
  setWasAudioInterrupted(value: boolean): void {
    this.#wasAudioInterrupted = value;
  }

  /** Reset for new room (createRoom / joinRoom) */
  reset(): void {
    this.#isPlayingEffects = false;
    this.#wasAudioInterrupted = false;
    this.#pendingAudioAck = null;
    this.#onlineRetryAttempt = 0;
    this.#unregisterOnlineRetry();
  }

  /** Cleanup all handlers and timers when the session epoch ends. */
  dispose(): void {
    this.#unregisterOnlineRetry();
    this.#pendingAudioAck = null;
    this.#unsubscribeRoom?.();
    this.#unsubscribeRoom = null;
  }

  /**
   * Dispatch the retained prepared ack (preparing one on first use).
   * Used by the playback loop and by game-side resume flows that replay
   * audio themselves and then release the gate through the same envelope.
   */
  async dispatchAudioAck(source: string): Promise<RoomCommandDispatchOutcome<TState>> {
    const prepared = this.#getOrPrepareAudioAck();

    const outcome = await this.#deps.ack.dispatch(prepared);
    if (outcome.kind === 'notDecided' || outcome.kind === 'deliveryUnknown') {
      this.#deps.logger.warn('Audio ack has no terminal decision; retaining the prepared command', {
        source,
        commandId: prepared.commandId,
        delivery: outcome.kind,
        reason: outcome.reason,
      });
      this.#registerOnlineRetry();
      return outcome;
    }

    if (!isSuccessfulRoomCommand(outcome)) {
      this.#deps.logger.warn('Audio ack was terminally rejected', {
        source,
        commandId: prepared.commandId,
        reason: getRoomCommandFailureReason(outcome),
      });
    }
    if (this.#pendingAudioAck === prepared) {
      this.#clearPendingAudioAck();
    }
    return outcome;
  }

  // =========================================================================
  // Prepared audio ack bookkeeping
  // =========================================================================

  #getOrPrepareAudioAck(): TPrepared {
    if (this.#pendingAudioAck !== null) return this.#pendingAudioAck;

    const prepared = this.#deps.ack.prepare();
    this.#pendingAudioAck = prepared;
    return prepared;
  }

  #clearPendingAudioAck(): void {
    this.#pendingAudioAck = null;
    this.#onlineRetryAttempt = 0;
    this.#unregisterOnlineRetry();
  }

  // =========================================================================
  // Reactive Audio Effects (Host-only)
  // =========================================================================

  /**
   * Host reactively plays the pendingAudioEffects queue.
   *
   * Trigger: source subscription detects pendingAudioEffects non-empty.
   * After playback, dispatches the ack to release the audio gate.
   *
   * Re-entry guard: isPlayingEffects flag.
   * Interruption: aborted flag set by session lifecycle teardown.
   */
  async #playPendingAudioEffects(effects: readonly TEffect[]): Promise<void> {
    if (this.#isPlayingEffects) return;
    this.#isPlayingEffects = true;

    const { player } = this.#deps;

    try {
      let currentEffects: readonly TEffect[] | undefined = effects;

      // Loop: play effects → ack → re-check for new effects that arrived during playback.
      // Uses a loop instead of recursion to avoid unbounded stack/heap growth.
      // Max iterations caps at 2 × nightSteps (generous upper bound for chained queues).
      const maxIterations = 20;
      let iteration = 0;

      while (currentEffects && currentEffects.length > 0) {
        if (++iteration > maxIterations) {
          this.#deps.logger.warn('playPendingAudioEffects exceeded max iterations, breaking', {
            maxIterations,
          });
          break;
        }
        if (player.prepareQueue) {
          await player.prepareQueue(currentEffects);
        }
        for (const effect of currentEffects) {
          if (this.#deps.isAborted()) break;
          try {
            await player.playEffect(effect);
          } catch (e) {
            if (player.isMissingAssetError?.(e) === true) throw e;
            // Single audio failure doesn't block queue (consistent with resume flows)
            this.#deps.logger.warn('Audio effect playback failed, continuing', {
              audioKey: effect.audioKey,
              error: e,
            });
          }
        }

        // Ack releases the gate
        if (!this.#deps.isAborted()) {
          const ackResult = await this.dispatchAudioAck('playback');
          if (!isSuccessfulRoomCommand(ackResult)) {
            break; // ack failed, no re-check (wait for retry path to recover)
          }
        }

        // Re-check: the ack's progression may have produced new pendingAudioEffects,
        // but the source subscription emission was skipped since #isPlayingEffects
        // was still true. Re-check once only after ack success; break on ack failure.
        const postAckSnapshot = this.#deps.queueSource.getSnapshot();
        if (
          postAckSnapshot?.pendingAudioEffects &&
          postAckSnapshot.pendingAudioEffects.length > 0 &&
          this.#deps.isHost() &&
          !this.#wasAudioInterrupted
        ) {
          currentEffects = postAckSnapshot.pendingAudioEffects;
        } else {
          currentEffects = undefined;
        }
      }
    } finally {
      this.#isPlayingEffects = false;
    }
  }

  // =========================================================================
  // Shared: ack retry execution (used by L2 status listener + L3a online handler)
  // =========================================================================

  /**
   * Retry pending audio ack after reconnect: check pendingAudioEffects -> replay or direct ack.
   *
   * @param trigger - log identifier for trigger source
   */
  #retryPendingAudioAck(trigger: string): void {
    if (this.#pendingAudioAck === null) {
      throw new Error('[FAIL-FAST] Audio ack retry started without a prepared command');
    }
    const snapshot = this.#deps.queueSource.getSnapshot();
    const effects = snapshot?.pendingAudioEffects;
    let retry: Promise<unknown>;
    if (effects && effects.length > 0) {
      this.#deps.logger.info('Replaying audio effects after reconnect', {
        trigger,
        effectCount: effects.length,
      });
      // #playPendingAudioEffects will dispatch the ack after replay
      retry = this.#playPendingAudioEffects(effects);
    } else {
      this.#deps.logger.info('Retrying postAudioAck (no effects to replay)', { trigger });
      retry = this.dispatchAudioAck(trigger);
    }
    void retry.catch((error: unknown) => {
      this.#deps.onError?.(error, '音频确认重试');
    });
  }

  // =========================================================================
  // Audio-ack online retry (fallback for missed SDK reconnect events)
  // =========================================================================

  /**
   * Register audio-ack retry: check + listen + poll three-layer pattern.
   *
   * 1. If `navigator.onLine === true` -> delay 500ms then execute retry directly (avoid synchronous recursion)
   * 2. If offline -> attach `window.addEventListener('online', ...)` to wait for network restore
   * 3. Regardless of 1/2, additionally start POLL_INTERVAL_MS periodic poll fallback (guards against
   *    online events being lost in CI headless Chromium etc.)
   *
   * Solves timing race: online event may fire before registerOnlineRetry() is called,
   * in which case listener alone will never receive event -> use navigator.onLine check as fallback.
   * Periodic poll is the final safety net: even if check and listen both don't fire, poll retries after 5s.
   *
   * Native WebSocket truly disconnects -> status listener already covers that; this is only needed for Web platform.
   */
  #registerOnlineRetry(): void {
    this.#unregisterOnlineRetry();
    if (typeof globalThis.window?.addEventListener !== 'function') return;

    const doRetry = () => {
      if (this.#pendingAudioAck === null || !this.#deps.isHost() || this.#deps.isAborted()) return;

      // Exponential backoff cap: stop after max retry count to avoid infinite HTTP polling
      if (this.#onlineRetryAttempt >= RoomAudioOrchestrator.#maxOnlineRetries) {
        this.#deps.logger.warn(
          `Online ack retry exhausted (${RoomAudioOrchestrator.#maxOnlineRetries} attempts), giving up`,
        );
        this.#unregisterOnlineRetry();
        return;
      }
      this.#onlineRetryAttempt++;

      this.#deps.logger.info('Online event postAudioAck retry triggered', {
        layer: 'L3a',
        attempt: this.#onlineRetryAttempt,
      });
      this.#unregisterOnlineRetry();
      this.#retryPendingAudioAck('online event');
    };

    // Check: already online -> exponential backoff delay retry (avoid synchronous recursion + yield to event loop)
    if (globalThis.navigator?.onLine) {
      const delay = Math.min(500 * Math.pow(2, this.#onlineRetryAttempt), 16_000);
      this.#deps.logger.info(
        `navigator.onLine=true, scheduling ack retry (attempt=${this.#onlineRetryAttempt}, delay=${delay}ms)`,
      );
      this.#onlineRetryTimer = this.#clock.setTimeout(doRetry, delay);
      return;
    }

    // Listen: offline -> wait for online event
    this.#onlineRetryHandler = doRetry;
    globalThis.window.addEventListener('online', this.#onlineRetryHandler);

    // Poll fallback: regardless of check/listen path, additionally start POLL_INTERVAL_MS periodic poll
    // Covers cases where online event occasionally doesn't fire in CI headless Chromium etc.
    this.#startPollFallback(doRetry);
  }

  /**
   * Start periodic poll fallback. Only called internally by #registerOnlineRetry.
   * Checks navigator.onLine every POLL_INTERVAL_MS, triggers doRetry when true.
   */
  #startPollFallback(doRetry: () => void): void {
    // check path already set 500ms timer -> no need for extra poll (timer fires first)
    if (this.#onlineRetryTimer !== null) return;

    this.#onlineRetryPollTimer = this.#clock.setInterval(() => {
      if (this.#pendingAudioAck === null || !this.#deps.isHost() || this.#deps.isAborted()) {
        this.#unregisterOnlineRetry();
        return;
      }
      if (globalThis.navigator?.onLine) {
        this.#deps.logger.info('Poll fallback: navigator.onLine=true, triggering ack retry');
        doRetry();
      }
    }, RoomAudioOrchestrator.#pollIntervalMs);
  }

  #unregisterOnlineRetry(): void {
    if (this.#onlineRetryTimer !== null) {
      this.#clock.clearTimeout(this.#onlineRetryTimer);
      this.#onlineRetryTimer = null;
    }
    if (this.#onlineRetryPollTimer !== null) {
      this.#clock.clearInterval(this.#onlineRetryPollTimer);
      this.#onlineRetryPollTimer = null;
    }
    if (this.#onlineRetryHandler !== null) {
      if (typeof globalThis.window?.removeEventListener === 'function') {
        globalThis.window.removeEventListener('online', this.#onlineRetryHandler);
      }
      this.#onlineRetryHandler = null;
    }
  }
}
