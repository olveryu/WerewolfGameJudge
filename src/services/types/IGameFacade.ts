/**
 * IGameFacade - UI Facade 接口
 *
 * Phase 0 只包含房间生命周期和座位操作。
 * Facade 只做编排，不写业务逻辑。
 */

import type { BroadcastGameState } from '../protocol/types';
import type { GameTemplate } from '../../models/Template';

export type StateListener = (state: BroadcastGameState | null) => void;

export interface IGameFacade {
  // === Lifecycle ===
  /**
   * 订阅状态变化
   * @returns 取消订阅函数
   */
  addListener(fn: StateListener): () => void;

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
}
