/**
 * playerContext - build the player-perspective AI context from game state
 *
 * Pure function, no side effects. Maps GameState to GameContext,
 * containing only information the player should know (no cheating).
 * Reads gameState and ROLE_SPECS. Does not modify state or call services.
 */

import { ROLE_SPECS } from '@werewolf/game-engine/models/roles';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import type { GameContext } from '@/services/feature/AIChatService';

/**
 * Build the player-perspective context from game state (no cheating info)
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

  // Role configuration (public info)
  if (state.templateRoles && state.templateRoles.length > 0) {
    context.boardRoleDetails = state.templateRoles.map((roleId) => {
      const roleSpec = ROLE_SPECS[roleId];
      return {
        name: roleSpec?.displayName || roleId,
        description: roleSpec?.description || '无描述',
      };
    });
  }

  // My seat and role
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
