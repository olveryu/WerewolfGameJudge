/**
 * RoomScreen.helpers.ts - Pure functions for RoomScreen
 *
 * These are pure utility functions with no side effects.
 * They only depend on types and the roles registry.
 *
 * ❌ Do NOT import: services, Supabase, navigation, React
 * ✅ Allowed imports: types, roles registry (getRoleSpec, isWolfRole)
 */

import type { RoleId } from '@/models/roles';
import {
  canRoleSeeWolves,
  doesRoleParticipateInWolfVote,
  getRoleSpec,
  isWolfRole,
} from '@/models/roles';
import type { LocalGameState } from '@/services/types/GameStateTypes';
import type { GameRoomLike } from '@/models/Room';
import type { RoleAction } from '@/models/actions/RoleAction';
import type { ActionSchema, TargetConstraint } from '@/models/roles/spec';

// =============================================================================
// Types
// =============================================================================

export interface ActionerState {
  imActioner: boolean;
  showWolves: boolean;
}

// Re-export GameRoomLike for convenience
export type { GameRoomLike } from '@/models/Room';

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
    isBot?: boolean;
    role?: RoleId | null; // For bot role display (debug mode)
  } | null;
  isMySpot: boolean;
  isWolf: boolean;
  isSelected: boolean;
  /** UX-only: if set, the seat is non-selectable for the current UI context (Host still validates). */
  disabledReason?: string;
  /** Show ✅ badge on seat tile (e.g. player has viewed role during assigned phase). */
  showReadyBadge?: boolean;
}

// =============================================================================
// Pure Functions
// =============================================================================

/**
 * Determine if the current player is the actioner and whether to show wolves
 *
 * Schema-driven logic:
 * - showWolves = true only when:
 *   1. schema.kind === 'wolfVote' AND schema.meeting.canSeeEachOther === true
 *   2. actorRole is a wolf that participates in wolf vote
 *
 * @param actorRole - Actor's role (actorRoleForUi — may be bot's role when Host is delegating)
 * @param currentActionRole - The role that should act now
 * @param currentSchema - Current action schema (schema-driven UI)
 * @param actorSeatNumber - Actor's seat number (actorSeatForUi — may be bot's seat when delegating)
 * @param wolfVotes - Map of wolf votes (seat -> target)
 * @param isHost - Whether current player is host (unused but kept for future)
 * @param actions - Map of already submitted role actions
 */
export function determineActionerState(
  actorRole: RoleId | null,
  currentActionRole: RoleId | null,
  currentSchema: ActionSchema | null,
  actorSeatNumber: number | null,
  wolfVotes: Map<number, number>,
  _isHost: boolean,
  actions: Map<RoleId, RoleAction> = new Map(),
): ActionerState {
  if (!currentActionRole) {
    return { imActioner: false, showWolves: false };
  }

  // Schema-driven: determine if this is a wolf meeting phase
  const isWolfMeetingSchema =
    currentSchema?.kind === 'wolfVote' && currentSchema.meeting?.canSeeEachOther === true;

  // My role matches current action
  if (actorRole === currentActionRole) {
    return handleMatchingRole(actorRole, actorSeatNumber, wolfVotes, actions, isWolfMeetingSchema);
  }

  // Wolf meeting phase: participating wolves can see pack list and act
  if (isWolfMeetingSchema && actorRole && isWolfRole(actorRole)) {
    if (!doesRoleParticipateInWolfVote(actorRole)) {
      // Non-voting wolves (e.g., wolfRobot) cannot see the pack
      return { imActioner: false, showWolves: false };
    }
    return handleWolfTeamTurn(actorSeatNumber, wolfVotes);
  }

  return { imActioner: false, showWolves: false };
}

function handleMatchingRole(
  actorRole: RoleId,
  actorSeatNumber: number | null,
  wolfVotes: Map<number, number>,
  actions: Map<RoleId, RoleAction>,
  isWolfMeetingSchema: boolean,
): ActionerState {
  // Wolf meeting phase: action eligibility is vote-based for ALL voting wolves.
  // (Not just role === 'wolf' — special wolf roles like nightmare/wolfQueen also vote.)
  if (
    isWolfMeetingSchema &&
    doesRoleParticipateInWolfVote(actorRole) &&
    actorSeatNumber !== null &&
    wolfVotes.has(actorSeatNumber)
  ) {
    return { imActioner: false, showWolves: true };
  }

  // For non-wolf roles, check if action already submitted
  // (Skip wolf roles as they use wolfVotes for vote tracking)
  if (!isWolfRole(actorRole) && actions.has(actorRole)) {
    return { imActioner: false, showWolves: false };
  }

  // Schema-driven: show wolves only during wolf meeting with canSeeEachOther
  const showWolves =
    isWolfMeetingSchema && isWolfRole(actorRole) && doesRoleParticipateInWolfVote(actorRole);

  return { imActioner: true, showWolves };
}

function handleWolfTeamTurn(
  actorSeatNumber: number | null,
  wolfVotes: Map<number, number>,
): ActionerState {
  // Check if this wolf has already voted
  const hasVoted = actorSeatNumber !== null && wolfVotes.has(actorSeatNumber);
  return { imActioner: !hasVoted, showWolves: true };
}

/**
 * Convert LocalGameState to GameRoomLike for Room.ts helper functions
 * The types are compatible - LocalPlayer matches GameRoomLike's player type
 */
export function toGameRoomLike(gameState: LocalGameState): GameRoomLike {
  const wolfVotes: Map<number, number> = (() => {
    const raw =
      gameState.currentNightResults?.wolfVotesBySeat ??
      // legacy fallback
      ((gameState as any).wolfVotes as Map<number, number> | undefined);
    if (!raw) return new Map();
    if (raw instanceof Map) return raw;
    const map = new Map<number, number>();
    for (const [k, v] of Object.entries(raw as Record<string, number>)) {
      map.set(Number.parseInt(k, 10), v);
    }
    return map;
  })();

  // Adapter object (avoid unsafe assertions like `as unknown as`).
  // Treat this as a view over LocalGameState for model-layer helpers that expect GameRoomLike.
  return {
    template: gameState.template,
    players: gameState.players,
    actions: gameState.actions,
    wolfVotes,
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
 *
 * @param actorSeatNumber - Actor's seat (actorSeatForUi). Used for isMySpot + notSelf constraint.
 */
export function buildSeatViewModels(
  gameState: LocalGameState,
  actorSeatNumber: number | null,
  showWolves: boolean,
  selectedIndex: number | null,
  options?: {
    /**
     * Schema constraints for current action (e.g. ['notSelf']).
     * UX-only early rejection - Host still validates.
     */
    schemaConstraints?: readonly TargetConstraint[];
    /**
     * Second selected index for swap schema (magician).
     * Used to highlight the second seat being selected before confirmation.
     */
    secondSelectedIndex?: number | null;
    /**
     * Show ✅ ready badge on seats where player has viewed their role.
     * Typically true during 'assigned' phase.
     */
    showReadyBadges?: boolean;
  },
): SeatViewModel[] {
  return gameState.template.roles.map((role, index) => {
    const player = gameState.players.get(index);
    const effectiveRole = player?.role ?? role;
    // Wolf visibility is controlled by ActionerState.showWolves.
    // When true, only wolf-faction roles with canSeeWolves=true are highlighted.
    // Roles like gargoyle/wolfRobot (canSeeWolves=false) are hidden from wolf pack view.
    const isWolf = showWolves && isWolfRole(effectiveRole) && canRoleSeeWolves(effectiveRole);

    // UX-only early rejection based on schema constraints.
    // IMPORTANT: Host remains the authority. This is just early UI guidance.
    let disabledReason: string | undefined;

    // Constraint: notSelf - cannot select own seat
    if (options?.schemaConstraints?.includes('notSelf') && index === actorSeatNumber) {
      disabledReason = '不能选择自己';
    }

    return {
      index,
      role,
      player: player
        ? {
            uid: player.uid,
            displayName: player.displayName || '玩家',
            avatarUrl: player.avatarUrl,
            isBot: player.isBot,
            role: player.role, // For bot role display (debug mode)
          }
        : null,
      isMySpot: actorSeatNumber === index,
      isWolf,
      isSelected: selectedIndex === index || options?.secondSelectedIndex === index,
      disabledReason,
      showReadyBadge: options?.showReadyBadges && player != null && (player.hasViewedRole ?? false),
    };
  });
}
