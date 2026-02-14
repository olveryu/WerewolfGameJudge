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
 * - messageRouter.ts: PlayerMessage/HostBroadcast 路由分发
 */

import type { AppStateStatus } from 'react-native';
import { AppState, Platform } from 'react-native';

import type { RevealKind, RoleId } from '@/models/roles';
import { getStepSpec } from '@/models/roles/spec/nightSteps';
import type { GameTemplate } from '@/models/Template';
import { shouldTriggerWolfVoteRecovery } from '@/services/engine/handlers/progressionEvaluator';
import { GameStore } from '@/services/engine/store';
import { AudioService } from '@/services/infra/AudioService';
import { HostStateCache } from '@/services/infra/HostStateCache';
import { RoomService } from '@/services/infra/RoomService';
import type { BroadcastGameState, HostBroadcast, PlayerMessage } from '@/services/protocol/types';
import { BroadcastService } from '@/services/transport/BroadcastService';
import type { FacadeStateListener, IGameFacade } from '@/services/types/IGameFacade';
import type { ConnectionStatus } from '@/services/types/IGameFacade';
import { newRequestId } from '@/utils/id';
import { facadeLog } from '@/utils/logger';

// 子模块
import type { HostActionsContext } from './hostActions';
import * as hostActions from './hostActions';
import type { MessageRouterContext } from './messageRouter';
import * as messageRouter from './messageRouter';
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
  /** HostStateCache 实例 */
  hostStateCache: HostStateCache;
  /** RoomService 实例（DB state 持久化） */
  roomService: RoomService;
}

export class GameFacade implements IGameFacade {
  private readonly store: GameStore;
  private readonly broadcastService: BroadcastService;
  private readonly audioService: AudioService;
  private readonly hostStateCache: HostStateCache;
  private readonly roomService: RoomService;
  private isHost = false;
  private myUid: string | null = null;

  /**
   * Abort flag: set to true when leaving room.
   * Used to abort ongoing async operations (e.g., audio queue in processHandlerResult).
   * Reset to false when creating/joining a new room.
   */
  private _aborted = false;

  /** 前台恢复监听器清理函数（双通道：Web visibilitychange + Native AppState） */
  private _foregroundCleanups: Array<() => void> = [];

  /**
   * 狼人投票倒计时 Timer（Host-only）
   * 存储在 Facade 实例上以跨 getHostActionsContext() 调用持久化。
   * 通过 HostActionsContext 的 getter/setter 暴露给 hostActions 模块。
   */
  private _wolfVoteTimer: ReturnType<typeof setTimeout> | null = null;

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
    this.hostStateCache = deps.hostStateCache;
    this.roomService = deps.roomService;
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
   * 获取当前 listener 数量（仅用于测试/调试）
   */
  getListenerCount(): number {
    return this.store.getListenerCount();
  }

  // =========================================================================
  // Foreground Recovery（前台恢复 — 双通道兜底）
  // =========================================================================

  /**
   * 注册前台恢复监听器（幂等：已注册则跳过）
   *
   * 双通道：
   * - Web: `document.visibilitychange`
   * - Native (iOS/Android): `AppState`
   * - `Platform.OS !== 'web'` 保证不会双触发
   */
  private _setupForegroundRecovery(): void {
    if (this._foregroundCleanups.length > 0) return; // 幂等：已注册则跳过

    const onForeground = (): void => {
      if (!this.isHost || this._aborted) return;
      const state = this.store.getState();
      if (!state || !shouldTriggerWolfVoteRecovery(state, Date.now())) return;
      void hostActions.callNightProgression(this.getHostActionsContext());
    };

    // Channel 1: Web — document.visibilitychange
    if (typeof document !== 'undefined') {
      const handler = (): void => {
        if (document.visibilityState === 'visible') onForeground();
      };
      document.addEventListener('visibilitychange', handler);
      this._foregroundCleanups.push(() =>
        document.removeEventListener('visibilitychange', handler),
      );
    }

    // Channel 2: Native — AppState（iOS/Android only）
    if (Platform.OS !== 'web') {
      const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
        if (next === 'active') onForeground();
      });
      this._foregroundCleanups.push(() => subscription.remove());
    }
  }

  /**
   * 清理前台恢复监听器
   */
  private _teardownForegroundRecovery(): void {
    for (const cleanup of this._foregroundCleanups) cleanup();
    this._foregroundCleanups = [];
  }

  // =========================================================================
  // Room Lifecycle
  // =========================================================================

  async initializeAsHost(roomCode: string, hostUid: string, template: GameTemplate): Promise<void> {
    this._aborted = false; // Reset abort flag when creating new room
    this.isHost = true;
    this.myUid = hostUid;

    // 初始化 store
    const players: BroadcastGameState['players'] = {};
    for (let i = 0; i < template.numberOfPlayers; i++) {
      players[i] = null;
    }

    const initialState: BroadcastGameState = {
      roomCode,
      hostUid,
      status: 'unseated',
      templateRoles: template.roles,
      players,
      currentStepIndex: -1,
      isAudioPlaying: false,
    };

    this.store.initialize(initialState);

    // 加入频道
    await this.broadcastService.joinRoom(roomCode, hostUid, {
      onHostBroadcast: undefined,
      onPlayerMessage: (msg: PlayerMessage, senderId: string) => {
        messageRouter.hostHandlePlayerMessage(this.getMessageRouterContext(), msg, senderId);
      },
      onPresenceChange: (_users: string[]) => {
        void this.broadcastCurrentState();
      },
      onDbStateChange: undefined, // Host 不需要监听 DB 变更
    });

    await this.broadcastCurrentState();

    // 注册前台恢复（Host-only）
    this._setupForegroundRecovery();
  }

  async joinAsPlayer(
    roomCode: string,
    playerUid: string,
    _displayName?: string,
    _avatarUrl?: string,
  ): Promise<void> {
    this._aborted = false; // Reset abort flag when joining room
    this.isHost = false;
    this.myUid = playerUid;
    this.store.reset();

    await this.broadcastService.joinRoom(roomCode, playerUid, {
      onHostBroadcast: (msg: HostBroadcast) => {
        messageRouter.playerHandleHostBroadcast(this.getMessageRouterContext(), msg);
      },
      onPlayerMessage: undefined,
      onPresenceChange: undefined,
      // DB 备份通道：postgres_changes 监听 rooms 表 UPDATE
      onDbStateChange: (state: BroadcastGameState, revision: number) => {
        facadeLog.debug('DB state change → applySnapshot, revision:', revision);
        this.store.applySnapshot(state, revision);
        this.broadcastService.markAsLive();
      },
    });

    // 从 DB 读取初始状态（比 REQUEST_STATE 更可靠 — 不经过 broadcast 通道）
    const dbState = await this.roomService.getGameState(roomCode);
    if (dbState) {
      this.store.applySnapshot(dbState.state, dbState.revision);
      this.broadcastService.markAsLive();
    }

    // 请求当前状态（兜底，万一 DB 还没写入）
    const reqMsg: PlayerMessage = { type: 'REQUEST_STATE', uid: playerUid };
    await this.broadcastService.sendToHost(reqMsg);
  }

  /**
   * Host rejoin: 房主断线重连后重新加入房间
   *
   * 策略：
   * 1. 尝试从本地缓存恢复状态
   * 2. 如果有缓存，恢复并立即广播 STATE_UPDATE
   * 3. 如果没有缓存，返回 false（调用方需提示用户）
   */
  async joinAsHost(
    roomCode: string,
    hostUid: string,
    templateRoles?: RoleId[],
  ): Promise<{ success: boolean; reason?: string }> {
    this._aborted = false; // Reset abort flag when rejoining (matches initializeAsHost/joinAsPlayer)
    this.isHost = true;
    this.myUid = hostUid;

    // 尝试从本地缓存恢复状态（key = roomCode:hostUid）
    const cached = await this.hostStateCache.loadState(roomCode, hostUid);

    if (cached) {
      // 有缓存：恢复状态 + revision（Host rejoin 必须恢复 revision，否则 Player 可能拒绝后续 STATE_UPDATE）
      // 注意：loadState 已经校验了 cached.state.hostUid === hostUid

      // 必须在 applyHostSnapshot 之前设置：applyHostSnapshot 同步触发 listener，
      // listener 检查 wasAudioInterrupted 决定是否弹 overlay。
      // ongoing 状态下的 rejoin 都需要 overlay（用户手势解锁 Web AudioContext 恢复 BGM）。
      this._wasAudioInterrupted = cached.state.status === 'ongoing';

      // Reload 后音频硬件已销毁，但保留 isAudioPlaying = true 作为 gate：
      // rejoin → overlay → 用户点击 → 音频重播 → 音频结束 setAudioPlaying(false)
      // 全程 gate 阻断座位操作，零 gap。
      this.store.applyHostSnapshot(cached.state, cached.revision);
    } else if (templateRoles && templateRoles.length > 0) {
      // 没有缓存但有模板：创建初始状态
      const players: BroadcastGameState['players'] = {};
      for (let i = 0; i < templateRoles.length; i++) {
        players[i] = null;
      }

      const initialState: BroadcastGameState = {
        roomCode,
        hostUid,
        status: 'unseated',
        templateRoles,
        players,
        currentStepIndex: -1,
        isAudioPlaying: false,
      };

      this.store.initialize(initialState);
    } else {
      // 没有缓存且没有模板：无法恢复
      this.isHost = false;
      this.myUid = null;
      return { success: false, reason: 'no_cached_state' };
    }

    // 加入频道（作为 Host）
    await this.broadcastService.joinRoom(roomCode, hostUid, {
      onHostBroadcast: undefined,
      onPlayerMessage: (msg: PlayerMessage, senderId: string) => {
        messageRouter.hostHandlePlayerMessage(this.getMessageRouterContext(), msg, senderId);
      },
      onPresenceChange: (_users: string[]) => {
        void this.broadcastCurrentState();
      },
      onDbStateChange: undefined, // Host 不需要监听 DB 变更
    });

    // 立即广播当前状态，让所有 Player 同步
    await this.broadcastCurrentState();

    // 注册前台恢复（Host-only）
    this._setupForegroundRecovery();

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
   * 3. 音频结束后 setAudioPlaying(false) 解锁 gate
   * 4. 重建 wolfVoteTimer（如果 deadline 残留）
   * 5. 调用 callNightProgression 恢复推进（Timer 丢失 / endNight 未触发）
   *
   * 注意：isAudioPlaying 从 cache 保持为 true，不需要再 setAudioPlaying(true)。
   */
  async resumeAfterRejoin(): Promise<void> {
    // Early clear — 阻断 listener 重新设 overlay + 防止多次点击重入
    if (!this._wasAudioInterrupted) return;
    this._wasAudioInterrupted = false;

    const state = this.store.getState();
    if (!state) return;

    try {
      // 如果音频没在播放（cache 中 isAudioPlaying=false），只需恢复 BGM（caller 已处理）
      if (!state.isAudioPlaying) {
        // 仍需重建 timer + 触发推进（狼人投完票 → 倒计时内刷新 → timer 丢失）
        this._rebuildWolfVoteTimerIfNeeded();
        await hostActions.callNightProgression(this.getHostActionsContext());
        return;
      }

      // 重播当前步骤音频（isAudioPlaying 已从 cache 保持为 true，gate 已激活）
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
            await this.setAudioPlaying(false);
          }
        } else {
          // 无 stepSpec（不该发生），兜底释放 gate
          await this.setAudioPlaying(false);
        }
      } else {
        // 无 currentStepId，兜底释放 gate
        await this.setAudioPlaying(false);
      }

      // gate 释放后：重建 timer + 触发推进
      this._rebuildWolfVoteTimerIfNeeded();
      await hostActions.callNightProgression(this.getHostActionsContext());
    } catch (e) {
      // Caller uses fire-and-forget `void` — catch here to prevent unhandled rejection
      facadeLog.error('resumeAfterRejoin failed', e);
    }
  }

  /**
   * 重建 wolfVoteTimer（如果 state 中残留 deadline 且已过期，立即推进；未过期则 set timer）。
   * Rejoin 后所有 JS Timer 丢失，需根据 state.wolfVoteDeadline 重建。
   */
  private _rebuildWolfVoteTimerIfNeeded(): void {
    if (this._wolfVoteTimer != null) return; // 已有 timer，无需重建

    const state = this.store.getState();
    if (!state || state.currentStepId !== 'wolfKill' || state.wolfVoteDeadline == null) return;

    const remaining = state.wolfVoteDeadline - Date.now();
    if (remaining <= 0) {
      // deadline 已过期，立即触发推进（callNightProgression 会在后续被调用）
      facadeLog.info(
        'Rebuilding wolfVoteTimer: deadline already passed, will progress immediately',
      );
      return;
    }

    // deadline 未到，重建 timer
    facadeLog.info('Rebuilding wolfVoteTimer after rejoin', { remaining });
    this._wolfVoteTimer = setTimeout(async () => {
      this._wolfVoteTimer = null;
      if (!this._aborted) {
        await hostActions.callNightProgression(this.getHostActionsContext());
      }
    }, remaining);
  }

  async leaveRoom(): Promise<void> {
    // Set abort flag FIRST to stop any ongoing async operations (e.g., audio queue)
    this._aborted = true;

    // 清理前台恢复 + wolf vote timer
    this._teardownForegroundRecovery();
    if (this._wolfVoteTimer != null) {
      clearTimeout(this._wolfVoteTimer);
      this._wolfVoteTimer = null;
    }

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
    // Host: 直接处理
    if (this.isHost) {
      return hostActions.markViewedRole(this.getHostActionsContext(), seat);
    }

    // Player: 发送 PlayerMessage 给 Host
    const msg: PlayerMessage = { type: 'VIEWED_ROLE', seat };
    await this.broadcastService.sendToHost(msg);
    // Player 端不等待确认，依赖 Host 广播 STATE_UPDATE
    return { success: true };
  }

  async startNight(): Promise<{ success: boolean; reason?: string }> {
    return hostActions.startNight(this.getHostActionsContext());
  }

  /**
   * Host: 重新开始游戏
   *
   * PR9: 对齐 v1 行为
   * - 先广播 GAME_RESTARTED
   * - 再执行 reducer 重置状态
   * - 最后广播 STATE_UPDATE
   */
  async restartGame(): Promise<{ success: boolean; reason?: string }> {
    if (!this.isHost) {
      return { success: false, reason: 'host_only' };
    }

    // v1 对齐：先广播 GAME_RESTARTED
    await this.broadcastService.broadcastAsHost({ type: 'GAME_RESTARTED' });

    // 执行 reducer + 广播 STATE_UPDATE
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
    if (!this.isHost) {
      return { success: false, reason: 'host_only' };
    }
    return hostActions.fillWithBots(this.getHostActionsContext());
  }

  /**
   * Host: 标记所有机器人已查看角色（Debug-only）
   *
   * 仅对 isBot === true 的玩家设置 hasViewedRole = true。
   * 仅在 debugMode.botsEnabled === true && status === 'assigned' 时可用。
   */
  async markAllBotsViewed(): Promise<{ success: boolean; reason?: string }> {
    if (!this.isHost) {
      return { success: false, reason: 'host_only' };
    }
    return hostActions.markAllBotsViewed(this.getHostActionsContext());
  }

  // =========================================================================
  // Night Actions (委托给 hostActions)
  // =========================================================================

  /**
   * 提交夜晚行动
   *
   * PR9: Player 发送 ACTION 消息给 Host（与 markViewedRole 模式一致）
   * - Host: 直接调用 hostActions.submitAction
   * - Player: 发送 PlayerMessage { type: 'ACTION' } 给 Host
   *
   * 注：Facade 只负责 transport，不做推进决策。
   * 推进由 hostActions.submitAction 内部的 handler 返回 sideEffect 触发。
   */
  async submitAction(
    seat: number,
    role: RoleId,
    target: number | null,
    extra?: unknown,
  ): Promise<{ success: boolean; reason?: string }> {
    // Host: 直接处理
    if (this.isHost) {
      return hostActions.submitAction(this.getHostActionsContext(), seat, role, target, extra);
    }

    // Player: 发送 PlayerMessage 给 Host
    const msg: PlayerMessage = { type: 'ACTION', seat, role, target, extra };
    await this.broadcastService.sendToHost(msg);
    // Player 端不等待确认，依赖 Host 广播 STATE_UPDATE
    return { success: true };
  }

  /**
   * 提交狼人投票
   *
   * PR9: Player 发送 WOLF_VOTE 消息给 Host（与 markViewedRole 模式一致）
   * - Host: 直接调用 hostActions.submitWolfVote
   * - Player: 发送 PlayerMessage { type: 'WOLF_VOTE' } 给 Host
   *
   * 注：Facade 只负责 transport，不做推进决策。
   * 推进由 hostActions.submitWolfVote 内部的 handler 返回 sideEffect 触发。
   */
  async submitWolfVote(
    voterSeat: number,
    targetSeat: number,
  ): Promise<{ success: boolean; reason?: string }> {
    // Host: 直接处理
    if (this.isHost) {
      return hostActions.submitWolfVote(this.getHostActionsContext(), voterSeat, targetSeat);
    }

    // Player: 发送 PlayerMessage 给 Host
    const msg: PlayerMessage = { type: 'WOLF_VOTE', seat: voterSeat, target: targetSeat };
    await this.broadcastService.sendToHost(msg);
    // Player 端不等待确认，依赖 Host 广播 STATE_UPDATE
    return { success: true };
  }

  /**
   * 提交 reveal 确认（seer/psychic/gargoyle/wolfRobot）
   *
   * 当用户确认 reveal 弹窗后调用：
   * - Host: 直接调用 clearRevealAcks
   * - Player: 发送 REVEAL_ACK 消息给 Host
   */
  async submitRevealAck(role: RevealKind): Promise<{ success: boolean; reason?: string }> {
    if (this.isHost) {
      // Host 直接执行
      return hostActions.clearRevealAcks(this.getHostActionsContext());
    }

    // Player: 发送消息给 Host
    const seat = this.getMySeatNumber();
    if (seat === null) {
      return { success: false, reason: 'not_seated' };
    }

    const revision = this.store.getRevision();
    const msg: PlayerMessage = {
      type: 'REVEAL_ACK',
      seat,
      role,
      revision,
    };

    try {
      await this.broadcastService.sendToHost(msg);
      return { success: true };
    } catch (e) {
      facadeLog.warn('sendToHost failed (REVEAL_ACK)', e);
      return { success: false, reason: 'send_failed' };
    }
  }

  // =========================================================================
  // Sync
  // =========================================================================

  /**
   * 提交机械狼查看猎人状态确认
   *
   * 当机械狼学到猎人并查看状态后调用：
   * - Host: 直接调用 setWolfRobotHunterStatusViewed
   * - Player: 发送 WOLF_ROBOT_HUNTER_STATUS_VIEWED 消息给 Host
   *
   * @param seat - wolfRobot 的座位号（由调用方传入 effectiveSeat，以支持 debug bot 接管）
   */
  async sendWolfRobotHunterStatusViewed(
    seat: number,
  ): Promise<{ success: boolean; reason?: string }> {
    if (this.isHost) {
      // Host 直接执行
      return hostActions.setWolfRobotHunterStatusViewed(this.getHostActionsContext(), seat);
    }

    // Player: 发送消息给 Host
    const msg: PlayerMessage = {
      type: 'WOLF_ROBOT_HUNTER_STATUS_VIEWED',
      seat,
    };

    try {
      await this.broadcastService.sendToHost(msg);
      return { success: true };
    } catch (e) {
      facadeLog.warn('sendToHost failed (WOLF_ROBOT_HUNTER_STATUS_VIEWED)', e);
      return { success: false, reason: 'send_failed' };
    }
  }

  /**
   * Player: 请求状态快照
   *
   * PR8: Player 发送 REQUEST_STATE 消息给 Host
   */
  async requestSnapshot(): Promise<boolean> {
    if (this.isHost) {
      // Host 不需要请求快照
      return true;
    }

    const uid = this.myUid;
    if (!uid) return false;

    try {
      const reqMsg: PlayerMessage = { type: 'REQUEST_STATE', uid };
      await this.broadcastService.sendToHost(reqMsg);
      return true;
    } catch (e) {
      facadeLog.warn('sendToHost failed (REQUEST_STATE)', e);
      return false;
    }
  }

  /**
   * Player: 从 DB 直接读取最新状态（auto-heal fallback）
   * 比 requestSnapshot 更可靠 — 不经过 broadcast 通道，直接 SELECT from rooms。
   */
  async fetchStateFromDB(): Promise<boolean> {
    if (this.isHost) return true;

    const state = this.store.getState();
    if (!state) return false;

    try {
      const dbState = await this.roomService.getGameState(state.roomCode);
      if (dbState) {
        this.store.applySnapshot(dbState.state, dbState.revision);
        this.broadcastService.markAsLive();
        return true;
      }
      // DB 没有 state（Host 还未写入），fallback 到 requestSnapshot
      return this.requestSnapshot();
    } catch (e) {
      facadeLog.warn('fetchStateFromDB failed, falling back to requestSnapshot', e);
      return this.requestSnapshot();
    }
  }

  // =========================================================================
  // Night Flow (委托给 hostActions) - PR6
  // =========================================================================

  /**
   * Host: 推进夜晚到下一步
   * 音频结束后调用
   */
  async advanceNight(): Promise<{ success: boolean; reason?: string }> {
    return hostActions.advanceNight(this.getHostActionsContext());
  }

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
    // Arrow closures capture `this` lexically — no self-alias needed
    const getTimer = (): NodeJS.Timeout | null => this._wolfVoteTimer;
    const setTimer = (v: NodeJS.Timeout | null): void => {
      this._wolfVoteTimer = v;
    };
    return {
      store: this.store,
      isHost: this.isHost,
      myUid: this.myUid,
      getMySeatNumber: () => this.getMySeatNumber(),
      broadcastCurrentState: () => this.broadcastCurrentState(),
      // Abort check: used by processHandlerResult to stop audio queue when leaving room
      isAborted: () => this._aborted,
      // wolfVoteTimer: getter/setter backed by Facade instance field
      get wolfVoteTimer() {
        return getTimer();
      },
      set wolfVoteTimer(v) {
        setTimer(v);
      },
      // P0-1/P0-5: 音频播放回调（只负责播放 IO）
      playAudio: async (audioKey: string, isEndAudio?: boolean) => {
        const audio = this.audioService;
        if (audioKey === 'night') {
          await audio.playNightAudio();
        } else if (audioKey === 'night_end') {
          await audio.playNightEndAudio();
        } else if (isEndAudio) {
          await audio.playRoleEndingAudio(audioKey as RoleId);
        } else {
          await audio.playRoleBeginningAudio(audioKey as RoleId);
        }
      },
      // 设置 isAudioPlaying Gate（根据 copilot-instructions.md）
      setAudioPlayingGate: async (isPlaying: boolean) => {
        await this.setAudioPlaying(isPlaying);
      },
      audioService: this.audioService,
    };
  }

  private getSeatActionsContext(): SeatActionsContext {
    return {
      myUid: this.myUid,
      getRoomCode: () => this.store.getState()?.roomCode ?? null,
    };
  }

  /**
   * MessageRouter 上下文（action handlers）
   *
   * PR9: 接入 handleAction / handleWolfVote，支持 Player→Host 夜晚行动消息
   * 注：Facade 只负责 transport，不做推进决策。
   */
  private getMessageRouterContext(): MessageRouterContext {
    return {
      store: this.store,
      broadcastService: this.broadcastService,
      isHost: this.isHost,
      myUid: this.myUid,
      broadcastCurrentState: () => this.broadcastCurrentState(),
      handleViewedRole: (seat: number) =>
        hostActions.markViewedRole(this.getHostActionsContext(), seat),
      handleAction: (seat: number, role: RoleId, target: number | null, extra?: unknown) =>
        hostActions.submitAction(this.getHostActionsContext(), seat, role, target, extra),
      handleWolfVote: (voterSeat: number, targetSeat: number) =>
        hostActions.submitWolfVote(this.getHostActionsContext(), voterSeat, targetSeat),
      handleRevealAck: () => hostActions.clearRevealAcks(this.getHostActionsContext()),
      handleWolfRobotHunterStatusViewed: (seat: number) =>
        hostActions.setWolfRobotHunterStatusViewed(this.getHostActionsContext(), seat),
    };
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private findSeatByUid(uid: string | null): number | null {
    if (!uid) return null;
    const state = this.store.getState();
    if (!state) return null;
    for (const [seatStr, player] of Object.entries(state.players)) {
      if (player?.uid === uid) {
        return Number.parseInt(seatStr, 10);
      }
    }
    return null;
  }

  private async broadcastCurrentState(): Promise<void> {
    const state = this.store.getState();
    if (!state) return;

    const revision = this.store.getRevision();

    // Host: 保存状态到本地缓存（用于 rejoin 恢复）+ DB（供 Player 恢复）
    if (this.isHost) {
      void this.hostStateCache.saveState(state.roomCode, state.hostUid, state, revision);
      void this.roomService.upsertGameState(state.roomCode, state, revision);
    }

    const msg: HostBroadcast = {
      type: 'STATE_UPDATE',
      state,
      revision,
    };
    await this.broadcastService.broadcastAsHost(msg);
  }

  private generateRequestId(): string {
    return newRequestId();
  }
}
