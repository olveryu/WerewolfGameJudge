/**
 * IGameFacade - UI Facade 接口
 *
 * v2 facade 统一接口，覆盖房间生命周期、座位、游戏控制和夜晚行动。
 * Facade 只做编排，不写业务逻辑。
 */

import type { BroadcastGameState } from '../protocol/types';
import type { GameTemplate } from '../../models/Template';
import type { RoleId } from '../../models/roles';

export type StateListener = (state: BroadcastGameState | null) => void;

export interface IGameFacade {
  // === Lifecycle ===
  /**
   * 订阅状态变化
   * @returns 取消订阅函数
   */
  addListener(fn: StateListener): () => void;

  /**
   * 获取当前状态（一次性读取）
   */
  getState(): BroadcastGameState | null;

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
   * Host: 创建房间
   */
  initializeAsHost(roomCode: string, hostUid: string, template: GameTemplate): Promise<void>;

  /**
   * Player: 加入房间
   */
  joinAsPlayer(
    roomCode: string,
    playerUid: string,
    displayName?: string,
    avatarUrl?: string,
  ): Promise<void>;

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
   * 开始夜晚
   */
  startNight(): Promise<{ success: boolean; reason?: string }>;

  /**
   * 重新开始游戏
   */
  restartGame(): Promise<{ success: boolean; reason?: string }>;

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
  submitRevealAck(
    role: 'seer' | 'psychic' | 'gargoyle' | 'wolfRobot',
  ): Promise<{ success: boolean; reason?: string }>;

  // === Night Flow (Host-only) ===
  /**
   * 推进夜晚到下一步
   */
  advanceNight(): Promise<{ success: boolean; reason?: string }>;

  /**
   * 结束夜晚
   */
  endNight(): Promise<{ success: boolean; reason?: string }>;

  /**
   * 设置音频播放状态
   */
  setAudioPlaying(isPlaying: boolean): Promise<{ success: boolean; reason?: string }>;

  // === Sync ===
  /**
   * 请求状态快照（Player）
   */
  requestSnapshot(): Promise<boolean>;
}
