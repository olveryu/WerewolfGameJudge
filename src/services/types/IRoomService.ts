/**
 * IRoomService - 房间记录 + 游戏状态持久化接口
 *
 * 定义房间 CRUD 和 game_state 读写的公共 API 契约。
 * 不校验游戏逻辑，不涉及 realtime 传输。
 */

import type { GameState } from '@werewolf/game-engine/protocol/types';

/** 房间记录（面向消费者的抽象） */
export interface RoomRecord {
  roomCode: string;
  hostUserId: string;
  createdAt: Date;
}

export interface IRoomService {
  /**
   * 创建房间（乐观插入 + 冲突重试）。
   * @param hostUserId - Host 用户 ID
   * @param initialRoomNumber - 尝试的初始房间号
   * @param maxRetries - 冲突重试上限（默认 5）
   * @param buildInitialState - 可选的初始 state 构建器
   */
  createRoom(
    hostUserId: string,
    initialRoomNumber?: string,
    maxRetries?: number,
    buildInitialState?: (roomCode: string) => GameState,
  ): Promise<RoomRecord>;

  /** 查询房间记录，不存在返回 null */
  getRoom(roomCode: string): Promise<RoomRecord | null>;

  /** 检查房间是否存在 */
  roomExists(roomCode: string): Promise<boolean>;

  /** 删除房间 */
  deleteRoom(roomCode: string): Promise<void>;

  /** 读取 state_revision（轻量级轮询） */
  getStateRevision(roomCode: string): Promise<number | null>;

  /** 读取完整 game_state + revision */
  getGameState(roomCode: string): Promise<{ state: GameState; revision: number } | null>;
}
