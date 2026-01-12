/**
 * RoomScreen.helpers.ts - Pure functions for RoomScreen
 *
 * These are pure utility functions with no side effects.
 * They only depend on types and the roles registry.
 *
 * ❌ Do NOT import: GameStateService, BroadcastService, Supabase, navigation, React
 * ✅ Allowed imports: types, roles registry (getRoleModel, isWolfRole)
 */

import type { RoleName } from '../../models/roles';
import { getRoleModel, isWolfRole } from '../../models/roles';
import type { LocalGameState } from '../../services/types/GameStateTypes';
import type { GameRoomLike } from '../../models/Room';

// =============================================================================
// Types
// =============================================================================

export interface ActionerState {
  imActioner: boolean;
  showWolves: boolean;
}

// Re-export GameRoomLike for convenience
export type { GameRoomLike } from '../../models/Room';

export interface PlayerInfoLike {
  uid: string;
  seatNumber: number;
  displayName: string;
  avatarUrl?: string;
  role: RoleName | null;
  hasViewedRole: boolean;
}

export interface RoleStats {
  roleCounts: Record<string, number>;
  wolfRoles: string[];
  godRoles: string[];
  specialRoles: string[];
  villagerCount: number;
}

export interface SeatViewModel {
  index: number;
  role: RoleName;
  player: {
    uid: string;
    displayName: string;
    avatarUrl?: string;
  } | null;
  isMySpot: boolean;
  isWolf: boolean;
  isSelected: boolean;
}

// =============================================================================
// Pure Functions
// =============================================================================

/**
 * Determine if the current player is the actioner and whether to show wolves
 *
 * @param myRole - Current player's role
 * @param currentActionRole - The role that should act now
 * @param mySeatNumber - Current player's seat number
 * @param wolfVotes - Map of wolf votes (seat -> target)
 * @param isHost - Whether current player is host (unused but kept for future)
 */
export function determineActionerState(
  myRole: RoleName | null,
  currentActionRole: RoleName | null,
  mySeatNumber: number | null,
  wolfVotes: Map<number, number>,
  _isHost: boolean
): ActionerState {
  if (!currentActionRole) {
    return { imActioner: false, showWolves: false };
  }

  // My role matches current action
  if (myRole === currentActionRole) {
    return handleMatchingRole(myRole, mySeatNumber, wolfVotes);
  }

  // Wolf team members during wolf turn
  if (currentActionRole === 'wolf' && myRole && isWolfRole(myRole)) {
    return handleWolfTeamTurn(mySeatNumber, wolfVotes);
  }

  return { imActioner: false, showWolves: false };
}

function handleMatchingRole(
  myRole: RoleName,
  mySeatNumber: number | null,
  wolfVotes: Map<number, number>
): ActionerState {
  // For wolves, check if already voted
  if (myRole === 'wolf' && mySeatNumber !== null && wolfVotes.has(mySeatNumber)) {
    return { imActioner: false, showWolves: true };
  }

  // Show wolves to wolf team (except nightmare, gargoyle, wolfRobot)
  const showWolves =
    isWolfRole(myRole) &&
    myRole !== 'nightmare' &&
    myRole !== 'gargoyle' &&
    myRole !== 'wolfRobot';

  return { imActioner: true, showWolves };
}

function handleWolfTeamTurn(
  mySeatNumber: number | null,
  wolfVotes: Map<number, number>
): ActionerState {
  // Check if this wolf has already voted
  const hasVoted = mySeatNumber !== null && wolfVotes.has(mySeatNumber);
  return { imActioner: !hasVoted, showWolves: true };
}

/**
 * Convert LocalGameState to GameRoomLike for Room.ts helper functions
 * The types are compatible - LocalPlayer matches GameRoomLike's player type
 */
export function toGameRoomLike(gameState: LocalGameState): GameRoomLike {
  // LocalGameState.players is compatible with GameRoomLike.players
  // (LocalPlayer has all required fields)
  return gameState as unknown as GameRoomLike;
}

/**
 * Calculate role statistics for display
 */
export function getRoleStats(roles: RoleName[]): RoleStats {
  const roleCounts: Record<string, number> = {};
  const wolfRolesList: string[] = [];
  const godRolesList: string[] = [];
  const specialRolesList: string[] = [];
  let villagerCount = 0;

  roles.forEach((role) => {
    const roleModel = getRoleModel(role);
    if (!roleModel) return;

    if (roleModel.faction === 'wolf') {
      roleCounts[roleModel.displayName] = (roleCounts[roleModel.displayName] || 0) + 1;
      if (!wolfRolesList.includes(roleModel.displayName)) {
        wolfRolesList.push(roleModel.displayName);
      }
    } else if (roleModel.faction === 'god') {
      roleCounts[roleModel.displayName] = (roleCounts[roleModel.displayName] || 0) + 1;
      if (!godRolesList.includes(roleModel.displayName)) {
        godRolesList.push(roleModel.displayName);
      }
    } else if (roleModel.faction === 'special') {
      roleCounts[roleModel.displayName] = (roleCounts[roleModel.displayName] || 0) + 1;
      if (!specialRolesList.includes(roleModel.displayName)) {
        specialRolesList.push(roleModel.displayName);
      }
    } else if (role === 'villager') {
      villagerCount++;
    }
  });

  return {
    roleCounts,
    wolfRoles: wolfRolesList,
    godRoles: godRolesList,
    specialRoles: specialRolesList,
    villagerCount,
  };
}

/**
 * Format role list for display
 */
export function formatRoleList(roles: string[], counts: Record<string, number>): string {
  if (roles.length === 0) return '无';
  return roles
    .map((r) => {
      const count = counts[r];
      return count > 1 ? `${r}×${count}` : r;
    })
    .join('、');
}

/**
 * Build SeatViewModel array from game state
 */
export function buildSeatViewModels(
  gameState: LocalGameState,
  mySeatNumber: number | null,
  showWolves: boolean,
  selectedIndex: number | null
): SeatViewModel[] {
  return gameState.template.roles.map((role, index) => {
    const player = gameState.players.get(index);
    const isWolf =
      showWolves &&
      isWolfRole(role) &&
      role !== 'wolfRobot' &&
      role !== 'gargoyle';

    return {
      index,
      role,
      player: player
        ? {
            uid: player.uid,
            displayName: player.displayName || '玩家',
            avatarUrl: player.avatarUrl,
          }
        : null,
      isMySpot: mySeatNumber === index,
      isWolf,
      isSelected: selectedIndex === index,
    };
  });
}
