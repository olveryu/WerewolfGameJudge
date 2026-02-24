/**
 * playerContext - 从游戏状态构建玩家视角的 AI 上下文
 *
 * 纯函数，无副作用。将 GameState 映射为 GameContext，
 * 只包含该玩家应当知道的信息（不作弊）。
 * 读取 gameState 与 ROLE_SPECS。不修改 state，不调用 service。
 */

import { ROLE_SPECS } from '@werewolf/game-engine/models/roles';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import type { GameContext } from '@/services/feature/AIChatService';

/**
 * 从游戏状态构建玩家视角的上下文（不包含作弊信息）
 */
export function buildPlayerContext(state: GameState | null, mySeat: number | null): GameContext {
  if (!state) {
    return { inRoom: false };
  }

  const context: GameContext = {
    inRoom: true,
    roomCode: state.roomCode,
    status: state.status,
    totalPlayers: Object.values(state.players).filter(Boolean).length,
  };

  // 板子配置（公开信息）
  if (state.templateRoles && state.templateRoles.length > 0) {
    context.boardRoleDetails = state.templateRoles.map((roleId) => {
      const roleSpec = ROLE_SPECS[roleId];
      return {
        name: roleSpec?.displayName || roleId,
        description: roleSpec?.description || '无描述',
      };
    });
  }

  // 我的座位和角色
  if (mySeat !== null && mySeat !== undefined) {
    context.mySeat = mySeat;
    const player = state.players[mySeat];
    if (player?.role) {
      context.myRole = player.role;
      const roleSpec = ROLE_SPECS[player.role];
      context.myRoleName = roleSpec?.displayName || player.role;
    }
  }

  return context;
}
