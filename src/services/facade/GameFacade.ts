/**
 * GameFacade - UI Facade 实现
 *
 * 职责：
 * - 组合 gameActions / seatActions 子模块
 * - 管理生命周期和身份状态
 * - 对外暴露统一的 public API
 * - 音频编排（执行 SideEffect: PLAY_AUDIO）
 *
 * 实例化方式：
 * - 由 composition root（App.tsx）通过 `new GameFacade(deps)` 创建
 * - 通过 GameFacadeContext 注入到组件树
 * - 通过 constructor DI 注入依赖（测试/组合根）
 *
 * 不包含业务逻辑/校验规则（全部在 handler），不直接修改 state（全部在 reducer），
 * 不使用全局单例（已移除 getInstance/resetInstance）。
 *
 * 子模块划分：
 * - gameActions.ts: Host-only 业务编排（assignRoles/startNight/submitAction）
 * - seatActions.ts: 座位操作编排（takeSeat/leaveSeat + player ACK 等待逻辑）
 */

import * as Sentry from '@sentry/react-native';
import { buildInitialGameState } from '@werewolf/game-engine/engine/state/buildInitialState';
import { GameStore } from '@werewolf/game-engine/engine/store';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { getStepSpec } from '@werewolf/game-engine/models/roles/spec/nightSteps';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type { AudioEffect, GameState } from '@werewolf/game-engine/protocol/types';
import type { RoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';
import { resolveSeerAudioKey } from '@werewolf/game-engine/utils/audioKeyOverride';

import { AudioService } from '@/services/infra/AudioService';
import { RoomService } from '@/services/infra/RoomService';
import { RealtimeService } from '@/services/transport/RealtimeService';
import type { FacadeStateListener, IGameFacade } from '@/services/types/IGameFacade';
import { ConnectionStatus } from '@/services/types/IGameFacade';
import { facadeLog } from '@/utils/logger';

// 子模块
import type { GameActionsContext } from './gameActions';
import * as gameActions from './gameActions';
import type { SeatActionsContext } from './seatActions';
import * as seatActions from './seatActions';

/**
 * GameFacade 可注入依赖
 *
 * 所有字段必填 — 由 composition root（App.tsx）显式创建并注入。
 * 测试中同样显式传入 mock 实例。
 */
interface GameFacadeDeps {
  /** GameStore 实例 */
  store: GameStore;
  /** RealtimeService 实例 */
  realtimeService: RealtimeService;
  /** AudioService 实例 */
  audioService: AudioService;
  /** RoomService 实例（DB state 持久化） */
  roomService: RoomService;
}

export class GameFacade implements IGameFacade {
  readonly #store: GameStore;
  readonly #realtimeService: RealtimeService;
  readonly #audioService: AudioService;
  readonly #roomService: RoomService;
  #isHost = false;
  #myUid: string | null = null;
  /** Cached roomCode: survives store.reset(), used by fetchStateFromDB fallback */
  #roomCode: string | null = null;

  /**
   * Abort flag: set to true when leaving room.
   * Used to abort ongoing async operations (e.g., audio queue in #playPendingAudioEffects).
   * Reset to false when creating/joining a new room.
   */
  #aborted = false;

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

  /** L3 通用：browser online 事件 → fetchStateFromDB（所有玩家，独立于 host-only ack 重试） */
  #onlineFetchHandler: (() => void) | null = null;

  /**
   * L1 重连检测：是否已经历过首次 Live 事件。
   * 构造器中的 status listener 用此标志区分「初始连接」与「重连」。
   * 每次 createRoom / joinRoom 重置为 false（fresh join 的首次 Live 不应触发 fetchStateFromDB）。
   */
  #hasBeenLive = false;

  /**
   * @param deps - 必须由 composition root 或测试显式提供所有依赖。
   */
  constructor(deps: GameFacadeDeps) {
    this.#store = deps.store;
    this.#realtimeService = deps.realtimeService;
    this.#audioService = deps.audioService;
    this.#roomService = deps.roomService;

    // Reactive: 监听 state 中 pendingAudioEffects 出现 → Host 播放 → postAudioAck
    this.#store.subscribe((state) => {
      if (!state) return;
      if (!this.#isHost) return;
      if (!state.pendingAudioEffects || state.pendingAudioEffects.length === 0) return;
      // Avoid reacting during rejoin overlay (resumeAfterRejoin handles that path)
      if (this.#wasAudioInterrupted) return;
      void this.#playPendingAudioEffects(state.pendingAudioEffects);
    });

    // Universal: SDK 重连后立即从 DB 拉取最新 state，补全断线期间错过的广播。
    // 对所有玩家生效（host + non-host），是 subscribe+fetch 社区标准模式在 L1 层的实现。
    this.#realtimeService.addStatusListener((status) => {
      if (status !== ConnectionStatus.Live) return;
      if (!this.#hasBeenLive) {
        this.#hasBeenLive = true;
        return;
      }
      facadeLog.info('SDK reconnected: fetching latest state from DB');
      void this.fetchStateFromDB();
    });

    // Retry: 断线期间 postAudioAck 失败 → 重连 live 后重播音频 + 重试 ack
    this.#realtimeService.addStatusListener((status) => {
      if (status !== ConnectionStatus.Live) return;
      if (!this.#isHost) return;
      if (!this.#pendingAudioAckRetry) return;
      this.#unregisterOnlineRetry();
      this.#pendingAudioAckRetry = false;

      this.#retryPendingAudioAck('reconnect');
    });
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  addListener(fn: FacadeStateListener): () => void {
    return this.#store.subscribe((_state, _rev) => {
      fn(this.#store.getState());
    });
  }

  getState(): GameState | null {
    return this.#store.getState();
  }

  // =========================================================================
  // Identity (从 store 派生，不自己维护)
  // =========================================================================

  isHostPlayer(): boolean {
    return this.#isHost;
  }

  getMyUid(): string | null {
    return this.#myUid;
  }

  getMySeatNumber(): number | null {
    const state = this.#store.getState();
    if (!state || !this.#myUid) return null;
    for (const [seatStr, player] of Object.entries(state.players)) {
      if (player?.uid === this.#myUid) {
        return Number.parseInt(seatStr, 10);
      }
    }
    return null;
  }

  getStateRevision(): number {
    return this.#store.getRevision();
  }

  addConnectionStatusListener(fn: (status: ConnectionStatus) => void): () => void {
    return this.#realtimeService.addStatusListener(fn);
  }

  /**
   * Dead Channel Recovery.
   *
   * Tears down the dead Supabase Realtime channel, creates a fresh one with
   * the same room/callbacks, then fetches latest state from DB.
   * Called by useConnectionSync when Disconnected persists beyond threshold.
   */
  async reconnectChannel(): Promise<void> {
    facadeLog.info('reconnectChannel: starting dead channel recovery');
    try {
      await this.#realtimeService.rejoinCurrentRoom();
      await this.fetchStateFromDB();
      facadeLog.info('reconnectChannel: recovery complete');
    } catch (e) {
      facadeLog.error('reconnectChannel: recovery failed', e);
      throw e;
    }
  }

  /**
   * 获取当前 外部 listener 数量（仅用于测试/调试）。
   * 排除 constructor 内部的 pendingAudioEffects reactive 订阅（固定 1 个）。
   */
  getListenerCount(): number {
    return this.#store.getListenerCount() - 1;
  }

  // =========================================================================
  // Foreground Recovery（前台恢复 — 双通道兜底）
  // =========================================================================

  // =========================================================================
  // Room Lifecycle
  // =========================================================================

  async createRoom(roomCode: string, hostUid: string, template: GameTemplate): Promise<void> {
    this.#aborted = false; // Reset abort flag when creating new room
    this.#isPlayingEffects = false; // Reset audio queue guard (may be stale from previous room)
    this.#wasAudioInterrupted = false; // Reset rejoin audio guard
    this.#pendingAudioAckRetry = false;
    this.#hasBeenLive = false; // Reset L1 reconnect detection for fresh join
    this.#unregisterOnlineRetry();
    this.#isHost = true;
    this.#myUid = hostUid;
    this.#roomCode = roomCode;

    // 初始化 store（使用共享的 buildInitialGameState）
    const initialState = buildInitialGameState(roomCode, hostUid, template);
    this.#store.initialize(initialState);

    // 加入频道（所有客户端统一监听 postgres_changes onDbStateChange）
    await this.#realtimeService.joinRoom(roomCode, hostUid, {
      onDbStateChange: (state: GameState, revision: number) => {
        facadeLog.debug('[DIAG] DB state change → applySnapshot, revision:', revision);
        this.#store.applySnapshot(state, revision);
        this.#realtimeService.markAsLive();
      },
    });

    // 新建房间无需从 DB 读快照（本地已初始化），channel 已 SUBSCRIBED，直接标记 Live
    this.#realtimeService.markAsLive();

    // L3 通用：注册 online 事件 → fetchStateFromDB（Web 平台 SDK 不触发 Live 时的兜底）
    this.#registerOnlineFetch();
  }

  /**
   * 加入已有房间（Host rejoin + Player join 统一入口）
   *
   * 社区标准模式 "subscribe first, then fetch"：
   * 先订阅频道（不丢事件），再从 DB 读取初始状态。
   * Host rejoin 预设 #wasAudioInterrupted guard 阻断订阅期间可能到达的 pendingAudioEffects。
   *
   * @returns success=false 仅在 Host rejoin 且无 DB 状态时
   */
  async joinRoom(
    roomCode: string,
    uid: string,
    isHost: boolean,
  ): Promise<{ success: boolean; reason?: string }> {
    this.#aborted = false;
    this.#isPlayingEffects = false; // Reset audio queue guard (may be stale from previous room)
    this.#pendingAudioAckRetry = false;
    this.#hasBeenLive = false; // Reset L1 reconnect detection for fresh join
    this.#unregisterOnlineRetry();
    this.#isHost = isHost;
    this.#myUid = uid;
    this.#roomCode = roomCode;
    this.#store.reset();

    // Host rejoin: 预设 guard，阻断 subscribe 阶段收到 pendingAudioEffects 时 reactive 误播
    // （非 ongoing 状态无 pendingAudioEffects，pre-set 无害；DB fetch 后按实际状态修正）
    if (isHost) this.#wasAudioInterrupted = true;

    // 1. Subscribe first（社区标准：不丢 gap 期间的事件）
    await this.#realtimeService.joinRoom(roomCode, uid, {
      onDbStateChange: (state: GameState, revision: number) => {
        facadeLog.debug('[DIAG] DB state change → applySnapshot, revision:', revision);
        this.#store.applySnapshot(state, revision);
        this.#realtimeService.markAsLive();
      },
    });

    // 2. Then fetch（统一 Host/Player 路径）
    const dbState = await this.#roomService.getGameState(roomCode);

    if (dbState) {
      if (isHost) {
        // 在 applySnapshot 之前修正：applySnapshot 同步触发 listener，
        // listener 检查 wasAudioInterrupted 决定是否弹 overlay。
        this.#wasAudioInterrupted = dbState.state.status === GameStatus.Ongoing;
      }
      this.#store.applySnapshot(dbState.state, dbState.revision);
      this.#realtimeService.markAsLive();
    } else if (isHost) {
      // Host rejoin 无 DB 状态：无法恢复
      this.#wasAudioInterrupted = false;
      this.#isHost = false;
      this.#myUid = null;
      return { success: false, reason: 'no_db_state' };
    }
    // Player 无 DB 状态：正常 — 状态将通过 broadcast 到达
    // 但必须 markAsLive，否则 connectionStatus 卡在 'syncing'，auto-heal 无法触发
    this.#realtimeService.markAsLive();

    // L3 通用：注册 online 事件 → fetchStateFromDB（Web 平台 SDK 不触发 Live 时的兜底）
    this.#registerOnlineFetch();

    return { success: true };
  }

  /**
   * Host rejoin 后是否有音频被中断（缓存 isAudioPlaying === true）
   * UI 层读取此值决定"继续游戏"overlay 是否需要重播当前步骤音频。
   */
  get wasAudioInterrupted(): boolean {
    return this.#wasAudioInterrupted;
  }

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

    const state = this.#store.getState();
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
            await this.#audioService.playRoleBeginningAudio(resolvedKey);
          } finally {
            // 音频完成（或失败）后，POST audio-ack 释放 gate + 触发推进
            await gameActions.postAudioAck(this.#getActionsContext());
          }
        } else {
          // 无 stepSpec（不该发生），兜底释放 gate
          await gameActions.postAudioAck(this.#getActionsContext());
        }
      } else {
        // 无 currentStepId，兜底释放 gate
        await gameActions.postAudioAck(this.#getActionsContext());
      }
    } catch (e) {
      // Caller uses fire-and-forget `void` — catch here to prevent unhandled rejection
      facadeLog.error('resumeAfterRejoin failed', e);
      Sentry.captureException(e);
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

    try {
      for (const effect of effects) {
        if (this.#aborted) break;
        try {
          if (effect.isEndAudio) {
            await this.#audioService.playRoleEndingAudio(effect.audioKey);
          } else if (effect.audioKey === 'night') {
            await this.#audioService.playNightAudio();
          } else if (effect.audioKey === 'night_end') {
            // 音频时序：天亮语音前立即停 BGM，避免 BGM 与"天亮了"语音重叠。
            // 注意：useBgmControl 中也有 stopBgm，但那是生命周期清理（ended && !isAudioPlaying），
            // 触发时机晚于此处。两者职责不同，stopBgm() 幂等，重复调用无副作用。
            this.#audioService.stopBgm();
            await this.#audioService.playNightEndAudio();
          } else {
            await this.#audioService.playRoleBeginningAudio(effect.audioKey);
          }
        } catch (e) {
          // 单个音频失败不阻断队列（与 resumeAfterRejoin 一致）
          facadeLog.warn('Audio effect playback failed, continuing', {
            audioKey: effect.audioKey,
            error: e,
          });
        }
      }
    } finally {
      this.#isPlayingEffects = false;
      // 无论成功/失败/中断，都 POST audio-ack 释放 gate
      if (!this.#aborted) {
        const ackResult = await gameActions.postAudioAck(this.#getActionsContext());
        if (!ackResult.success) {
          facadeLog.warn('postAudioAck failed during playback, will retry on reconnect', {
            reason: ackResult.reason,
          });
          this.#pendingAudioAckRetry = true;
          this.#registerOnlineRetry();
        }
      }
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
    const state = this.#store.getState();
    const effects = state?.pendingAudioEffects;
    if (effects && effects.length > 0) {
      facadeLog.info(`Replaying audio effects after ${trigger}`, {
        effectCount: effects.length,
      });
      // #playPendingAudioEffects finally 块会 postAudioAck
      void this.#playPendingAudioEffects(effects);
    } else {
      facadeLog.info(`Retrying postAudioAck after ${trigger} (no effects to replay)`);
      void gameActions
        .postAudioAck(this.#getActionsContext())
        .then((result) => {
          if (!result.success) {
            facadeLog.warn(`postAudioAck retry failed (${trigger}), will retry`, {
              reason: result.reason,
            });
            this.#pendingAudioAckRetry = true;
            onRetryFailed?.();
          }
        })
        .catch((err) => {
          facadeLog.error(`postAudioAck retry threw (${trigger})`, err);
          this.#pendingAudioAckRetry = true;
          onRetryFailed?.();
        });
    }
  }

  // =========================================================================
  // Audio-ack online retry (fallback for missed SDK reconnect events)
  // =========================================================================

  /**
  /** Poll interval for periodic ack retry fallback (ms) */
  static readonly #pollIntervalMs = 5_000;

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
      if (!this.#pendingAudioAckRetry || !this.#isHost || this.#aborted) return;

      facadeLog.info('Online event postAudioAck retry triggered');
      this.#unregisterOnlineRetry();
      this.#pendingAudioAckRetry = false;

      this.#retryPendingAudioAck('online event', () => this.#registerOnlineRetry());
    };

    // Check: 已在线 → 延迟重试（避免同步递归 + 给 event loop 让步）
    if (globalThis.navigator?.onLine) {
      facadeLog.info('navigator.onLine=true, scheduling immediate ack retry');
      this.#onlineRetryTimer = setTimeout(doRetry, 500);
      return;
    }

    // Listen: 离线 → 等待 online 事件
    this.#onlineRetryHandler = doRetry;
    globalThis.window.addEventListener('online', this.#onlineRetryHandler);

    // Poll fallback: 无论 check/listen 哪条路径，额外启动周期轮询兜底
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
      if (!this.#pendingAudioAckRetry || !this.#isHost || this.#aborted) {
        this.#unregisterOnlineRetry();
        return;
      }
      if (globalThis.navigator?.onLine) {
        facadeLog.info('Poll fallback: navigator.onLine=true, triggering ack retry');
        doRetry();
      }
    }, GameFacade.#pollIntervalMs);
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

  // =========================================================================
  // L3 Universal: browser online → fetchStateFromDB
  // =========================================================================

  /**
   * 注册 browser online 事件监听 → fetchStateFromDB。
   *
   * 对所有玩家生效（host + non-host）。覆盖 Web 平台 setOffline(false) 恢复后
   * SDK 未触发 Live 事件的边缘场景。与 L1 status listener fetch 互补 —
   * 两者可能同时触发，fetchStateFromDB 幂等无害。
   *
   * 在 createRoom / joinRoom 注册，leaveRoom 注销。
   */
  #registerOnlineFetch(): void {
    this.#unregisterOnlineFetch();
    if (typeof globalThis.window?.addEventListener !== 'function') return;

    this.#onlineFetchHandler = () => {
      if (this.#aborted) return;
      facadeLog.info('Browser online event: fetching latest state from DB');
      void this.fetchStateFromDB();
    };
    globalThis.window.addEventListener('online', this.#onlineFetchHandler);
  }

  #unregisterOnlineFetch(): void {
    if (this.#onlineFetchHandler !== null) {
      if (typeof globalThis.window?.removeEventListener === 'function') {
        globalThis.window.removeEventListener('online', this.#onlineFetchHandler);
      }
      this.#onlineFetchHandler = null;
    }
  }

  // =========================================================================
  // Progression (Host-only, wolf vote deadline)
  // =========================================================================

  /**
   * Host: wolf vote deadline 到期后触发服务端推进。
   *
   * 客户端倒计时到期时调用，服务端执行 inline progression。
   */
  async postProgression(): Promise<{ success: boolean; reason?: string }> {
    return gameActions.postProgression(this.#getActionsContext());
  }

  async leaveRoom(): Promise<void> {
    // Set abort flag FIRST to stop any ongoing async operations (e.g., audio queue)
    this.#aborted = true;
    this.#pendingAudioAckRetry = false;
    this.#unregisterOnlineRetry();
    this.#unregisterOnlineFetch();

    const mySeat = this.getMySeatNumber();

    // 如果在座，通过 HTTP API 离座
    if (mySeat !== null && this.#myUid) {
      await seatActions.leaveSeat(this.#getSeatActionsContext());
    }

    // Stop currently playing audio and release preloaded audio to free memory
    this.#audioService.stop();
    this.#audioService.clearPreloaded();

    await this.#realtimeService.leaveRoom();
    this.#store.reset();
    this.#myUid = null;
    this.#isHost = false;
    this.#roomCode = null;
    this.#wasAudioInterrupted = false;
  }

  // =========================================================================
  // Seating (委托给 seatActions)
  // =========================================================================

  async takeSeat(seatNumber: number, displayName?: string, avatarUrl?: string): Promise<boolean> {
    return seatActions.takeSeat(this.#getSeatActionsContext(), seatNumber, displayName, avatarUrl);
  }

  async takeSeatWithAck(
    seatNumber: number,
    displayName?: string,
    avatarUrl?: string,
  ): Promise<{ success: boolean; reason?: string }> {
    return seatActions.takeSeatWithAck(
      this.#getSeatActionsContext(),
      seatNumber,
      displayName,
      avatarUrl,
    );
  }

  async leaveSeat(): Promise<boolean> {
    return seatActions.leaveSeat(this.#getSeatActionsContext());
  }

  async leaveSeatWithAck(): Promise<{ success: boolean; reason?: string }> {
    return seatActions.leaveSeatWithAck(this.#getSeatActionsContext());
  }

  // =========================================================================
  // Game Control (委托给 gameActions)
  // =========================================================================

  async assignRoles(): Promise<{ success: boolean; reason?: string }> {
    return gameActions.assignRoles(this.#getActionsContext());
  }

  async updateTemplate(template: GameTemplate): Promise<{ success: boolean; reason?: string }> {
    return gameActions.updateTemplate(this.#getActionsContext(), template);
  }

  async setRoleRevealAnimation(
    animation: RoleRevealAnimation,
  ): Promise<{ success: boolean; reason?: string }> {
    return gameActions.setRoleRevealAnimation(this.#getActionsContext(), animation);
  }

  async markViewedRole(seat: number): Promise<{ success: boolean; reason?: string }> {
    // Host 和 Player 统一走 HTTP API
    return gameActions.markViewedRole(this.#getActionsContext(), seat);
  }

  async startNight(): Promise<{ success: boolean; reason?: string }> {
    return gameActions.startNight(this.#getActionsContext());
  }

  /**
   * Host: 重新开始游戏（HTTP API）
   *
   * 服务端重置 state → postgres_changes 推送新状态到所有客户端。
   */
  async restartGame(): Promise<{ success: boolean; reason?: string }> {
    // Stop current audio then release preloaded resources (stop before clearPreloaded)
    this.#audioService.stop();
    this.#audioService.clearPreloaded();
    // 服务端校验 hostUid，客户端不再做冗余门控
    return gameActions.restartGame(this.#getActionsContext());
  }

  // =========================================================================
  // Debug Mode: Fill With Bots (委托给 gameActions)
  // =========================================================================

  /**
   * Host: 填充机器人（Debug-only）
   *
   * 为所有空座位创建 bot player，设置 debugMode.botsEnabled = true。
   * 仅在 isHost && status === Unseated 时可用。
   */
  async fillWithBots(): Promise<{ success: boolean; reason?: string }> {
    return gameActions.fillWithBots(this.#getActionsContext());
  }

  /**
   * Host: 标记所有机器人已查看角色（Debug-only）
   *
   * 仅对 isBot === true 的玩家设置 hasViewedRole = true。
   * 仅在 debugMode.botsEnabled === true && status === Assigned 时可用。
   */
  async markAllBotsViewed(): Promise<{ success: boolean; reason?: string }> {
    return gameActions.markAllBotsViewed(this.#getActionsContext());
  }

  /**
   * Host: 全员起立
   *
   * 清空所有座位上的玩家。仅在 unseated/seated 状态可用。
   */
  async clearAllSeats(): Promise<{ success: boolean; reason?: string }> {
    return gameActions.clearAllSeats(this.#getActionsContext());
  }

  /**
   * Host: 分享「详细信息」给指定座位
   *
   * ended 阶段 Host 选择允许查看夜晚行动详情的座位列表。
   */
  async shareNightReview(allowedSeats: number[]): Promise<{ success: boolean; reason?: string }> {
    return gameActions.shareNightReview(this.#getActionsContext(), allowedSeats);
  }

  // =========================================================================
  // Night Actions (委托给 gameActions)
  // =========================================================================

  /**
   * 提交夜晚行动（HTTP API）
   *
   * Host 和 Player 统一走 HTTP API。
   * 推进由 gameActions.submitAction 内部触发（仅 Host）。
   */
  async submitAction(
    seat: number,
    role: RoleId,
    target: number | null,
    extra?: unknown,
  ): Promise<{ success: boolean; reason?: string }> {
    return gameActions.submitAction(this.#getActionsContext(), seat, role, target, extra);
  }

  /**
   * 提交 reveal 确认（seer/psychic/gargoyle/wolfRobot）（HTTP API）
   *
   * Host/Player 统一调用 HTTP API
   */
  async submitRevealAck(): Promise<{ success: boolean; reason?: string }> {
    return gameActions.clearRevealAcks(this.#getActionsContext());
  }

  /**
   * 提交 groupConfirm ack（催眠确认 "我知道了"）（HTTP API）
   *
   * 任意玩家调用。服务端收到所有玩家 ack 后自动推进步骤。
   */
  async submitGroupConfirmAck(seat: number): Promise<{ success: boolean; reason?: string }> {
    return gameActions.submitGroupConfirmAck(this.#getActionsContext(), seat);
  }

  // =========================================================================
  // Sync
  // =========================================================================

  /**
   * 提交机械狼查看猎人状态确认（HTTP API）
   *
   * Host/Player 统一调用 HTTP API
   *
   * @param seat - wolfRobot 的座位号（由调用方传入 effectiveSeat，以支持 debug bot 接管）
   */
  async sendWolfRobotHunterStatusViewed(
    seat: number,
  ): Promise<{ success: boolean; reason?: string }> {
    return gameActions.setWolfRobotHunterStatusViewed(this.#getActionsContext(), seat);
  }

  /**
   * 从 DB 直接读取最新状态（auto-heal / reconnect fallback）
   * 服务端权威 — 直接 SELECT from rooms，不经过 broadcast 通道。
   * Host 和 Player 统一使用。
   */
  async fetchStateFromDB(): Promise<boolean> {
    const roomCode = this.#store.getState()?.roomCode ?? this.#roomCode;
    if (!roomCode) return false;

    try {
      const dbState = await this.#roomService.getGameState(roomCode);
      if (dbState) {
        facadeLog.debug('[DIAG] fetchStateFromDB → applySnapshot, revision:', dbState.revision);
        this.#store.applySnapshot(dbState.state, dbState.revision);
        this.#realtimeService.markAsLive();
        return true;
      }
      return false;
    } catch (e) {
      facadeLog.warn('fetchStateFromDB failed', e);
      Sentry.captureException(e);
      return false;
    }
  }

  // =========================================================================
  // Night Flow (委托给 gameActions) - PR6
  // =========================================================================

  /**
   * Host: 结束夜晚，进行死亡结算
   * 夜晚结束音频结束后调用
   */
  async endNight(): Promise<{ success: boolean; reason?: string }> {
    return gameActions.endNight(this.#getActionsContext());
  }

  /**
   * Host: 设置音频播放状态
   *
   * PR7: 音频时序控制
   * - 当音频开始播放时，调用 setAudioPlaying(true)
   * - 当音频结束（或被跳过）时，调用 setAudioPlaying(false)
   */
  async setAudioPlaying(isPlaying: boolean): Promise<{ success: boolean; reason?: string }> {
    return gameActions.setAudioPlaying(this.#getActionsContext(), isPlaying);
  }

  // =========================================================================
  // Context Builders (为子模块提供上下文)
  // =========================================================================

  #getActionsContext(): GameActionsContext {
    return {
      store: this.#store,
      myUid: this.#myUid,
      getMySeatNumber: () => this.getMySeatNumber(),
      audioService: this.#audioService,
    };
  }

  #getSeatActionsContext(): SeatActionsContext {
    return {
      myUid: this.#myUid,
      getRoomCode: () => this.#store.getState()?.roomCode ?? null,
      store: this.#store,
    };
  }
}
