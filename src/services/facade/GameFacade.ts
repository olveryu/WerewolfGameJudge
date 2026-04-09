/**
 * GameFacade - UI Facade 实现
 *
 * 职责：
 * - 组合 gameActions / seatActions 子模块
 * - 管理生命周期和身份状态
 * - 对外暴露统一的 public API
 * - 委托音频编排给 AudioOrchestrator
 * - 委托连接生命周期给 ConnectionManager
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
 * - AudioOrchestrator.ts: Host 音频编排 + ack 重试
 * - ConnectionManager: FSM 驱动的连接生命周期（重连/ping/pong/revision poll）
 */

import { buildInitialGameState } from '@werewolf/game-engine/engine/state/buildInitialState';
import { GameStore } from '@werewolf/game-engine/engine/store';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type { GameState } from '@werewolf/game-engine/protocol/types';
import type { RoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';

import type { ConnectionManager } from '@/services/connection/ConnectionManager';
import { ConnectionState } from '@/services/connection/types';
import { AudioService } from '@/services/infra/AudioService';
import type { FacadeStateListener, IGameFacade } from '@/services/types/IGameFacade';
import { ConnectionStatus } from '@/services/types/IGameFacade';
import type { IRoomService } from '@/services/types/IRoomService';
import { handleError } from '@/utils/errorPipeline';
import { facadeLog } from '@/utils/logger';

import { AudioOrchestrator } from './AudioOrchestrator';
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
  /** ConnectionManager 实例（FSM 驱动的连接生命周期） */
  connectionManager: ConnectionManager;
  /** AudioService 实例 */
  audioService: AudioService;
  /** RoomService 实例（DB state 持久化） */
  roomService: IRoomService;
}

/** Map internal ConnectionState → UI ConnectionStatus */
function mapConnectionStatus(state: ConnectionState): ConnectionStatus {
  switch (state) {
    case ConnectionState.Connecting:
    case ConnectionState.Reconnecting:
      return ConnectionStatus.Connecting;
    case ConnectionState.Syncing:
      return ConnectionStatus.Syncing;
    case ConnectionState.Connected:
      return ConnectionStatus.Live;
    case ConnectionState.Idle:
    case ConnectionState.Disconnected:
    case ConnectionState.Failed:
    case ConnectionState.Disposed:
      return ConnectionStatus.Disconnected;
  }
}

export class GameFacade implements IGameFacade {
  readonly #store: GameStore;
  readonly #connectionManager: ConnectionManager;
  readonly #audioService: AudioService;
  readonly #roomService: IRoomService;
  readonly #audioOrchestrator: AudioOrchestrator;
  #isHost = false;
  #myUid: string | null = null;
  /** Cached roomCode: survives store.reset(), used by fetchStateFromDB fallback */
  #roomCode: string | null = null;

  /**
   * Abort flag: set to true when leaving room.
   * Used to abort ongoing async operations (e.g., audio queue in AudioOrchestrator).
   * Reset to false when creating/joining a new room.
   */
  #aborted = false;

  /**
   * @param deps - 必须由 composition root 或测试显式提供所有依赖。
   */
  constructor(deps: GameFacadeDeps) {
    this.#store = deps.store;
    this.#connectionManager = deps.connectionManager;
    this.#audioService = deps.audioService;
    this.#roomService = deps.roomService;

    // Audio orchestration: reactive playback + ack retry
    this.#audioOrchestrator = new AudioOrchestrator({
      store: deps.store,
      audioService: deps.audioService,
      addStatusListener: (fn) => this.addConnectionStatusListener(fn),
      getActionsContext: () => this.#getActionsContext(),
      isHost: () => this.#isHost,
      isAborted: () => this.#aborted,
    });
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  addListener(fn: FacadeStateListener): () => void {
    const unsub = this.#store.subscribe((_state, _rev) => {
      fn(this.#store.getState());
    });
    return unsub;
  }

  subscribe(onStoreChange: () => void): () => void {
    return this.#store.subscribe(() => onStoreChange());
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

  /**
   * Safety net: update cached uid when auth identity changes.
   *
   * Phase A prevents uid changes during anonymous→register (identity linking).
   * This covers edge cases like signOut → signIn with a different account
   * while the room screen remains mounted (modal Settings).
   */
  updateMyUid(newUid: string): void {
    if (this.#myUid && this.#myUid !== newUid) {
      facadeLog.info('updateMyUid: uid changed', {
        old: this.#myUid,
        new: newUid,
      });
    }
    this.#myUid = newUid;
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
    return this.#connectionManager.addStateListener((state) => {
      fn(mapConnectionStatus(state));
    });
  }

  /**
   * Manual reconnect: user clicked "reconnect" button.
   * Delegates to ConnectionManager FSM (MANUAL_RECONNECT event).
   */
  manualReconnect(): void {
    if (this.#aborted) return;
    this.#connectionManager.manualReconnect();
  }

  /**
   * Constructor 注册的内部 store listener 数量。
   * 若在 constructor 中新增/删除 store.subscribe()，必须同步更新此值。
   */
  static readonly #internalStoreListenerCount = 1;

  /**
   * 获取当前 外部 listener 数量（仅用于测试/调试）。
   * 排除 constructor 内部的 reactive 订阅。
   */
  getListenerCount(): number {
    return this.#store.getListenerCount() - GameFacade.#internalStoreListenerCount;
  }

  // =========================================================================
  // Room Lifecycle
  // =========================================================================

  async createRoom(roomCode: string, hostUid: string, template: GameTemplate): Promise<void> {
    this.#aborted = false;
    this.#audioOrchestrator.reset();
    this.#isHost = true;
    this.#myUid = hostUid;
    this.#roomCode = roomCode;

    // 初始化 store（使用共享的 buildInitialGameState）
    const initialState = buildInitialGameState(roomCode, hostUid, template);
    this.#store.initialize(initialState);

    // 连接 WS + 等待 Connected（FSM: Idle → Connecting → Syncing → Connected）
    await this.#connectionManager.connectAndWait(roomCode, hostUid);
  }

  /**
   * 加入已有房间（Host rejoin + Player join 统一入口）
   *
   * connectAndWait() 会 WS 连接 + 自动 fetchDB（FSM Syncing → Connected）。
   * Host rejoin 预设 #wasAudioInterrupted guard 阻断 reactive 误播。
   *
   * @returns success=false 仅在 Host rejoin 且无 DB 状态时
   */
  async joinRoom(
    roomCode: string,
    uid: string,
    isHost: boolean,
  ): Promise<{ success: boolean; reason?: string }> {
    this.#aborted = false;
    this.#audioOrchestrator.reset();
    this.#isHost = isHost;
    this.#myUid = uid;
    this.#roomCode = roomCode;
    this.#store.reset();

    // Host rejoin: 预设 guard，阻断 subscribe 阶段收到 pendingAudioEffects 时 reactive 误播
    if (isHost) this.#audioOrchestrator.setWasAudioInterrupted(true);

    // connectAndWait: WS 连接 + fetchDB + 等待 Connected
    // FSM 的 Syncing 阶段会自动 fetchDB → onFetchedState → store.applySnapshot
    await this.#connectionManager.connectAndWait(roomCode, uid);

    // After connectAndWait, store should have state from DB (if any)
    const dbState = this.#store.getState();

    if (dbState) {
      if (isHost) {
        this.#audioOrchestrator.setWasAudioInterrupted(dbState.status === GameStatus.Ongoing);
      }
    } else if (isHost) {
      // Host rejoin 无 DB 状态：无法恢复
      this.#audioOrchestrator.setWasAudioInterrupted(false);
      this.#isHost = false;
      this.#myUid = null;
      return { success: false, reason: 'no_db_state' };
    }

    return { success: true };
  }

  /**
   * Host rejoin 后是否有音频被中断（缓存 isAudioPlaying === true）
   * UI 层读取此值决定"继续游戏"overlay 是否需要重播当前步骤音频。
   */
  get wasAudioInterrupted(): boolean {
    return this.#audioOrchestrator.wasAudioInterrupted;
  }

  /**
   * Host rejoin + 用户点击"继续游戏"后调用。
   * 触发 user gesture → 解锁 Web AudioContext。
   * 委托给 AudioOrchestrator 处理音频重播和 ack。
   */
  async resumeAfterRejoin(): Promise<void> {
    return this.#audioOrchestrator.resumeAfterRejoin();
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
    this.#audioOrchestrator.reset();

    // 不自动离座——玩家回到房间时按 UID 恢复原座位

    // Stop currently playing audio and release preloaded audio to free memory
    this.#audioService.stop();
    this.#audioService.clearPreloaded();

    this.#connectionManager.disconnect();
    this.#store.reset();
    this.#myUid = null;
    this.#isHost = false;
    this.#roomCode = null;
  }

  // =========================================================================
  // Seating (委托给 seatActions)
  // =========================================================================

  async takeSeat(
    seatNumber: number,
    displayName?: string,
    avatarUrl?: string,
    avatarFrame?: string,
  ): Promise<boolean> {
    return seatActions.takeSeat(
      this.#getSeatActionsContext(),
      seatNumber,
      displayName,
      avatarUrl,
      avatarFrame,
    );
  }

  async takeSeatWithAck(
    seatNumber: number,
    displayName?: string,
    avatarUrl?: string,
    avatarFrame?: string,
  ): Promise<{ success: boolean; reason?: string }> {
    return seatActions.takeSeatWithAck(
      this.#getSeatActionsContext(),
      seatNumber,
      displayName,
      avatarUrl,
      avatarFrame,
    );
  }

  async leaveSeat(): Promise<boolean> {
    return seatActions.leaveSeat(this.#getSeatActionsContext());
  }

  async leaveSeatWithAck(): Promise<{ success: boolean; reason?: string }> {
    return seatActions.leaveSeatWithAck(this.#getSeatActionsContext());
  }

  async kickPlayer(targetSeat: number): Promise<{ success: boolean; reason?: string }> {
    return seatActions.kickPlayer(this.#getSeatActionsContext(), targetSeat);
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
   * 服务端重置 state → WS 广播推送新状态到所有客户端。
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
   * Host: 标记所有机器人已确认 groupConfirm 步骤（Debug-only）
   *
   * 批量为所有 isBot 玩家提交 groupConfirm ack。
   * 仅在 debugMode.botsEnabled === true && status === Ongoing && 当前步骤为 groupConfirm 时可用。
   */
  async markAllBotsGroupConfirmed(): Promise<{ success: boolean; reason?: string }> {
    return gameActions.markAllBotsGroupConfirmed(this.#getActionsContext());
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
   * 同步玩家资料到 GameState（任何在座玩家）
   *
   * 用户在 SettingsScreen 改名/换头像后调用，将新资料广播到所有客户端。
   * 如果不在座则服务端返回 NOT_SEATED（静默忽略即可）。
   */
  async updatePlayerProfile(
    displayName?: string,
    avatarUrl?: string,
    avatarFrame?: string,
  ): Promise<{ success: boolean; reason?: string }> {
    return gameActions.updatePlayerProfile(
      this.#getActionsContext(),
      displayName,
      avatarUrl,
      avatarFrame,
    );
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
  // Board Nomination (委托给 gameActions)
  // =========================================================================

  async boardNominate(
    displayName: string,
    roles: RoleId[],
  ): Promise<{ success: boolean; reason?: string }> {
    return gameActions.boardNominate(this.#getActionsContext(), displayName, roles);
  }

  async boardUpvote(targetUid: string): Promise<{ success: boolean; reason?: string }> {
    return gameActions.boardUpvote(this.#getActionsContext(), targetUid);
  }

  async boardWithdraw(): Promise<{ success: boolean; reason?: string }> {
    return gameActions.boardWithdraw(this.#getActionsContext());
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
   * 提交机械狼人查看猎人状态确认（HTTP API）
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
        this.#store.applySnapshot(dbState.state, dbState.revision);
        this.#connectionManager.updateRevision(dbState.revision);
        return true;
      }
      return false;
    } catch (e) {
      handleError(e, { label: 'fetchStateFromDB', logger: facadeLog, alertTitle: false });
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
