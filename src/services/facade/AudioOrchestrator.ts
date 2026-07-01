/**
 * AudioOrchestrator — Host audio orchestration + ack retry.
 *
 * Responsibilities:
 * - Reactively watch store pendingAudioEffects -> play -> postAudioAck
 * - resumeAfterRejoin on Host rejoin (replay current step audio)
 * - Audio-ack disconnect retry (L2 status listener + L3a online retry)
 *
 * Not responsible for:
 * - Room lifecycle or generic disconnect recovery (handled by ConnectionRecoveryManager)
 * - Platform-specific audio playback (handled by AudioService)
 *
 * Boundary constraints:
 * - Only active for Host role (plays/retries only when isHost() === true)
 * - Not reusable after dispose(), must create new instance
 *
 * @remarks #isPlayingEffects re-entry guard: only one audio effect queue plays at a time.
 *   MAX_EFFECTS_LOOP=20 prevents infinite loops. Re-checks store for new effects after each ack.
 *   After reconnect, resends ack via resumeAfterRejoin (if last ack was lost during disconnect).
 */

import type { GameStore } from '@werewolf/game-engine/engine/store';
import { getStepSpec } from '@werewolf/game-engine/models/roles/spec/nightSteps';
import type { AudioEffect } from '@werewolf/game-engine/protocol/types';
import { resolveSeerAudioKey } from '@werewolf/game-engine/utils/audioKeyOverride';

import type { AudioService } from '@/services/infra/AudioService';
import { ConnectionStatus } from '@/services/types/IGameFacade';
import { handleError } from '@/utils/errorPipeline';
import { facadeLog } from '@/utils/logger';

import type { GameActionsContext } from './gameActions';
import * as gameActions from './gameActions';

/** AudioOrchestrator injectable dependencies */
export interface AudioOrchestratorDeps {
  /** GameStore instance */
  store: GameStore;
  /** AudioService instance */
  audioService: AudioService;
  /** Subscribe to Realtime connection status changes */
  addStatusListener: (fn: (status: ConnectionStatus) => void) => () => void;
  /** Get current GameActionsContext (lazy-evaluated to avoid constructor cycles) */
  getActionsContext: () => GameActionsContext;
  /** Whether currently Host (lazy-evaluated) */
  isHost: () => boolean;
  /** Whether currently aborted (lazy-evaluated) */
  isAborted: () => boolean;
}

/**
 * AudioOrchestrator — night audio orchestrator.
 *
 * Responsibilities: play pendingAudioEffects in order, with skip/abort logic.
 * Does not decide "when to play what", only executes.
 */
export class AudioOrchestrator {
  readonly #deps: AudioOrchestratorDeps;

  /**
   * Prevents #playPendingAudioEffects re-entry.
   * Same batch of pendingAudioEffects plays only once.
   */
  #isPlayingEffects = false;

  /**
   * Marks whether audio was interrupted during Host rejoin (cached isAudioPlaying === true).
   * Used by UI layer to determine whether current step audio needs replay.
   * @see resumeAfterRejoin
   */
  #wasAudioInterrupted = false;

  /**
   * Set to true when postAudioAck fails during disconnect.
   * Auto-retries postAudioAck after reconnect (status -> live) if still Host.
   * Reset on leaveRoom / connectCreatedRoom / joinRoom.
   */
  #pendingAudioAckRetry = false;

  /** Browser 'online' event handler: retry postAudioAck on network restore (Web platform fallback when SDK doesn't fire Live event) */
  #onlineRetryHandler: (() => void) | null = null;

  /** Delayed retry timer for check+listen pattern (scheduled immediately when navigator.onLine is already true) */
  #onlineRetryTimer: ReturnType<typeof setTimeout> | null = null;

  /** Periodic poll fallback: check navigator.onLine every POLL_INTERVAL_MS and retry (guards against lost online events) */
  #onlineRetryPollTimer: ReturnType<typeof setInterval> | null = null;

  /** Consecutive retry count (exponential backoff + cap to prevent infinite polling) */
  #onlineRetryAttempt = 0;

  /** Unsubscribe handles for constructor subscriptions */
  #unsubscribeStore: (() => void) | null = null;
  #unsubscribeStatus: (() => void) | null = null;

  /** Maximum retry count (stops retrying after exceeded, waits for user manual refresh) */
  static readonly #maxOnlineRetries = 5;

  /** Poll interval for periodic ack retry fallback (ms) */
  static readonly #pollIntervalMs = 5_000;

  constructor(deps: AudioOrchestratorDeps) {
    this.#deps = deps;

    // Reactive: watch state pendingAudioEffects appear -> Host plays -> postAudioAck
    this.#unsubscribeStore = deps.store.subscribe((state) => {
      if (!state) return;
      if (!deps.isHost()) return;
      if (!state.pendingAudioEffects || state.pendingAudioEffects.length === 0) return;
      // Avoid reacting during rejoin overlay (resumeAfterRejoin handles that path)
      if (this.#wasAudioInterrupted) return;
      void this.#playPendingAudioEffects(state.pendingAudioEffects);
    });

    // L2: Retry — postAudioAck failed during disconnect -> replay audio + retry ack after reconnect live
    this.#unsubscribeStatus = deps.addStatusListener((status) => {
      if (status !== ConnectionStatus.Live) return;
      if (!deps.isHost()) return;
      if (!this.#pendingAudioAckRetry) return;
      this.#unregisterOnlineRetry();
      this.#pendingAudioAckRetry = false;
      this.#onlineRetryAttempt = 0;

      facadeLog.info('SDK reconnected: retrying pending audio ack', { layer: 'L2' });

      this.#retryPendingAudioAck('reconnect');
    });
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /** Whether audio was interrupted after Host rejoin (cached isAudioPlaying === true) */
  get wasAudioInterrupted(): boolean {
    return this.#wasAudioInterrupted;
  }

  /** Set wasAudioInterrupted flag (used by joinRoom to pre-set/modify) */
  setWasAudioInterrupted(value: boolean): void {
    this.#wasAudioInterrupted = value;
  }

  /** Reset for new room (connectCreatedRoom / joinRoom) */
  reset(): void {
    this.#isPlayingEffects = false;
    this.#wasAudioInterrupted = false;
    this.#pendingAudioAckRetry = false;
    this.#onlineRetryAttempt = 0;
    this.#unregisterOnlineRetry();
  }

  /** Cleanup all handlers/timers (leaveRoom) */
  dispose(): void {
    this.#unregisterOnlineRetry();
    this.#unsubscribeStore?.();
    this.#unsubscribeStore = null;
    this.#unsubscribeStatus?.();
    this.#unsubscribeStatus = null;
  }

  // =========================================================================
  // Resume After Rejoin
  // =========================================================================

  /**
   * Called after Host rejoin + user clicks "resume game".
   * Triggers user gesture -> unlocks Web AudioContext.
   *
   * Behavior:
   * 1. If BGM setting is on -> start BGM (called by useGameRoom)
   * 2. If audio was playing when disconnected -> replay current step begin audio
   * 3. After audio ends, POST audio-ack to unlock gate
   *
   * Note: isAudioPlaying persists as true from DB, no need to setAudioPlaying(true) again.
   */
  async resumeAfterRejoin(): Promise<void> {
    // Early clear — prevent listener from re-setting overlay + prevent multiple click re-entry
    if (!this.#wasAudioInterrupted) return;
    this.#wasAudioInterrupted = false;

    const state = this.#deps.store.getState();
    if (!state) return;

    try {
      // If audio not playing (isAudioPlaying=false in DB), only need to restore BGM (caller already handles)
      // Server inline progression handles subsequent steps automatically
      if (!state.isAudioPlaying) {
        return;
      }

      // Replay current step audio (isAudioPlaying persists as true from DB, gate is active)
      if (state.currentStepId) {
        const stepSpec = getStepSpec(state.currentStepId);
        if (stepSpec) {
          facadeLog.info('Replaying current step audio after rejoin', {
            stepId: state.currentStepId,
            audioKey: stepSpec.audioKey,
          });
          try {
            const resolvedKey = resolveSeerAudioKey(stepSpec.audioKey, state.seerLabelMap);
            await this.#deps.audioService.playRoleBeginningAudio(resolvedKey);
          } finally {
            // After audio completes (or fails), POST audio-ack to release gate + trigger progression
            await this.#postAudioAckWithRetry();
          }
        } else {
          // No stepSpec (shouldn't happen), fallback release gate
          await this.#postAudioAckWithRetry();
        }
      } else {
        // No currentStepId, fallback release gate
        await this.#postAudioAckWithRetry();
      }
    } catch (e) {
      // Caller uses fire-and-forget `void` — catch here to prevent unhandled rejection
      handleError(e, { label: 'resumeAfterRejoin', logger: facadeLog, feedback: false });
    }
  }

  // =========================================================================
  // Shared: postAudioAck with retry fallback
  // =========================================================================

  /**
   * POST audio-ack and set up retry if it fails.
   * Used by resumeAfterRejoin and other paths that need
   * the same retry semantics as #playPendingAudioEffects.
   */
  async #postAudioAckWithRetry(): Promise<void> {
    const ackResult = await gameActions.postAudioAck(this.#deps.getActionsContext());
    if (!ackResult.success) {
      facadeLog.warn('postAudioAck failed in resumeAfterRejoin, will retry on reconnect', {
        reason: ackResult.reason,
      });
      this.#pendingAudioAckRetry = true;
      this.#registerOnlineRetry();
    }
  }

  // =========================================================================
  // Reactive Audio Effects (Host-only)
  // =========================================================================

  /**
   * Host reactively plays pendingAudioEffects queue.
   *
   * Trigger: store subscription detects state.pendingAudioEffects non-empty.
   * After playback, calls postAudioAck to release isAudioPlaying gate + trigger progression.
   *
   * Re-entry guard: isPlayingEffects flag.
   * Interruption: aborted flag (set on leaveRoom).
   */
  async #playPendingAudioEffects(effects: AudioEffect[]): Promise<void> {
    if (this.#isPlayingEffects) return;
    this.#isPlayingEffects = true;

    const { audioService } = this.#deps;

    try {
      let currentEffects: AudioEffect[] | undefined = effects;

      // Loop: play effects → ack → re-check for new effects that arrived during playback.
      // Uses a loop instead of recursion to avoid unbounded stack/heap growth.
      // Max iterations caps at 2 × nightSteps (generous upper bound for role_end + night_end chains).
      const maxIterations = 20;
      let iteration = 0;

      while (currentEffects && currentEffects.length > 0) {
        if (++iteration > maxIterations) {
          facadeLog.warn('playPendingAudioEffects exceeded max iterations, breaking', {
            maxIterations,
          });
          break;
        }
        for (const effect of currentEffects) {
          if (this.#deps.isAborted()) break;
          try {
            if (effect.isEndAudio) {
              await audioService.playRoleEndingAudio(effect.audioKey);
            } else if (effect.audioKey === 'night') {
              await audioService.playNightAudio();
            } else if (effect.audioKey === 'night_end') {
              // Audio timing: stop BGM immediately before dawn audio to avoid BGM overlapping with "dawn" voice.
              audioService.stopBgm();
              await audioService.playNightEndAudio();
            } else {
              await audioService.playRoleBeginningAudio(effect.audioKey);
            }
          } catch (e) {
            // Single audio failure doesn't block queue (consistent with resumeAfterRejoin)
            facadeLog.warn('Audio effect playback failed, continuing', {
              audioKey: effect.audioKey,
              error: e,
            });
          }
        }

        // POST audio-ack releases gate
        if (!this.#deps.isAborted()) {
          const ackResult = await gameActions.postAudioAck(this.#deps.getActionsContext());
          if (!ackResult.success) {
            facadeLog.warn('postAudioAck failed during playback, will retry on reconnect', {
              reason: ackResult.reason,
            });
            this.#pendingAudioAckRetry = true;
            this.#registerOnlineRetry();
            break; // ack failed, no re-check (wait for retry path to recover)
          }
        }

        // Re-check: audio-ack inline progression may have produced new pendingAudioEffects (e.g. role_end + night_end),
        // but applySnapshot triggering store subscription was skipped since #isPlayingEffects was still true.
        // Re-check once only after ack success; break out of loop on ack failure.
        const postAckState = this.#deps.store.getState();
        if (
          postAckState?.pendingAudioEffects &&
          postAckState.pendingAudioEffects.length > 0 &&
          this.#deps.isHost() &&
          !this.#wasAudioInterrupted
        ) {
          currentEffects = postAckState.pendingAudioEffects;
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
   * Retry pending audio ack after reconnect: check pendingAudioEffects -> replay or direct postAudioAck.
   *
   * Caller (L2 status listener / L3a online handler) is responsible for clearing #pendingAudioAckRetry
   * and online retry registration. This method only executes retry logic.
   *
   * @param trigger - log identifier for trigger source
   * @param onRetryFailed - callback when ack direct retry fails (lets caller decide whether to re-register online retry)
   */
  #retryPendingAudioAck(trigger: string, onRetryFailed?: () => void): void {
    const state = this.#deps.store.getState();
    const effects = state?.pendingAudioEffects;
    if (effects && effects.length > 0) {
      facadeLog.info('Replaying audio effects after reconnect', {
        trigger,
        effectCount: effects.length,
      });
      // #playPendingAudioEffects finally block will postAudioAck
      void this.#playPendingAudioEffects(effects);
    } else {
      facadeLog.info('Retrying postAudioAck (no effects to replay)', { trigger });
      void gameActions
        .postAudioAck(this.#deps.getActionsContext())
        .then((result) => {
          if (!result.success) {
            facadeLog.warn('postAudioAck retry failed, will retry', {
              trigger,
              reason: result.reason,
            });
            this.#pendingAudioAckRetry = true;
            onRetryFailed?.();
          }
        })
        .catch((err) => {
          facadeLog.error('postAudioAck retry threw', { trigger }, err);
          this.#pendingAudioAckRetry = true;
          onRetryFailed?.();
        });
    }
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
      if (!this.#pendingAudioAckRetry || !this.#deps.isHost() || this.#deps.isAborted()) return;

      // Exponential backoff cap: stop after max retry count to avoid infinite HTTP polling
      if (this.#onlineRetryAttempt >= AudioOrchestrator.#maxOnlineRetries) {
        facadeLog.warn(
          `Online ack retry exhausted (${AudioOrchestrator.#maxOnlineRetries} attempts), giving up`,
        );
        this.#unregisterOnlineRetry();
        return;
      }
      this.#onlineRetryAttempt++;

      facadeLog.info('Online event postAudioAck retry triggered', {
        layer: 'L3a',
        attempt: this.#onlineRetryAttempt,
      });
      this.#unregisterOnlineRetry();
      this.#pendingAudioAckRetry = false;

      this.#retryPendingAudioAck('online event', () => this.#registerOnlineRetry());
    };

    // Check: already online -> exponential backoff delay retry (avoid synchronous recursion + yield to event loop)
    if (globalThis.navigator?.onLine) {
      const delay = Math.min(500 * Math.pow(2, this.#onlineRetryAttempt), 16_000);
      facadeLog.info(
        `navigator.onLine=true, scheduling ack retry (attempt=${this.#onlineRetryAttempt}, delay=${delay}ms)`,
      );
      this.#onlineRetryTimer = setTimeout(doRetry, delay);
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

    this.#onlineRetryPollTimer = setInterval(() => {
      if (!this.#pendingAudioAckRetry || !this.#deps.isHost() || this.#deps.isAborted()) {
        this.#unregisterOnlineRetry();
        return;
      }
      if (globalThis.navigator?.onLine) {
        facadeLog.info('Poll fallback: navigator.onLine=true, triggering ack retry');
        doRetry();
      }
    }, AudioOrchestrator.#pollIntervalMs);
  }

  #unregisterOnlineRetry(): void {
    if (this.#onlineRetryTimer !== null) {
      clearTimeout(this.#onlineRetryTimer);
      this.#onlineRetryTimer = null;
    }
    if (this.#onlineRetryPollTimer !== null) {
      clearInterval(this.#onlineRetryPollTimer);
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
