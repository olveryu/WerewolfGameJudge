/**
 * IRealtimeService - Realtime 传输服务接口
 *
 * 定义房间实时通道的公共 API 契约（subscribe / unsubscribe / 连接状态）。
 * Supabase (postgres_changes) 和 Cloudflare (Durable Objects WebSocket) 实现均需满足此接口。
 * 不包含游戏逻辑，不持久化游戏状态。
 */

import type { GameState } from '@werewolf/game-engine/protocol/types';

import type { ConnectionStatus } from '@/services/types/IGameFacade';

/** 连接状态变更监听器 */
export type ConnectionStatusListener = (status: ConnectionStatus) => void;

export interface IRealtimeService {
  /**
   * 订阅连接状态变化。立即通知当前状态。
   * @returns 取消订阅函数
   */
  addStatusListener(listener: ConnectionStatusListener): () => void;

  /**
   * 加入房间的实时通道。
   * 若已在其他房间则自动 leaveRoom。
   */
  joinRoom(
    roomCode: string,
    userId: string,
    callbacks: {
      /** DB state 变更回调 */
      onDbStateChange?: (state: GameState, revision: number) => void;
    },
  ): Promise<void>;

  /**
   * 标记连接为 Live（收到第一条 state 后调用）。
   * 仅 Syncing → Live 有效，Connecting 状态不接受。
   */
  markAsLive(): void;

  /**
   * 死通道恢复：销毁当前通道并重建。
   * 使用 joinRoom 时缓存的参数。
   */
  rejoinCurrentRoom(): Promise<void>;

  /** 离开当前房间（清理通道 + status → Disconnected） */
  leaveRoom(): Promise<void>;
}
