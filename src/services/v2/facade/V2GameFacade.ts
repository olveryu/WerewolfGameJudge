/**
 * V2GameFacade - UI Facade 实现（重构后）
 *
 * 职责：
 * - 组合 hostActions / seatActions / messageRouter 子模块
 * - 管理 Singleton 生命周期和身份状态
 * - 对外暴露统一的 public API
 *
 * 禁止：
 * - 业务逻辑/校验规则（全部在 handler）
 * - 直接修改 state（全部在 reducer）
 *
 * 子模块划分：
 * - hostActions.ts: Host-only 业务编排（assignRoles/startNight/submitAction/submitWolfVote）
 * - seatActions.ts: 座位操作编排（takeSeat/leaveSeat + player ACK 等待逻辑）
 * - messageRouter.ts: PlayerMessage/HostBroadcast 路由分发
 */

import type { IGameFacade, StateListener } from '../../types/IGameFacade';
import type { GameTemplate } from '../../../models/Template';
import type { BroadcastGameState, PlayerMessage, HostBroadcast } from '../../protocol/types';
import type { RoleId } from '../../../models/roles';

import { BroadcastService } from '../../BroadcastService';
import { GameStore } from '../store';

// 子模块
import type { HostActionsContext } from './hostActions';
import type { SeatActionsContext, PendingSeatAction } from './seatActions';
import type { MessageRouterContext } from './messageRouter';
import * as hostActions from './hostActions';
import * as seatActions from './seatActions';
import * as messageRouter from './messageRouter';

export class V2GameFacade implements IGameFacade {
  private static _instance: V2GameFacade | null = null;

  private readonly store: GameStore;
  private readonly broadcastService: BroadcastService;
  private isHost = false;
  private myUid: string | null = null;

  /** Pending seat action request (Player: waiting for ACK) */
  private readonly pendingSeatAction: { current: PendingSeatAction | null } = { current: null };

  private constructor() {
    this.store = new GameStore();
    this.broadcastService = BroadcastService.getInstance();
  }

  static getInstance(): V2GameFacade {
    V2GameFacade._instance ??= new V2GameFacade();
    return V2GameFacade._instance;
  }

  /** 测试隔离：完全销毁 instance 包括 listeners */
  static resetInstance(): void {
    if (V2GameFacade._instance) {
      V2GameFacade._instance.store.destroy();
    }
    V2GameFacade._instance = null;
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  addListener(fn: StateListener): () => void {
    return this.store.subscribe((_state, _rev) => {
      fn(this.store.getState());
    });
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

  // =========================================================================
  // Room Lifecycle
  // =========================================================================

  async initializeAsHost(roomCode: string, hostUid: string, template: GameTemplate): Promise<void> {
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

  async leaveRoom(): Promise<void> {
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

  async markViewedRole(seat: number): Promise<{ success: boolean; reason?: string }> {
    return hostActions.markViewedRole(this.getHostActionsContext(), seat);
  }

  async startNight(): Promise<{ success: boolean; reason?: string }> {
    return hostActions.startNight(this.getHostActionsContext());
  }

  // =========================================================================
  // Night Actions (委托给 hostActions)
  // =========================================================================

  async submitAction(
    seat: number,
    role: RoleId,
    target: number | null,
    extra?: unknown,
  ): Promise<{ success: boolean; reason?: string }> {
    return hostActions.submitAction(this.getHostActionsContext(), seat, role, target, extra);
  }

  async submitWolfVote(
    voterSeat: number,
    targetSeat: number,
  ): Promise<{ success: boolean; reason?: string }> {
    return hostActions.submitWolfVote(this.getHostActionsContext(), voterSeat, targetSeat);
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
   * MessageRouter 和 SeatActions 共用相同的上下文结构
   */
  private getMessageRouterContext(): MessageRouterContext {
    return this.getSeatActionsContext();
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

    const msg: HostBroadcast = {
      type: 'STATE_UPDATE',
      state,
      revision: this.store.getRevision(),
    };
    await this.broadcastService.broadcastAsHost(msg);
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
