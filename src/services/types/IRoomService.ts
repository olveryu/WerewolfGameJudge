/**
 * IRoomService - 房间记录 + 游戏状态持久化接口
 *
 * 定义房间 CRUD 和 game_state 读写的公共 API 契约。
 * Supabase 和 Cloudflare (D1) 实现均需满足此接口。
 * 不校验游戏逻辑，不涉及 realtime 传输。
 */

import type { GameState } from '@werewolf/game-engine/protocol/types';

/** 房间记录（面向消费者的抽象） */
export interface RoomRecord {
  roomNumber: string;
  hostUid: string;
  createdAt: Date;
}

export interface IRoomService {
  /**
   * 创建房间（乐观插入 + 冲突重试）。
   * @param hostUid - Host 用户 ID
   * @param initialRoomNumber - 尝试的初始房间号
   * @param maxRetries - 冲突重试上限（默认 5）
   * @param buildInitialState - 可选的初始 state 构建器
   */
  createRoom(
    hostUid: string,
    initialRoomNumber?: string,
    maxRetries?: number,
    buildInitialState?: (roomCode: string) => GameState,
  ): Promise<RoomRecord>;

  /** 查询房间记录，不存在返回 null */
  getRoom(roomNumber: string): Promise<RoomRecord | null>;

  /** 检查房间是否存在 */
  roomExists(roomNumber: string): Promise<boolean>;

  /** 删除房间 */
  deleteRoom(roomNumber: string): Promise<void>;

  /**
   * 持久化 game_state snapshot（供断线恢复）。
   * Fire-and-forget 语义：失败只 warn，不阻塞游戏。
   */
  upsertGameState(roomCode: string, state: GameState, revision: number): Promise<void>;

  /** 读取 state_revision（轻量级轮询） */
  getStateRevision(roomCode: string): Promise<number | null>;

  /** 读取完整 game_state + revision */
  getGameState(roomCode: string): Promise<{ state: GameState; revision: number } | null>;
}
