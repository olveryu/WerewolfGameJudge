/**
 * IGameFacade - UI Facade 接口
 *
 * facade 统一接口，覆盖房间生命周期、座位、游戏控制和夜晚行动。
 * Facade 只做编排，不写业务逻辑。
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type { GameState } from '@werewolf/game-engine/protocol/types';
import type { RoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';

/** Connection status for UI display (re-exported from RealtimeService) */
export enum ConnectionStatus {
  Connecting = 'Connecting',
  Syncing = 'Syncing',
  Live = 'Live',
  Disconnected = 'Disconnected',
}

export type FacadeStateListener = (state: GameState | null) => void;

export interface IGameFacade {
  // === Lifecycle ===
  /**
   * 订阅状态变化
   * @returns 取消订阅函数
   */
  addListener(fn: FacadeStateListener): () => void;

  /**
   * 获取当前状态（一次性读取）
   */
  getState(): GameState | null;

  // === Identity ===
  /** 当前用户是否是 Host */
  isHostPlayer(): boolean;

  /** 当前用户 UID */
  getMyUid(): string | null;

  /**
   * 当前用户座位号
   * 从 state 派生，不自己维护
   */
  getMySeatNumber(): number | null;

  /**
   * 状态版本号
   * 以 store 为单一真相
   */
  getStateRevision(): number;

  // === Room Lifecycle ===
  /**
   * Host: 创建新房间
   * 初始化 store + 加入 broadcast 频道
   */
  createRoom(roomCode: string, hostUid: string, template: GameTemplate): Promise<void>;

  /**
   * 加入已有房间（Host rejoin + Player join 统一入口）
   *
   * Host rejoin: isHost=true, 从 DB 恢复状态，检测 _wasAudioInterrupted
   * Player join: isHost=false, 从 DB 读取初始状态
   *
   * @returns success=false 仅在 Host rejoin 且无 DB 状态时
   */
  joinRoom(
    roomCode: string,
    uid: string,
    isHost: boolean,
  ): Promise<{ success: boolean; reason?: string }>;

  /**
   * 离开房间
   */
  leaveRoom(): Promise<void>;

  // === Seating ===
  /**
   * 入座
   * Host: 直接处理
   * Player: 发送请求，返回只表示"已发送"
   */
  takeSeat(seatNumber: number, displayName?: string, avatarUrl?: string): Promise<boolean>;

  /**
   * 入座（带 ACK 等待）
   * Host: 直接处理
   * Player: 发送请求并等待 Host ACK
   * @returns success + reason（透传 Host 拒绝原因）
   */
  takeSeatWithAck(
    seatNumber: number,
    displayName?: string,
    avatarUrl?: string,
  ): Promise<{ success: boolean; reason?: string }>;

  /**
   * 离座
   * Host: 直接处理
   * Player: 发送请求，返回只表示"已发送"
   */
  leaveSeat(): Promise<boolean>;

  /**
   * 离座（带 ACK 等待）
   * Host: 直接处理
   * Player: 发送请求并等待 Host ACK
   * @returns success + reason（透传 Host 拒绝原因）
   */
  leaveSeatWithAck(): Promise<{ success: boolean; reason?: string }>;

  // === Game Control (Host-only) ===
  /**
   * 分配角色
   */
  assignRoles(): Promise<{ success: boolean; reason?: string }>;

  /**
   * 更新模板（Host only，仅在 unseated 状态）
   */
  updateTemplate(template: GameTemplate): Promise<{ success: boolean; reason?: string }>;

  /**
   * 设置开牌动画（Host only）
   */
  setRoleRevealAnimation(
    animation: RoleRevealAnimation,
  ): Promise<{ success: boolean; reason?: string }>;

  /**
   * 开始夜晚
   */
  startNight(): Promise<{ success: boolean; reason?: string }>;

  /**
   * 重新开始游戏
   */
  restartGame(): Promise<{ success: boolean; reason?: string }>;

  // === Debug Mode ===
  /**
   * 填充机器人（Debug-only, Host-only）
   * 为所有空座位创建 bot player
   */
  fillWithBots(): Promise<{ success: boolean; reason?: string }>;

  /**
   * 标记所有机器人已查看角色（Debug-only, Host-only）
   */
  markAllBotsViewed(): Promise<{ success: boolean; reason?: string }>;

  /**
   * 全员起立（Host-only）
   * 清空所有座位，仅在 unseated/seated 状态可用
   */
  clearAllSeats(): Promise<{ success: boolean; reason?: string }>;

  /**
   * 分享「详细信息」给指定座位（Host-only, ended 阶段）
   */
  shareNightReview(allowedSeats: number[]): Promise<{ success: boolean; reason?: string }>;

  // === Player Actions ===
  /**
   * 玩家确认已查看角色
   */
  markViewedRole(seat: number): Promise<{ success: boolean; reason?: string }>;

  /**
   * 提交夜晚行动
   */
  submitAction(
    seat: number,
    role: RoleId,
    target: number | null,
    extra?: unknown,
  ): Promise<{ success: boolean; reason?: string }>;

  /**
   * 提交狼人投票
   */
  submitWolfVote(
    voterSeat: number,
    targetSeat: number,
  ): Promise<{ success: boolean; reason?: string }>;

  /**
   * 提交 reveal 确认（seer/psychic/gargoyle/wolfRobot）
   */
  submitRevealAck(): Promise<{ success: boolean; reason?: string }>;

  /**
   * 提交机械狼查看猎人状态确认
   * @param seat - wolfRobot 的座位号（必须由调用方传入 effectiveSeat，以支持 debug bot 接管）
   */
  sendWolfRobotHunterStatusViewed(seat: number): Promise<{ success: boolean; reason?: string }>;

  // === Night Flow (Host-only) ===
  /**
   * 结束夜晚
   */
  endNight(): Promise<{ success: boolean; reason?: string }>;

  /**
   * 设置音频播放状态
   */
  setAudioPlaying(isPlaying: boolean): Promise<{ success: boolean; reason?: string }>;

  /**
   * Host: wolf vote deadline 到期后触发服务端推进
   */
  postProgression(): Promise<{ success: boolean; reason?: string }>;

  // === Sync ===
  /**
   * 从 DB 直接读取最新状态（auto-heal / reconnect fallback）
   * 服务端权威 — 直接 SELECT from rooms，不经过 broadcast 通道
   * Host 和 Player 统一使用
   */
  fetchStateFromDB(): Promise<boolean>;

  /**
   * Host rejoin 后是否有音频被中断
   */
  readonly wasAudioInterrupted: boolean;

  /**
   * Host rejoin + 用户点击"继续游戏"后调用。
   * 在 user gesture 上下文中启动 BGM + 重播当前步骤音频（如果需要）。
   */
  resumeAfterRejoin(): Promise<void>;

  // === Connection ===
  /**
   * 订阅连接状态变化
   * 委托 RealtimeService.addStatusListener，避免 UI 层直接依赖 RealtimeService
   * @returns 取消订阅函数
   */
  addConnectionStatusListener(fn: (status: ConnectionStatus) => void): () => void;
}
