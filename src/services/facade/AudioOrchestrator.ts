/**
 * AudioOrchestrator — Host 音频编排 + ack 重试
 *
 * 从 GameFacade 提取，职责：
 * 1. Reactive 监听 store 中 pendingAudioEffects → 播放 → postAudioAck
 * 2. Host rejoin 时 resumeAfterRejoin（重播当前步骤音频）
 * 3. Audio-ack 断线重试（L2 status listener + L3a online retry）
 *
 * 不负责房间生命周期或通用断线恢复（由 ConnectionRecoveryManager 处理）。
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

/** AudioOrchestrator 的可注入依赖 */
export interface AudioOrchestratorDeps {
  /** GameStore 实例 */
  store: GameStore;
  /** AudioService 实例 */
  audioService: AudioService;
  /** 订阅 Realtime 连接状态变化 */
  addStatusListener: (fn: (status: ConnectionStatus) => void) => () => void;
  /** 获取当前 GameActionsContext（延迟求值，避免构造时循环） */
  getActionsContext: () => GameActionsContext;
  /** 当前是否是 Host（延迟求值） */
  isHost: () => boolean;
  /** 当前是否已 abort（延迟求值） */
  isAborted: () => boolean;
}

export class AudioOrchestrator {
  readonly #deps: AudioOrchestratorDeps;

  /**
   * 防止 #playPendingAudioEffects 重入。
   * 同一批 pendingAudioEffects 只播放一次。
   */
  #isPlayingEffects = false;

  /**
   * 标记 Host rejoin 时音频是否被中断（缓存中 isAudioPlaying === true）。
   * 用于 UI 层判断是否需要重播当前步骤音频。
   * @see resumeAfterRejoin
   */
  #wasAudioInterrupted = false;

  /**
   * 断线时 postAudioAck 失败 → 设为 true。
   * 重连后（status → live）且仍为 Host 时自动重试 postAudioAck。
   * leaveRoom / createRoom / joinRoom 重置。
   */
  #pendingAudioAckRetry = false;

  /** Browser 'online' event handler: 网络恢复时重试 postAudioAck（Web 平台兜底 SDK 未触发 Live 事件） */
  #onlineRetryHandler: (() => void) | null = null;

  /** check+listen 模式的延迟重试 timer（navigator.onLine 已为 true 时立即调度） */
  #onlineRetryTimer: ReturnType<typeof setTimeout> | null = null;

  /** Periodic poll fallback: 每 POLL_INTERVAL_MS 检查 navigator.onLine 并重试（防止 online 事件丢失） */
  #onlineRetryPollTimer: ReturnType<typeof setInterval> | null = null;

  /** 连续重试计数（指数退避 + 上限防止无限轮询） */
  #onlineRetryAttempt = 0;

  /** Unsubscribe handles for constructor subscriptions */
  #unsubscribeStore: (() => void) | null = null;
  #unsubscribeStatus: (() => void) | null = null;

  /** 最大重试次数（超过后停止重试，等待用户手动刷新） */
  static readonly #maxOnlineRetries = 5;

  /** Poll interval for periodic ack retry fallback (ms) */
  static readonly #pollIntervalMs = 5_000;

  constructor(deps: AudioOrchestratorDeps) {
    this.#deps = deps;

    // Reactive: 监听 state 中 pendingAudioEffects 出现 → Host 播放 → postAudioAck
    this.#unsubscribeStore = deps.store.subscribe((state) => {
      if (!state) return;
      if (!deps.isHost()) return;
      if (!state.pendingAudioEffects || state.pendingAudioEffects.length === 0) return;
      // Avoid reacting during rejoin overlay (resumeAfterRejoin handles that path)
      if (this.#wasAudioInterrupted) return;
      void this.#playPendingAudioEffects(state.pendingAudioEffects);
    });

    // L2: Retry — 断线期间 postAudioAck 失败 → 重连 live 后重播音频 + 重试 ack
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

  /** Host rejoin 后是否有音频被中断（缓存 isAudioPlaying === true） */
  get wasAudioInterrupted(): boolean {
    return this.#wasAudioInterrupted;
  }

  /** Set wasAudioInterrupted flag (used by joinRoom to pre-set/modify) */
  setWasAudioInterrupted(value: boolean): void {
    this.#wasAudioInterrupted = value;
  }

  /** Reset for new room (createRoom / joinRoom) */
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
   * Host rejoin + 用户点击"继续游戏"后调用。
   * 触发 user gesture → 解锁 Web AudioContext。
   *
   * 行为：
   * 1. 如果 BGM 设置开启 → 启动 BGM（由 useGameRoom 调用）
   * 2. 如果断开时音频正在播放 → 重播当前步骤的 begin 音频
   * 3. 音频结束后 POST audio-ack 解锁 gate
   *
   * 注意：isAudioPlaying 从 DB 保持为 true，不需要再 setAudioPlaying(true)。
   */
  async resumeAfterRejoin(): Promise<void> {
    // Early clear — 阻断 listener 重新设 overlay + 防止多次点击重入
    if (!this.#wasAudioInterrupted) return;
    this.#wasAudioInterrupted = false;

    const state = this.#deps.store.getState();
    if (!state) return;

    try {
      // 如果音频没在播放（DB 中 isAudioPlaying=false），只需恢复 BGM（caller 已处理）
      // 服务端内联推进会自动处理后续步骤
      if (!state.isAudioPlaying) {
        return;
      }

      // 重播当前步骤音频（isAudioPlaying 已从 DB 保持为 true，gate 已激活）
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
            // 音频完成（或失败）后，POST audio-ack 释放 gate + 触发推进
            await this.#postAudioAckWithRetry();
          }
        } else {
          // 无 stepSpec（不该发生），兜底释放 gate
          await this.#postAudioAckWithRetry();
        }
      } else {
        // 无 currentStepId，兜底释放 gate
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
   * Host 响应式播放 pendingAudioEffects 队列。
   *
   * 触发源：store subscription 检测到 state.pendingAudioEffects 非空。
   * 播放完成后调用 postAudioAck 释放 isAudioPlaying gate + 触发推进。
   *
   * 防重入：isPlayingEffects flag。
   * 中断：aborted flag（leaveRoom 时设置）。
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
              // 音频时序：天亮语音前立即停 BGM，避免 BGM 与"天亮了"语音重叠。
              audioService.stopBgm();
              await audioService.playNightEndAudio();
            } else {
              await audioService.playRoleBeginningAudio(effect.audioKey);
            }
          } catch (e) {
            // 单个音频失败不阻断队列（与 resumeAfterRejoin 一致）
            facadeLog.warn('Audio effect playback failed, continuing', {
              audioKey: effect.audioKey,
              error: e,
            });
          }
        }

        // POST audio-ack 释放 gate
        if (!this.#deps.isAborted()) {
          const ackResult = await gameActions.postAudioAck(this.#deps.getActionsContext());
          if (!ackResult.success) {
            facadeLog.warn('postAudioAck failed during playback, will retry on reconnect', {
              reason: ackResult.reason,
            });
            this.#pendingAudioAckRetry = true;
            this.#registerOnlineRetry();
            break; // ack 失败，不再 re-check（等 retry 路径恢复）
          }
        }

        // Re-check: audio-ack 的内联推进可能产生了新 pendingAudioEffects（如 role_end + night_end），
        // 但 applySnapshot 触发 store subscription 时 #isPlayingEffects 还为 true 被跳过了。
        // 仅在 ack 成功后 re-check 一次；ack 失败时 break 出循环。
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
   * 重连后重试 pending audio ack：检查 pendingAudioEffects → 重播或直接 postAudioAck。
   *
   * 调用方（L2 status listener / L3a online handler）负责清除 #pendingAudioAckRetry
   * 和 online retry 注册。此方法仅执行重试逻辑。
   *
   * @param trigger - 日志标识触发来源
   * @param onRetryFailed - ack 直接重试失败时的回调（让调用方决定是否 re-register online retry）
   */
  #retryPendingAudioAck(trigger: string, onRetryFailed?: () => void): void {
    const state = this.#deps.store.getState();
    const effects = state?.pendingAudioEffects;
    if (effects && effects.length > 0) {
      facadeLog.info('Replaying audio effects after reconnect', {
        trigger,
        effectCount: effects.length,
      });
      // #playPendingAudioEffects finally 块会 postAudioAck
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
   * 注册 audio-ack 重试：check + listen + poll 三层模式。
   *
   * 1. 若 `navigator.onLine === true` → 延迟 500ms 后直接执行重试（避免同步递归）
   * 2. 若离线 → 挂 `window.addEventListener('online', ...)` 等待网络恢复
   * 3. 无论 1/2，额外启动 POLL_INTERVAL_MS 周期轮询兜底（防止 online 事件在
   *    CI headless Chromium 等环境中丢失）
   *
   * 解决时序竞争：online 事件可能在 registerOnlineRetry() 调用之前已经触发，
   * 此时仅靠 listener 永远收不到事件 → 用 navigator.onLine 检测兜底。
   * 周期轮询是最终安全网：即使 check 和 listen 都未触发，5s 后 poll 仍会重试。
   *
   * 原生端 WebSocket 会真正断开 → status listener 已覆盖，此处仅 Web 平台需要。
   */
  #registerOnlineRetry(): void {
    this.#unregisterOnlineRetry();
    if (typeof globalThis.window?.addEventListener !== 'function') return;

    const doRetry = () => {
      if (!this.#pendingAudioAckRetry || !this.#deps.isHost() || this.#deps.isAborted()) return;

      // 指数退避上限：超过最大重试次数后停止，避免无限 HTTP 轮询
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

    // Check: 已在线 → 指数退避延迟重试（避免同步递归 + 给 event loop 让步）
    if (globalThis.navigator?.onLine) {
      const delay = Math.min(500 * Math.pow(2, this.#onlineRetryAttempt), 16_000);
      facadeLog.info(
        `navigator.onLine=true, scheduling ack retry (attempt=${this.#onlineRetryAttempt}, delay=${delay}ms)`,
      );
      this.#onlineRetryTimer = setTimeout(doRetry, delay);
      return;
    }

    // Listen: 离线 → 等待 online 事件
    this.#onlineRetryHandler = doRetry;
    globalThis.window.addEventListener('online', this.#onlineRetryHandler);

    // Poll fallback: 无论 check/listen 哪条路径，额外启动 POLL_INTERVAL_MS 周期轮询兜底
    // 覆盖 online 事件在 CI headless Chromium 等环境中偶尔不触发的情况
    this.#startPollFallback(doRetry);
  }

  /**
   * 启动周期轮询兜底。仅在 #registerOnlineRetry 内部调用。
   * 每 POLL_INTERVAL_MS 检查 navigator.onLine，为 true 时触发 doRetry。
   */
  #startPollFallback(doRetry: () => void): void {
    // check 路径已设置 500ms timer → 不需要额外 poll（timer 会先触发）
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
