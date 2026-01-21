/**
 * V2GameFacade - UI Facade 实现
 *
 * Phase 0: 房间生命周期 + 座位操作
 *
 * 职责边界：
 * - Facade 只做编排：消息接入 → 调 handler → reducer → store → broadcast
 * - 禁止在此处写业务逻辑/校验规则
 * - 所有校验在 handler (handleJoinSeat/handleLeaveSeat)
 *
 * Gate 1 选择：只用 SEAT_ACTION_REQUEST (sit/standup)，不用 JOIN/LEAVE
 */

import type { IGameFacade, StateListener } from '../../types/IGameFacade';
import type { GameTemplate } from '../../../models/Template';
import type { BroadcastGameState, PlayerMessage, HostBroadcast } from '../../protocol/types';
import { BroadcastService } from '../../BroadcastService';
import { GameStore } from '../store';
import { gameReducer } from '../reducer';
import { handleJoinSeat, handleLeaveSeat } from '../handlers/seatHandler';
import type { JoinSeatIntent, LeaveSeatIntent } from '../intents/types';
import type { HandlerContext } from '../handlers/types';
import type { StateAction } from '../reducer/types';
import { v2FacadeLog } from '../../../utils/logger';
import { REASON_TIMEOUT, REASON_CANCELLED, REASON_INVALID_ACTION } from '../protocol/reasonCodes';

export class V2GameFacade implements IGameFacade {
  private static _instance: V2GameFacade | null = null;

  private readonly store: GameStore;
  private readonly broadcastService: BroadcastService;
  private isHost = false;
  private myUid: string | null = null;

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
    // 真实签名: joinRoom(roomCode, userId, { onHostBroadcast?, onPlayerMessage?, onPresenceChange? })
    await this.broadcastService.joinRoom(roomCode, hostUid, {
      onHostBroadcast: undefined, // Host 不需要监听自己的广播
      onPlayerMessage: (msg: PlayerMessage, senderId: string) => {
        this.hostHandlePlayerMessage(msg, senderId);
      },
      onPresenceChange: (_users: string[]) => {
        // 有新用户加入时广播当前状态
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
        this.playerHandleHostBroadcast(msg);
      },
      onPlayerMessage: undefined, // Player 不需要监听 PlayerMessage
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
      // Gate 1: 使用 SEAT_ACTION_REQUEST (standup)
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
  // Seating
  // Phase 1: Player 等待 ACK（完整实现）
  // =========================================================================

  /** Pending seat action request (Player: waiting for ACK) */
  private pendingSeatAction: {
    requestId: string;
    resolve: (result: { success: boolean; reason?: string }) => void;
    reject: (error: Error) => void;
    timeoutHandle: ReturnType<typeof setTimeout>;
  } | null = null;

  /** ACK 超时时间 */
  private static readonly ACK_TIMEOUT_MS = 5000;

  /**
   * 入座（返回 boolean，兼容旧 API）
   */
  async takeSeat(seatNumber: number, displayName?: string, avatarUrl?: string): Promise<boolean> {
    const result = await this.takeSeatWithAck(seatNumber, displayName, avatarUrl);
    return result.success;
  }

  /**
   * 入座并返回完整结果（包含 reason）
   *
   * Facade 只做编排，不校验 myUid 有效性，全部委托给 handler
   */
  async takeSeatWithAck(
    seatNumber: number,
    displayName?: string,
    avatarUrl?: string,
  ): Promise<{ success: boolean; reason?: string }> {
    if (this.isHost) {
      // Host: 走 handler → reducer 路径
      return this.hostProcessJoinSeat(seatNumber, this.myUid, displayName, avatarUrl);
    }

    // Player: 发送 SEAT_ACTION_REQUEST，等待 ACK
    return this.playerSendSeatActionWithAck('sit', seatNumber, displayName, avatarUrl);
  }

  /**
   * 离座（返回 boolean，兼容旧 API）
   */
  async leaveSeat(): Promise<boolean> {
    const result = await this.leaveSeatWithAck();
    return result.success;
  }

  /**
   * 离座并返回完整结果（包含 reason）
   *
   * Facade 只做编排，不校验 myUid/mySeat 有效性，全部委托给 handler
   * 当 mySeat 为 null 时，使用 -1 让 handler 返回 invalid_seat
   */
  async leaveSeatWithAck(): Promise<{ success: boolean; reason?: string }> {
    const mySeat = this.getMySeatNumber();

    if (this.isHost) {
      // mySeat 为 null 时用 -1，handler 会返回 invalid_seat
      return this.hostProcessLeaveSeat(mySeat ?? -1, this.myUid);
    }

    // Player: 发送 SEAT_ACTION_REQUEST (standup)，等待 ACK
    // mySeat 为 null 时用 -1，Host handler 会返回 invalid_seat
    return this.playerSendSeatActionWithAck('standup', mySeat ?? -1);
  }

  /**
   * Player: 发送座位请求并等待 ACK
   * @returns { success, reason? } - reason 透传自 Host ACK
   */
  private async playerSendSeatActionWithAck(
    action: 'sit' | 'standup',
    seat: number,
    displayName?: string,
    avatarUrl?: string,
  ): Promise<{ success: boolean; reason?: string }> {
    // 如果有 pending 请求，先取消
    if (this.pendingSeatAction) {
      clearTimeout(this.pendingSeatAction.timeoutHandle);
      this.pendingSeatAction.reject(new Error('Cancelled by new request'));
      this.pendingSeatAction = null;
    }

    const requestId = this.generateRequestId();
    v2FacadeLog.debug('Player sending seat action:', { action, seat, requestId });

    // 创建 Promise 等待 ACK（返回完整 result）
    const ackPromise = new Promise<{ success: boolean; reason?: string }>((resolve, _reject) => {
      const timeoutHandle = setTimeout(() => {
        if (this.pendingSeatAction?.requestId === requestId) {
          v2FacadeLog.warn('Seat action ACK timeout:', requestId);
          this.pendingSeatAction = null;
          resolve({ success: false, reason: REASON_TIMEOUT });
        }
      }, V2GameFacade.ACK_TIMEOUT_MS);

      this.pendingSeatAction = {
        requestId,
        resolve,
        reject: (err) => {
          v2FacadeLog.warn('Pending request rejected:', err);
          resolve({ success: false, reason: REASON_CANCELLED });
        },
        timeoutHandle,
      };
    });

    // 发送请求（uid 可能为空字符串，Host handler 会拒绝）
    const msg: PlayerMessage = {
      type: 'SEAT_ACTION_REQUEST',
      requestId,
      action,
      seat,
      uid: this.myUid ?? '',
      displayName,
      avatarUrl,
    };
    await this.broadcastService.sendToHost(msg);

    // 等待 ACK
    const result = await ackPromise;
    v2FacadeLog.debug('Player seat action result:', { action, seat, requestId, result });
    return result;
  }

  // =========================================================================
  // Host: 处理 PlayerMessage
  // Facade 只做编排，不写规则
  // =========================================================================

  private hostHandlePlayerMessage(msg: PlayerMessage, _senderId: string): void {
    if (!this.isHost) return;

    switch (msg.type) {
      case 'REQUEST_STATE':
        void this.broadcastCurrentState();
        break;

      case 'SEAT_ACTION_REQUEST':
        this.hostHandleSeatActionRequest(msg);
        break;

      // Phase 0 不处理其他类型
    }
  }

  /**
   * Host 处理座位请求
   * Facade 只做编排：提取参数 → 调 handler → reducer → store → broadcast → ACK
   */
  private hostHandleSeatActionRequest(
    msg: Extract<PlayerMessage, { type: 'SEAT_ACTION_REQUEST' }>,
  ): void {
    const { action, seat, uid, displayName, avatarUrl, requestId } = msg;

    let result: { success: boolean; reason?: string };

    if (action === 'sit') {
      result = this.hostProcessJoinSeat(seat, uid, displayName, avatarUrl);
    } else if (action === 'standup') {
      result = this.hostProcessLeaveSeat(seat, uid);
    } else {
      result = { success: false, reason: REASON_INVALID_ACTION };
    }

    // 发送 ACK 给请求者（reason 来自 handler，不在 Facade 写规则）
    void this.sendSeatActionAck(requestId, uid, result.success, seat, result.reason);
  }

  /**
   * Host 发送座位操作 ACK
   */
  private async sendSeatActionAck(
    requestId: string,
    toUid: string,
    success: boolean,
    seat: number,
    reason?: string,
  ): Promise<void> {
    const ack: HostBroadcast = {
      type: 'SEAT_ACTION_ACK',
      requestId,
      toUid,
      success,
      seat,
      reason,
    };
    await this.broadcastService.broadcastAsHost(ack);
  }

  // =========================================================================
  // Host: 统一 handler → reducer 路径
  // =========================================================================

  /**
   * Host 处理入座
  /**
   * Host 处理入座
   *
   * Facade 不做任何校验，全部委托给 handler
   * @param requestUid - 可能为 null，handler 会校验
   * @returns { success, reason } - reason 来自 handler
   */
  private hostProcessJoinSeat(
    seat: number,
    requestUid: string | null,
    displayName?: string,
    avatarUrl?: string,
  ): { success: boolean; reason?: string } {
    v2FacadeLog.debug('hostProcessJoinSeat', { seat, requestUid });

    const state = this.store.getState();

    // 构造 intent（uid 可能为空字符串，handler 会拒绝）
    const intent: JoinSeatIntent = {
      type: 'JOIN_SEAT',
      payload: {
        seat,
        uid: requestUid ?? '',
        displayName: displayName ?? '',
        avatarUrl,
      },
    };

    // 构造 context（state 可能为 null，handler 会校验）
    const context: HandlerContext = {
      state,
      isHost: true,
      myUid: this.myUid,
      mySeat: this.getMySeatNumber(),
    };

    // 调用 handler（所有校验在这里）
    const result = handleJoinSeat(intent, context);

    if (!result.success) {
      void this.broadcastCurrentState();
      return { success: false, reason: result.reason };
    }

    // 应用 actions 到 reducer（此时 state 必不为 null）
    if (state) {
      this.applyActions(state, result.actions);
    }

    // 执行副作用
    if (result.sideEffects?.some((e) => e.type === 'BROADCAST_STATE')) {
      void this.broadcastCurrentState();
    }

    return { success: true };
  }

  /**
   * Host 处理离座
   *
   * Facade 不做任何校验，全部委托给 handler
   * @param requestUid - 可能为 null，handler 会校验
   * @returns { success, reason } - reason 来自 handler
   */
  private hostProcessLeaveSeat(
    seat: number,
    requestUid: string | null,
  ): { success: boolean; reason?: string } {
    v2FacadeLog.debug('hostProcessLeaveSeat', { seat, requestUid });

    const state = this.store.getState();

    const intent: LeaveSeatIntent = {
      type: 'LEAVE_SEAT',
      payload: {
        seat,
        uid: requestUid ?? '',
      },
    };

    const context: HandlerContext = {
      state,
      isHost: true,
      myUid: this.myUid,
      mySeat: this.getMySeatNumber(),
    };

    const result = handleLeaveSeat(intent, context);

    if (!result.success) {
      void this.broadcastCurrentState();
      return { success: false, reason: result.reason };
    }

    // 应用 actions 到 reducer（此时 state 必不为 null）
    if (state) {
      this.applyActions(state, result.actions);
    }

    if (result.sideEffects?.some((e) => e.type === 'BROADCAST_STATE')) {
      void this.broadcastCurrentState();
    }

    return { success: true };
  }

  /**
   * 应用 actions 到 reducer → store
   */
  private applyActions(currentState: BroadcastGameState, actions: StateAction[]): void {
    let newState = currentState;
    for (const action of actions) {
      newState = gameReducer(newState, action);
    }
    this.store.setState(newState);
  }

  // =========================================================================
  // Player: 处理 HostBroadcast
  // =========================================================================

  private playerHandleHostBroadcast(msg: HostBroadcast): void {
    if (this.isHost) return;

    switch (msg.type) {
      case 'STATE_UPDATE':
        // Player: 用 store.applySnapshot 同步（revision 检查）
        this.store.applySnapshot(msg.state, msg.revision);
        this.broadcastService.markAsLive();
        break;

      case 'SEAT_ACTION_ACK':
        this.playerHandleSeatActionAck(msg);
        break;
    }
  }

  /**
   * Player 处理座位操作 ACK
   */
  private playerHandleSeatActionAck(
    msg: Extract<HostBroadcast, { type: 'SEAT_ACTION_ACK' }>,
  ): void {
    // 检查是否是发给自己的 ACK
    if (msg.toUid !== this.myUid) return;

    // 检查 requestId 是否匹配
    if (!this.pendingSeatAction || this.pendingSeatAction.requestId !== msg.requestId) {
      v2FacadeLog.warn('Received ACK for unknown request', { requestId: msg.requestId });
      return;
    }

    // 清理 timeout
    clearTimeout(this.pendingSeatAction.timeoutHandle);

    // Resolve promise（透传 success + reason）
    const pending = this.pendingSeatAction;
    this.pendingSeatAction = null;
    pending.resolve({ success: msg.success, reason: msg.reason });

    v2FacadeLog.debug('playerHandleSeatActionAck', {
      requestId: msg.requestId,
      success: msg.success,
      reason: msg.reason,
    });
  }

  // =========================================================================
  // Helpers
  // =========================================================================

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
