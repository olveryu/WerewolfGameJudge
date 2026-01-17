/**
 * RoomScreen.helpers.ts - Pure functions for RoomScreen
 *
 * These are pure utility functions with no side effects.
 * They only depend on types and the roles registry.
 *
 * ❌ Do NOT import: GameStateService, BroadcastService, Supabase, navigation, React
 * ✅ Allowed imports: types, roles registry (getRoleSpec, isWolfRole)
 */

import type { RoleId } from '../../models/roles';
import { canRoleSeeWolves, doesRoleParticipateInWolfVote, isWolfRole, getRoleSpec, isValidRoleId } from '../../models/roles';
import type { LocalGameState } from '../../services/types/GameStateTypes';
import type { GameRoomLike } from '../../models/Room';
import type { RoleAction } from '../../models/actions/RoleAction';
import { WOLF_MEETING_VOTE_CONFIG } from '../../models/roles/spec/wolfMeetingVoteConfig';

// =============================================================================
// Types
// =============================================================================

export interface ActionerState {
  imActioner: boolean;
  showWolves: boolean;
}

export interface StepVisibilityLike {
  /**
   * Whether this step is a "solo" action where even wolves shouldn't see the pack list.
  * NOTE: When present, this is the single source of truth.
   */
  actsSolo?: boolean;
  /** True when the night flow is in a wolf-meeting phase where pack list can be shown. */
  wolfMeetingPhase?: boolean;
}

// Re-export GameRoomLike for convenience
export type { GameRoomLike } from '../../models/Room';

export interface PlayerInfoLike {
  uid: string;
  seatNumber: number;
  displayName: string;
  avatarUrl?: string;
  role: RoleId | null;
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
  role: RoleId;
  player: {
    uid: string;
    displayName: string;
    avatarUrl?: string;
  } | null;
  isMySpot: boolean;
  isWolf: boolean;
  isSelected: boolean;
  /** UX-only: if set, the seat is non-selectable for the current UI context (Host still validates). */
  disabledReason?: string;
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
 * @param actions - Map of already submitted role actions
 */
export function determineActionerState(
  myRole: RoleId | null,
  currentActionRole: RoleId | null,
  mySeatNumber: number | null,
  wolfVotes: Map<number, number>,
  _isHost: boolean,
  actions: Map<RoleId, RoleAction> = new Map(),
  visibility?: StepVisibilityLike
): ActionerState {
  if (!currentActionRole) {
    return { imActioner: false, showWolves: false };
  }

  // Step visibility is the single source of truth.
  // When actsSolo=true, the actioner cannot see wolves (anti-cheat).
  if (myRole === currentActionRole && visibility?.actsSolo === true) {
    // Still an actioner (unless already acted), but never show wolves.
    const state = handleMatchingRole(myRole, mySeatNumber, wolfVotes, actions, visibility);
    return { ...state, showWolves: false };
  }

  // My role matches current action
  if (myRole === currentActionRole) {
  return handleMatchingRole(myRole, mySeatNumber, wolfVotes, actions, visibility);
  }

  // Wolf meeting phase: participating wolves can see pack list.
  // NOTE: visibility.wolfMeetingPhase is the single source of truth for when the pack list is shown.
  if (visibility?.wolfMeetingPhase === true && myRole && isWolfRole(myRole)) {
    if (!doesRoleParticipateInWolfVote(myRole)) {
      return { imActioner: false, showWolves: false };
    }
    return handleWolfTeamTurn(mySeatNumber, wolfVotes);
  }

  return { imActioner: false, showWolves: false };
}

function handleMatchingRole(
  myRole: RoleId,
  mySeatNumber: number | null,
  wolfVotes: Map<number, number>,
  actions: Map<RoleId, RoleAction>,
  visibility?: StepVisibilityLike
): ActionerState {
  // For wolves, check if already voted
  if (myRole === 'wolf' && mySeatNumber !== null && wolfVotes.has(mySeatNumber)) {
    return { imActioner: false, showWolves: true };
  }

  // For non-wolf roles, check if action already submitted
  // (Skip wolf roles as they use wolfVotes for vote tracking)
  if (!isWolfRole(myRole) && actions.has(myRole)) {
    return { imActioner: false, showWolves: false };
  }

  // PR4: Prefer step visibility for wolf pack display.
  // - actsSolo=true   => never show wolves
  // - actsSolo=false  => show wolves for meeting wolves (participate in vote)
  // - actsSolo=undef  => conservative default (anti-cheat): do not show wolves
  let showWolves: boolean;
  if (visibility?.actsSolo === true) {
    showWolves = false;
  } else if (visibility?.actsSolo === false) {
    showWolves = isWolfRole(myRole) && doesRoleParticipateInWolfVote(myRole);
  } else {
    showWolves = false;
  }

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
  // Adapter object (avoid unsafe assertions like `as unknown as`).
  // Treat this as a view over LocalGameState for model-layer helpers that expect GameRoomLike.
  return {
    template: gameState.template,
    players: gameState.players,
    actions: gameState.actions,
    wolfVotes: gameState.wolfVotes,
    currentActionerIndex: gameState.currentActionerIndex,
  };
}

/**
 * Calculate role statistics for display
 */
export function getRoleStats(roles: RoleId[]): RoleStats {
  const roleCounts: Record<string, number> = {};
  const wolfRolesList: string[] = [];
  const godRolesList: string[] = [];
  const specialRolesList: string[] = [];
  let villagerCount = 0;

  roles.forEach((role) => {
    const spec = getRoleSpec(role);
    if (!spec) return;

    if (spec.faction === 'wolf') {
      roleCounts[spec.displayName] = (roleCounts[spec.displayName] || 0) + 1;
      if (!wolfRolesList.includes(spec.displayName)) {
        wolfRolesList.push(spec.displayName);
      }
    } else if (spec.faction === 'god') {
      roleCounts[spec.displayName] = (roleCounts[spec.displayName] || 0) + 1;
      if (!godRolesList.includes(spec.displayName)) {
        godRolesList.push(spec.displayName);
      }
    } else if (spec.faction === 'special') {
      roleCounts[spec.displayName] = (roleCounts[spec.displayName] || 0) + 1;
      if (!specialRolesList.includes(spec.displayName)) {
        specialRolesList.push(spec.displayName);
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
  selectedIndex: number | null,
  options?: {
    /** When true, apply wolf meeting vote UX restrictions (Host still validates). */
    enableWolfVoteRestrictions?: boolean;
  }
): SeatViewModel[] {
  return gameState.template.roles.map((role, index) => {
    const player = gameState.players.get(index);
    const effectiveRole = player?.role ?? role;
    // Wolf visibility is controlled by ActionerState.showWolves.
    // When true, ALL wolf-faction roles should be highlighted consistently.
    // (Whether a wolf participates in meeting/vote is a separate rule.)
    const isWolf = showWolves && isWolfRole(effectiveRole);

    // Commit 5 (UX-only): disable forbidden wolf meeting vote target roles.
    // IMPORTANT: Host remains the authority. This is just early UI guidance.
    let disabledReason: string | undefined;
    if (options?.enableWolfVoteRestrictions) {
      const forbidden: readonly RoleId[] = WOLF_MEETING_VOTE_CONFIG.forbiddenTargetRoleIds;
      // Use the same "effective role" used elsewhere in this function.
      // In tests and early game screens, player.role is often filled even if the UI wouldn't
      // normally know it; in other contexts it may still be null and we should fall back.
      const targetRole = effectiveRole;
      if (isValidRoleId(targetRole) && forbidden.includes(targetRole)) {
        const spec = getRoleSpec(targetRole);
        const name = spec?.displayName ?? targetRole;
        disabledReason = `不能投${name}`;
      }
    }

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
  disabledReason,
    };
  });
}
