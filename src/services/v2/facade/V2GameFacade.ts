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

  /** 测试隔离 */
  static resetInstance(): void {
    if (V2GameFacade._instance) {
      V2GameFacade._instance.store.reset();
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
  // Gate 1: 只用 SEAT_ACTION_REQUEST (sit/standup)
  // =========================================================================

  async takeSeat(seatNumber: number, displayName?: string, avatarUrl?: string): Promise<boolean> {
    if (!this.myUid) return false;

    if (this.isHost) {
      // Host: 走 handler → reducer 路径
      return this.hostProcessJoinSeat(seatNumber, this.myUid, displayName, avatarUrl);
    }

    // Player: 发送 SEAT_ACTION_REQUEST，返回只表示"已发送"
    const requestId = this.generateRequestId();
    const msg: PlayerMessage = {
      type: 'SEAT_ACTION_REQUEST',
      requestId,
      action: 'sit',
      seat: seatNumber,
      uid: this.myUid,
      displayName,
      avatarUrl,
    };
    await this.broadcastService.sendToHost(msg);
    return true; // 只表示请求已发送
  }

  async leaveSeat(): Promise<boolean> {
    const mySeat = this.getMySeatNumber();
    if (!this.myUid || mySeat === null) return false;

    if (this.isHost) {
      return this.hostProcessLeaveSeat(mySeat, this.myUid);
    }

    // Player: 发送 SEAT_ACTION_REQUEST (standup)
    const requestId = this.generateRequestId();
    const msg: PlayerMessage = {
      type: 'SEAT_ACTION_REQUEST',
      requestId,
      action: 'standup',
      seat: mySeat,
      uid: this.myUid,
    };
    await this.broadcastService.sendToHost(msg);
    return true;
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
   * Facade 只做编排：提取参数 → 调 handler → reducer → store → broadcast
   */
  private hostHandleSeatActionRequest(
    msg: Extract<PlayerMessage, { type: 'SEAT_ACTION_REQUEST' }>,
  ): void {
    const { action, seat, uid, displayName, avatarUrl } = msg;

    if (action === 'sit') {
      this.hostProcessJoinSeat(seat, uid, displayName, avatarUrl);
    } else if (action === 'standup') {
      this.hostProcessLeaveSeat(seat, uid);
    }
  }

  // =========================================================================
  // Host: 统一 handler → reducer 路径
  // =========================================================================

  /**
   * Host 处理入座
   * 不在此写校验规则，全部委托给 handleJoinSeat
   */
  private hostProcessJoinSeat(
    seat: number,
    requestUid: string,
    displayName?: string,
    avatarUrl?: string,
  ): boolean {
    const state = this.store.getState();
    if (!state || !this.myUid) return false;

    // 构造 intent（请求者 uid 在 payload，不在 context）
    const intent: JoinSeatIntent = {
      type: 'JOIN_SEAT',
      payload: {
        seat,
        uid: requestUid,
        displayName: displayName ?? '',
        avatarUrl,
      },
    };

    // 构造 context（myUid = Host 的 uid）
    const context: HandlerContext = {
      state,
      isHost: true,
      myUid: this.myUid, // Host 自己的 uid
      mySeat: this.getMySeatNumber(),
    };

    // 调用 handler（校验在这里）
    const result = handleJoinSeat(intent, context);

    if (!result.success) {
      // Phase 0 不做 ACK，只广播当前 state
      void this.broadcastCurrentState();
      return false;
    }

    // 应用 actions 到 reducer
    this.applyActions(state, result.actions);

    // 执行副作用
    if (result.sideEffects?.some((e) => e.type === 'BROADCAST_STATE')) {
      void this.broadcastCurrentState();
    }

    return true;
  }

  /**
   * Host 处理离座
   * 不在此写校验规则，全部委托给 handleLeaveSeat
   */
  private hostProcessLeaveSeat(seat: number, requestUid: string): boolean {
    const state = this.store.getState();
    if (!state || !this.myUid) return false;

    const intent: LeaveSeatIntent = {
      type: 'LEAVE_SEAT',
      payload: {
        seat,
        uid: requestUid,
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
      return false;
    }

    this.applyActions(state, result.actions);

    if (result.sideEffects?.some((e) => e.type === 'BROADCAST_STATE')) {
      void this.broadcastCurrentState();
    }

    return true;
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

    // Phase 0 只处理 STATE_UPDATE
    if (msg.type === 'STATE_UPDATE') {
      // Player: 用 store.applySnapshot 同步（revision 检查）
      this.store.applySnapshot(msg.state, msg.revision);
      this.broadcastService.markAsLive();
    }
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
