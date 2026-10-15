/**
 * playerContext - build the player-perspective AI context from game state
 *
 * Pure function, no side effects. Maps GameState to GameContext,
 * containing only information the player should know (no cheating).
 * Reads gameState and ROLE_SPECS. Does not modify state or call services.
 */

import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import type { WerewolfViewModel } from '@game-judge/game-engine/games/werewolf/public';
import { ROLE_SPECS } from '@game-judge/game-engine/games/werewolf/public';

import type { GameContext } from '@/games/werewolf/services/AIChatService';

/**
 * Build the player-perspective context from game state (no cheating info).
 * Own seat/role come from the AU-39 view model (the viewer's own
 * projection); room-level public facts still read the state directly.
 */
export function buildPlayerContext(
  state: GameState | null,
  viewModel: WerewolfViewModel | null,
): GameContext {
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

  // My seat and role (from the view model: the viewer's own identity only)
  if (viewModel !== null && viewModel.mySeat !== null) {
    context.mySeat = viewModel.mySeat;
    if (viewModel.myRole) {
      context.myRole = viewModel.myRole;
      const roleSpec = ROLE_SPECS[viewModel.myRole];
      context.myRoleName = roleSpec?.displayName || viewModel.myRole;
    }
  }

  return context;
}
