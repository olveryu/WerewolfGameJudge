/**
 * GameFacade - UI Facade 实现（重构后）
 *
 * 职责：
 * - 组合 hostActions / seatActions / messageRouter 子模块
 * - 管理生命周期和身份状态
 * - 对外暴露统一的 public API
 *
 * DI 支持：
 * - constructor 接受可选的 `GameFacadeDeps`（store / broadcastService）
 * - 未提供时自动创建生产默认值
 * - `getInstance()` 保留为向后兼容的全局单例工厂
 *
 * ✅ 允许：组合子模块、管理生命周期、音频编排（执行 SideEffect: PLAY_AUDIO）
 * ✅ 允许：通过 constructor DI 注入依赖（测试/组合根）
 * ❌ 禁止：业务逻辑/校验规则（全部在 handler）
 * ❌ 禁止：直接修改 state（全部在 reducer）
 *
 * 子模块划分：
 * - hostActions.ts: Host-only 业务编排（assignRoles/startNight/submitAction/submitWolfVote）
 * - seatActions.ts: 座位操作编排（takeSeat/leaveSeat + player ACK 等待逻辑）
 * - messageRouter.ts: PlayerMessage/HostBroadcast 路由分发
 */

import type { IGameFacade, StateListener } from '@/services/types/IGameFacade';
import type { GameTemplate } from '@/models/Template';
import type { BroadcastGameState, PlayerMessage, HostBroadcast } from '@/services/protocol/types';
import type { RoleId } from '@/models/roles';

import { BroadcastService } from '@/services/transport/BroadcastService';
import { GameStore } from '@/services/engine/store';
import AudioService from '@/services/infra/AudioService';
import { HostStateCache } from '@/services/infra/HostStateCache';

// 子模块
import type { HostActionsContext } from './hostActions';
import type { SeatActionsContext, PendingSeatAction } from './seatActions';
import type { MessageRouterContext } from './messageRouter';
import * as hostActions from './hostActions';
import * as seatActions from './seatActions';
import * as messageRouter from './messageRouter';
import { newRequestId } from '@/utils/id';

/**
 * GameFacade 可注入依赖（全部可选，未提供时使用生产默认值）
 */
export interface GameFacadeDeps {
  store?: GameStore;
  broadcastService?: BroadcastService;
}

export class GameFacade implements IGameFacade {
  private static _instance: GameFacade | null = null;

  private readonly store: GameStore;
  private readonly broadcastService: BroadcastService;
  private isHost = false;
  private myUid: string | null = null;

  /**
   * Abort flag: set to true when leaving room.
   * Used to abort ongoing async operations (e.g., audio queue in processHandlerResult).
   * Reset to false when creating/joining a new room.
   */
  private _aborted = false;

  /** Pending seat action request (Player: waiting for ACK) */
  private readonly pendingSeatAction: { current: PendingSeatAction | null } = { current: null };

  /**
   * @param deps - 可选依赖注入。未提供时使用生产默认值。
   *   - `store`: GameStore 实例（默认 `new GameStore()`）
   *   - `broadcastService`: BroadcastService 实例（默认 `BroadcastService.getInstance()`）
   */
  constructor(deps?: GameFacadeDeps) {
    this.store = deps?.store ?? new GameStore();
    this.broadcastService = deps?.broadcastService ?? BroadcastService.getInstance();
  }

  /**
   * 全局单例工厂（向后兼容）
   * 生产代码中推荐通过 composition root 使用 `new GameFacade()` + Context 注入。
   */
  static getInstance(): GameFacade {
    GameFacade._instance ??= new GameFacade();
    return GameFacade._instance;
  }

  /** 测试隔离：完全销毁 instance 包括 listeners */
  static resetInstance(): void {
    if (GameFacade._instance) {
      GameFacade._instance.store.destroy();
    }
    GameFacade._instance = null;
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  addListener(fn: StateListener): () => void {
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

  /**
   * 获取当前 listener 数量（仅用于测试/调试）
   */
  getListenerCount(): number {
    return this.store.getListenerCount();
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
      currentActionerIndex: -1,
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
    });

    await this.broadcastCurrentState();
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
        messageRouter.playerHandleHostBroadcast(
          this.getMessageRouterContext(),
          msg,
          this.pendingSeatAction,
        );
      },
      onPlayerMessage: undefined,
      onPresenceChange: undefined,
    });

    // 请求当前状态
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
    this.isHost = true;
    this.myUid = hostUid;

    // 尝试从本地缓存恢复状态（key = roomCode:hostUid）
    const hostCache = HostStateCache.getInstance();
    const cached = await hostCache.loadState(roomCode, hostUid);

    if (cached) {
      // 有缓存：恢复状态 + revision（Host rejoin 必须恢复 revision，否则 Player 可能拒绝后续 STATE_UPDATE）
      // 注意：loadState 已经校验了 cached.state.hostUid === hostUid
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
        currentActionerIndex: -1,
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
    });

    // 立即广播当前状态，让所有 Player 同步
    await this.broadcastCurrentState();

    return { success: true };
  }

  async leaveRoom(): Promise<void> {
    // Set abort flag FIRST to stop any ongoing async operations (e.g., audio queue)
    this._aborted = true;

    const mySeat = this.getMySeatNumber();

    // 如果在座且不是 Host，发送离座请求
    if (!this.isHost && mySeat !== null && this.myUid) {
      const requestId = this.generateRequestId();
      const msg: PlayerMessage = {
        type: 'SEAT_ACTION_REQUEST',
        requestId,
        action: 'standup',
        seat: mySeat,
        uid: this.myUid,
      };
      await this.broadcastService.sendToHost(msg);
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
    return seatActions.takeSeat(
      this.getSeatActionsContext(),
      this.pendingSeatAction,
      seatNumber,
      displayName,
      avatarUrl,
    );
  }

  async takeSeatWithAck(
    seatNumber: number,
    displayName?: string,
    avatarUrl?: string,
  ): Promise<{ success: boolean; reason?: string }> {
    return seatActions.takeSeatWithAck(
      this.getSeatActionsContext(),
      this.pendingSeatAction,
      seatNumber,
      displayName,
      avatarUrl,
    );
  }

  async leaveSeat(): Promise<boolean> {
    return seatActions.leaveSeat(this.getSeatActionsContext(), this.pendingSeatAction);
  }

  async leaveSeatWithAck(): Promise<{ success: boolean; reason?: string }> {
    return seatActions.leaveSeatWithAck(this.getSeatActionsContext(), this.pendingSeatAction);
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
  async submitRevealAck(
    role: 'seer' | 'psychic' | 'gargoyle' | 'wolfRobot',
  ): Promise<{ success: boolean; reason?: string }> {
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
    } catch {
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
    } catch {
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
    } catch {
      return false;
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
    return {
      store: this.store,
      isHost: this.isHost,
      myUid: this.myUid,
      getMySeatNumber: () => this.getMySeatNumber(),
      broadcastCurrentState: () => this.broadcastCurrentState(),
      // Abort check: used by processHandlerResult to stop audio queue when leaving room
      isAborted: () => this._aborted,
      // P0-1/P0-5: 音频播放回调（只负责播放 IO）
      playAudio: async (audioKey: string, isEndAudio?: boolean) => {
        const audio = AudioService.getInstance();
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
    };
  }

  private getSeatActionsContext(): SeatActionsContext {
    return {
      store: this.store,
      broadcastService: this.broadcastService,
      isHost: this.isHost,
      myUid: this.myUid,
      getMySeatNumber: () => this.getMySeatNumber(),
      broadcastCurrentState: () => this.broadcastCurrentState(),
      findSeatByUid: (uid) => this.findSeatByUid(uid),
      generateRequestId: () => this.generateRequestId(),
    };
  }

  /**
   * MessageRouter 上下文（扩展 SeatActionsContext + action handlers）
   *
   * PR9: 接入 handleAction / handleWolfVote，支持 Player→Host 夜晚行动消息
   * 注：Facade 只负责 transport，不做推进决策。
   */
  private getMessageRouterContext(): MessageRouterContext {
    return {
      ...this.getSeatActionsContext(),
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

    // Host: 保存状态到本地缓存（用于 rejoin 恢复）
    if (this.isHost) {
      void HostStateCache.getInstance().saveState(state.roomCode, state.hostUid, state, revision);
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
