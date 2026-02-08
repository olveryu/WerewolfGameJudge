/**
 * Room - 房间/游戏状态数据模型
 *
 * 定义 GameRoomLike 核心接口和纯函数查询。
 *
 * ✅ 允许：类型定义、纯函数查询/计算
 * ❌ 禁止：import service / 副作用 / IO
 */
import { GameTemplate } from './Template';
import { RoleId, doesRoleParticipateInWolfVote } from './roles';
import type { RoleAction } from './actions';

// Re-export GameStatus for consumers who import from Room
export { GameStatus } from './GameStatus';

// =============================================================================
// Common interface for Room-like objects (supports both Room and LocalGameState)
// =============================================================================
export interface GameRoomLike {
  template: GameTemplate;
  players: Map<
    number,
    {
      uid: string;
      seatNumber: number;
      role: RoleId | null;
      hasViewedRole: boolean;
      displayName?: string;
      avatarUrl?: string | null;
    } | null
  >;
  actions: Map<RoleId, RoleAction>;
  wolfVotes: Map<number, number>;
  currentStepIndex: number;
}

// Get wolf vote summary for display
export const getWolfVoteSummary = (room: GameRoomLike): string => {
  const wolfSeats: number[] = [];
  room.players.forEach((player, seat) => {
    if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
      wolfSeats.push(seat);
    }
  });
  wolfSeats.sort((a, b) => a - b);

  const voted = wolfSeats.filter((seat) => room.wolfVotes.has(seat));
  return `${voted.length}/${wolfSeats.length} 狼人已投票`;
};
