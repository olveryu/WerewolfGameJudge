/**
 * GameFacade - UI Facade 实现
 *
 * 职责：
 * - 组合 hostActions / seatActions / messageRouter 子模块
 * - 管理生命周期和身份状态
 * - 对外暴露统一的 public API
 *
 * 实例化方式：
 * - 由 composition root（App.tsx）通过 `new GameFacade(deps)` 创建
 * - 通过 GameFacadeContext 注入到组件树
 *
 * ✅ 允许：组合子模块、管理生命周期、音频编排（执行 SideEffect: PLAY_AUDIO）
 * ✅ 允许：通过 constructor DI 注入依赖（测试/组合根）
 * ❌ 禁止：业务逻辑/校验规则（全部在 handler）
 * ❌ 禁止：直接修改 state（全部在 reducer）
 * ❌ 禁止：全局单例（已移除 getInstance/resetInstance）
 *
 * 子模块划分：
 * - hostActions.ts: Host-only 业务编排（assignRoles/startNight/submitAction/submitWolfVote）
 * - seatActions.ts: 座位操作编排（takeSeat/leaveSeat + player ACK 等待逻辑）
 * - messageRouter.ts: 统一 STATE_UPDATE 处理（Host + Player 共用）
 */

import type { RevealKind, RoleId } from '@/models/roles';
import { getStepSpec } from '@/models/roles/spec/nightSteps';
import type { GameTemplate } from '@/models/Template';
import { buildInitialGameState } from '@/services/engine/state/buildInitialState';
import { GameStore } from '@/services/engine/store';
import { AudioService } from '@/services/infra/AudioService';
import { RoomService } from '@/services/infra/RoomService';
import type { AudioEffect, BroadcastGameState, HostBroadcast } from '@/services/protocol/types';
import { BroadcastService } from '@/services/transport/BroadcastService';
import type { FacadeStateListener, IGameFacade } from '@/services/types/IGameFacade';
import type { ConnectionStatus } from '@/services/types/IGameFacade';
import { newRequestId } from '@/utils/id';
import { facadeLog } from '@/utils/logger';

// 子模块
import type { HostActionsContext } from './hostActions';
import * as hostActions from './hostActions';
import type { MessageRouterContext } from './messageRouter';
import { handleStateUpdate } from './messageRouter';
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
  /** BroadcastService 实例 */
  broadcastService: BroadcastService;
  /** AudioService 实例 */
  audioService: AudioService;
  /** RoomService 实例（DB state 持久化） */
  roomService: RoomService;
}

export class GameFacade implements IGameFacade {
  private readonly store: GameStore;
  private readonly broadcastService: BroadcastService;
  private readonly audioService: AudioService;
  private readonly roomService: RoomService;
  private isHost = false;
  private myUid: string | null = null;

  /**
   * Abort flag: set to true when leaving room.
   * Used to abort ongoing async operations (e.g., audio queue in _playPendingAudioEffects).
   * Reset to false when creating/joining a new room.
   */
  private _aborted = false;

  /**
   * 防止 _playPendingAudioEffects 重入。
   * 同一批 pendingAudioEffects 只播放一次。
   */
  private _isPlayingEffects = false;

  /**
   * 标记 Host rejoin 时音频是否被中断（缓存中 isAudioPlaying === true）。
   * 用于 UI 层判断是否需要重播当前步骤音频。
   * @see resumeAfterRejoin
   */
  private _wasAudioInterrupted = false;

  /**
   * @param deps - 必须由 composition root 或测试显式提供所有依赖。
   */
  constructor(deps: GameFacadeDeps) {
    this.store = deps.store;
    this.broadcastService = deps.broadcastService;
    this.audioService = deps.audioService;
    this.roomService = deps.roomService;

    // Reactive: 监听 state 中 pendingAudioEffects 出现 → Host 播放 → postAudioAck
    this.store.subscribe((state) => {
      if (!state) return;
      if (!this.isHost) return;
      if (!state.pendingAudioEffects || state.pendingAudioEffects.length === 0) return;
      // Avoid reacting during rejoin overlay (resumeAfterRejoin handles that path)
      if (this._wasAudioInterrupted) return;
      void this._playPendingAudioEffects(state.pendingAudioEffects);
    });
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  addListener(fn: FacadeStateListener): () => void {
    return this.store.subscribe((_state, _rev) => {
      fn(this.store.getState());
    });
  }

  getState(): BroadcastGameState | null {
    return this.store.getState();
  }

  // =========================================================================
  // Identity (从 store 派生，不自己维护)
  // =========================================================================

  isHostPlayer(): boolean {
    return this.isHost;
  }

  getMyUid(): string | null {
    return this.myUid;
  }

  getMySeatNumber(): number | null {
    const state = this.store.getState();
    if (!state || !this.myUid) return null;
    for (const [seatStr, player] of Object.entries(state.players)) {
      if (player?.uid === this.myUid) {
        return Number.parseInt(seatStr, 10);
      }
    }
    return null;
  }

  getStateRevision(): number {
    return this.store.getRevision();
  }

  addConnectionStatusListener(fn: (status: ConnectionStatus) => void): () => void {
    return this.broadcastService.addStatusListener(fn);
  }

  /**
   * 获取当前 外部 listener 数量（仅用于测试/调试）。
   * 排除 constructor 内部的 pendingAudioEffects reactive 订阅（固定 1 个）。
   */
  getListenerCount(): number {
    return this.store.getListenerCount() - 1;
  }

  // =========================================================================
  // Foreground Recovery（前台恢复 — 双通道兜底）
  // =========================================================================

  // =========================================================================
  // Room Lifecycle
  // =========================================================================

  async createRoom(roomCode: string, hostUid: string, template: GameTemplate): Promise<void> {
    this._aborted = false; // Reset abort flag when creating new room
    this.isHost = true;
    this.myUid = hostUid;

    // 初始化 store（使用共享的 buildInitialGameState）
    const initialState = buildInitialGameState(roomCode, hostUid, template);
    this.store.initialize(initialState);

    // 加入频道（Host 和 Player 统一监听 onHostBroadcast + onDbStateChange）
    await this.broadcastService.joinRoom(roomCode, hostUid, {
      onHostBroadcast: (msg: HostBroadcast) => {
        handleStateUpdate(this.getMessageRouterContext(), msg);
      },
      onDbStateChange: (state: BroadcastGameState, revision: number) => {
        facadeLog.debug('DB state change → applySnapshot, revision:', revision);
        this.store.applySnapshot(state, revision);
        this.broadcastService.markAsLive();
      },
    });
  }

  /**
   * 加入已有房间（Host rejoin + Player join 统一入口）
   *
   * 社区标准模式 "subscribe first, then fetch"：
   * 先订阅频道（不丢事件），再从 DB 读取初始状态。
   * Host rejoin 预设 _wasAudioInterrupted guard 阻断订阅期间可能到达的 pendingAudioEffects。
   *
   * @returns success=false 仅在 Host rejoin 且无 DB 状态时
   */
  async joinRoom(
    roomCode: string,
    uid: string,
    isHost: boolean,
  ): Promise<{ success: boolean; reason?: string }> {
    this._aborted = false;
    this.isHost = isHost;
    this.myUid = uid;
    this.store.reset();

    // Host rejoin: 预设 guard，阻断 subscribe 阶段收到 pendingAudioEffects 时 reactive 误播
    // （非 ongoing 状态无 pendingAudioEffects，pre-set 无害；DB fetch 后按实际状态修正）
    if (isHost) this._wasAudioInterrupted = true;

    // 1. Subscribe first（社区标准：不丢 gap 期间的事件）
    await this.broadcastService.joinRoom(roomCode, uid, {
      onHostBroadcast: (msg: HostBroadcast) => {
        handleStateUpdate(this.getMessageRouterContext(), msg);
      },
      onDbStateChange: (state: BroadcastGameState, revision: number) => {
        facadeLog.debug('DB state change → applySnapshot, revision:', revision);
        this.store.applySnapshot(state, revision);
        this.broadcastService.markAsLive();
      },
    });

    // 2. Then fetch（统一 Host/Player 路径）
    const dbState = await this.roomService.getGameState(roomCode);

    if (dbState) {
      if (isHost) {
        // 在 applySnapshot 之前修正：applySnapshot 同步触发 listener，
        // listener 检查 wasAudioInterrupted 决定是否弹 overlay。
        this._wasAudioInterrupted = dbState.state.status === 'ongoing';
      }
      this.store.applySnapshot(dbState.state, dbState.revision);
      this.broadcastService.markAsLive();
    } else if (isHost) {
      // Host rejoin 无 DB 状态：无法恢复
      this._wasAudioInterrupted = false;
      this.isHost = false;
      this.myUid = null;
      return { success: false, reason: 'no_db_state' };
    }
    // Player 无 DB 状态：正常 — 状态将通过 broadcast 到达

    return { success: true };
  }

  /**
   * Host rejoin 后是否有音频被中断（缓存 isAudioPlaying === true）
   * UI 层读取此值决定"继续游戏"overlay 是否需要重播当前步骤音频。
   */
  get wasAudioInterrupted(): boolean {
    return this._wasAudioInterrupted;
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
    if (!this._wasAudioInterrupted) return;
    this._wasAudioInterrupted = false;

    const state = this.store.getState();
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
            await this.audioService.playRoleBeginningAudio(stepSpec.audioKey as RoleId);
          } finally {
            // 音频完成（或失败）后，POST audio-ack 释放 gate + 触发推进
            await hostActions.postAudioAck(this.getHostActionsContext());
          }
        } else {
          // 无 stepSpec（不该发生），兜底释放 gate
          await hostActions.postAudioAck(this.getHostActionsContext());
        }
      } else {
        // 无 currentStepId，兜底释放 gate
        await hostActions.postAudioAck(this.getHostActionsContext());
      }
    } catch (e) {
      // Caller uses fire-and-forget `void` — catch here to prevent unhandled rejection
      facadeLog.error('resumeAfterRejoin failed', e);
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
   * 防重入：_isPlayingEffects flag。
   * 中断：_aborted flag（leaveRoom 时设置）。
   */
  private async _playPendingAudioEffects(effects: AudioEffect[]): Promise<void> {
    if (this._isPlayingEffects) return;
    this._isPlayingEffects = true;

    try {
      for (const effect of effects) {
        if (this._aborted) break;
        try {
          if (effect.isEndAudio) {
            await this.audioService.playRoleEndingAudio(effect.audioKey as RoleId);
          } else if (effect.audioKey === 'night') {
            await this.audioService.playNightAudio();
          } else if (effect.audioKey === 'night_end') {
            await this.audioService.playNightEndAudio();
          } else {
            await this.audioService.playRoleBeginningAudio(effect.audioKey as RoleId);
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
      this._isPlayingEffects = false;
      // 无论成功/失败/中断，都 POST audio-ack 释放 gate
      if (!this._aborted) {
        await hostActions.postAudioAck(this.getHostActionsContext());
      }
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
    return hostActions.postProgression(this.getHostActionsContext());
  }

  async leaveRoom(): Promise<void> {
    // Set abort flag FIRST to stop any ongoing async operations (e.g., audio queue)
    this._aborted = true;

    const mySeat = this.getMySeatNumber();

    // 如果在座，通过 HTTP API 离座
    if (mySeat !== null && this.myUid) {
      await seatActions.leaveSeat(this.getSeatActionsContext());
    }

    await this.broadcastService.leaveRoom();
    this.store.reset();
    this.myUid = null;
    this.isHost = false;
  }

  // =========================================================================
  // Seating (委托给 seatActions)
  // =========================================================================

  async takeSeat(seatNumber: number, displayName?: string, avatarUrl?: string): Promise<boolean> {
    return seatActions.takeSeat(this.getSeatActionsContext(), seatNumber, displayName, avatarUrl);
  }

  async takeSeatWithAck(
    seatNumber: number,
    displayName?: string,
    avatarUrl?: string,
  ): Promise<{ success: boolean; reason?: string }> {
    return seatActions.takeSeatWithAck(
      this.getSeatActionsContext(),
      seatNumber,
      displayName,
      avatarUrl,
    );
  }

  async leaveSeat(): Promise<boolean> {
    return seatActions.leaveSeat(this.getSeatActionsContext());
  }

  async leaveSeatWithAck(): Promise<{ success: boolean; reason?: string }> {
    return seatActions.leaveSeatWithAck(this.getSeatActionsContext());
  }

  // =========================================================================
  // Game Control (委托给 hostActions)
  // =========================================================================

  async assignRoles(): Promise<{ success: boolean; reason?: string }> {
    return hostActions.assignRoles(this.getHostActionsContext());
  }

  async updateTemplate(template: GameTemplate): Promise<{ success: boolean; reason?: string }> {
    return hostActions.updateTemplate(this.getHostActionsContext(), template);
  }

  async setRoleRevealAnimation(
    animation: 'roulette' | 'flip' | 'none',
  ): Promise<{ success: boolean; reason?: string }> {
    return hostActions.setRoleRevealAnimation(this.getHostActionsContext(), animation);
  }

  async markViewedRole(seat: number): Promise<{ success: boolean; reason?: string }> {
    // Host 和 Player 统一走 HTTP API
    return hostActions.markViewedRole(this.getHostActionsContext(), seat);
  }

  async startNight(): Promise<{ success: boolean; reason?: string }> {
    return hostActions.startNight(this.getHostActionsContext());
  }

  /**
   * Host: 重新开始游戏（HTTP API）
   *
   * 服务端会先广播 GAME_RESTARTED，再变更 state。
   */
  async restartGame(): Promise<{ success: boolean; reason?: string }> {
    // 服务端校验 hostUid，客户端不再做冗余门控
    return hostActions.restartGame(this.getHostActionsContext());
  }

  // =========================================================================
  // Debug Mode: Fill With Bots (委托给 hostActions)
  // =========================================================================

  /**
   * Host: 填充机器人（Debug-only）
   *
   * 为所有空座位创建 bot player，设置 debugMode.botsEnabled = true。
   * 仅在 isHost && status === 'unseated' 时可用。
   */
  async fillWithBots(): Promise<{ success: boolean; reason?: string }> {
    return hostActions.fillWithBots(this.getHostActionsContext());
  }

  /**
   * Host: 标记所有机器人已查看角色（Debug-only）
   *
   * 仅对 isBot === true 的玩家设置 hasViewedRole = true。
   * 仅在 debugMode.botsEnabled === true && status === 'assigned' 时可用。
   */
  async markAllBotsViewed(): Promise<{ success: boolean; reason?: string }> {
    return hostActions.markAllBotsViewed(this.getHostActionsContext());
  }

  // =========================================================================
  // Night Actions (委托给 hostActions)
  // =========================================================================

  /**
   * 提交夜晚行动（HTTP API）
   *
   * Host 和 Player 统一走 HTTP API。
   * 推进由 hostActions.submitAction 内部触发（仅 Host）。
   */
  async submitAction(
    seat: number,
    role: RoleId,
    target: number | null,
    extra?: unknown,
  ): Promise<{ success: boolean; reason?: string }> {
    return hostActions.submitAction(this.getHostActionsContext(), seat, role, target, extra);
  }

  /**
   * 提交狼人投票（HTTP API）
   *
   * Host 和 Player 统一走 HTTP API。
   * 推进和 Timer 管理由 hostActions.submitWolfVote 内部触发（仅 Host）。
   */
  async submitWolfVote(
    voterSeat: number,
    targetSeat: number,
  ): Promise<{ success: boolean; reason?: string }> {
    return hostActions.submitWolfVote(this.getHostActionsContext(), voterSeat, targetSeat);
  }

  /**
   * 提交 reveal 确认（seer/psychic/gargoyle/wolfRobot）（HTTP API）
   *
   * Host/Player 统一调用 HTTP API
   */
  async submitRevealAck(_role: RevealKind): Promise<{ success: boolean; reason?: string }> {
    return hostActions.clearRevealAcks(this.getHostActionsContext());
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
    return hostActions.setWolfRobotHunterStatusViewed(this.getHostActionsContext(), seat);
  }

  /**
   * 从 DB 直接读取最新状态（auto-heal / reconnect fallback）
   * 服务端权威 — 直接 SELECT from rooms，不经过 broadcast 通道。
   * Host 和 Player 统一使用。
   */
  async fetchStateFromDB(): Promise<boolean> {
    const state = this.store.getState();
    if (!state) return false;

    try {
      const dbState = await this.roomService.getGameState(state.roomCode);
      if (dbState) {
        this.store.applySnapshot(dbState.state, dbState.revision);
        this.broadcastService.markAsLive();
        return true;
      }
      return false;
    } catch (e) {
      facadeLog.warn('fetchStateFromDB failed', e);
      return false;
    }
  }

  // =========================================================================
  // Night Flow (委托给 hostActions) - PR6
  // =========================================================================

  /**
   * Host: 结束夜晚，进行死亡结算
   * 夜晚结束音频结束后调用
   */
  async endNight(): Promise<{ success: boolean; reason?: string }> {
    return hostActions.endNight(this.getHostActionsContext());
  }

  /**
   * Host: 设置音频播放状态
   *
   * PR7: 音频时序控制
   * - 当音频开始播放时，调用 setAudioPlaying(true)
   * - 当音频结束（或被跳过）时，调用 setAudioPlaying(false)
   */
  async setAudioPlaying(isPlaying: boolean): Promise<{ success: boolean; reason?: string }> {
    return hostActions.setAudioPlaying(this.getHostActionsContext(), isPlaying);
  }

  // =========================================================================
  // Context Builders (为子模块提供上下文)
  // =========================================================================

  private getHostActionsContext(): HostActionsContext {
    return {
      store: this.store,
      myUid: this.myUid,
      getMySeatNumber: () => this.getMySeatNumber(),
      audioService: this.audioService,
    };
  }

  private getSeatActionsContext(): SeatActionsContext {
    return {
      myUid: this.myUid,
      getRoomCode: () => this.store.getState()?.roomCode ?? null,
      store: this.store,
    };
  }

  /**
   * MessageRouter 上下文
   *
   * 统一 Host/Player：所有客户端共用 handleStateUpdate。
   */
  private getMessageRouterContext(): MessageRouterContext {
    return {
      store: this.store,
      broadcastService: this.broadcastService,
      myUid: this.myUid,
    };
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private generateRequestId(): string {
    return newRequestId();
  }
}
