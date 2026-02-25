/**
 * RoomScreen.helpers.ts - Pure functions for RoomScreen
 *
 * These are pure utility functions with no side effects.
 * They only depend on types and the roles registry (getRoleSpec, isWolfRole).
 * Does not import services, Supabase, navigation, or React.
 */

import type { RoleAction } from '@werewolf/game-engine/models/actions/RoleAction';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import {
  canRoleSeeWolves,
  doesRoleParticipateInWolfVote,
  getRoleSpec,
  isWolfRole,
} from '@werewolf/game-engine/models/roles';
import { type ActionSchema, TargetConstraint } from '@werewolf/game-engine/models/roles/spec';
import { Faction } from '@werewolf/game-engine/models/roles/spec/types';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';

import type { LocalGameState } from '@/types/GameStateTypes';

// =============================================================================
// Types
// =============================================================================

/**
 * Common interface for Room-like objects (supports both Room and LocalGameState).
 * Used by getWolfVoteSummary and toGameRoomLike.
 */
interface GameRoomLike {
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

export interface ActionerState {
  imActioner: boolean;
  showWolves: boolean;
}

/** Structured role item for BoardInfoCard touchable chips */
export interface RoleDisplayItem {
  roleId: string;
  displayName: string;
  count: number;
}

interface RoleStats {
  roleCounts: Record<string, number>;
  wolfRoles: string[];
  godRoles: string[];
  specialRoles: string[];
  villagerCount: number;
  wolfRoleItems: RoleDisplayItem[];
  godRoleItems: RoleDisplayItem[];
  specialRoleItems: RoleDisplayItem[];
  /** Villager-faction roles that are NOT generic 'villager' (e.g. mirrorSeer) */
  villagerRoleItems: RoleDisplayItem[];
}

export interface SeatViewModel {
  seat: number;
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
  /** UX-only: if set, the seat is non-selectable for the current UI context (server still validates). */
  disabledReason?: string;
  /** Show ✅ badge on seat tile (e.g. player has viewed role during assigned phase). */
  showReadyBadge?: boolean;
  /** Wolf vote target for this seat (visible to wolf-faction only during wolf meeting). */
  wolfVoteTarget?: number;
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
 * @param actions - Map of already submitted role actions
 */
export function determineActionerState(
  actorRole: RoleId | null,
  currentActionRole: RoleId | null,
  currentSchema: ActionSchema | null,
  actorSeatNumber: number | null,
  wolfVotes: Map<number, number>,
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
  _wolfVotes: Map<number, number>,
  actions: Map<RoleId, RoleAction>,
  isWolfMeetingSchema: boolean,
): ActionerState {
  // Wolf meeting phase: always imActioner (revote allowed)
  if (isWolfMeetingSchema && doesRoleParticipateInWolfVote(actorRole)) {
    return { imActioner: true, showWolves: true };
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
  _actorSeatNumber: number | null,
  _wolfVotes: Map<number, number>,
): ActionerState {
  // Revote allowed: always imActioner during wolf meeting
  return { imActioner: true, showWolves: true };
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
      ((gameState as unknown as Record<string, unknown>).wolfVotes as
        | Map<number, number>
        | undefined);
    if (!raw) return new Map();
    if (raw instanceof Map) return raw;
    const map = new Map<number, number>();
    for (const [k, v] of Object.entries(raw as Record<string, number>)) {
      map.set(Number.parseInt(k, 10), v);
    }
    return map;
  })();

  return {
    template: gameState.template,
    players: gameState.players,
    actions: gameState.actions,
    wolfVotes,
    currentStepIndex: gameState.currentStepIndex,
  };
}

/**
 * Get wolf vote summary for display (e.g. "2/3 狼人已投票")
 */
export function getWolfVoteSummary(room: GameRoomLike): string {
  const wolfSeats: number[] = [];
  room.players.forEach((player, seat) => {
    if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
      wolfSeats.push(seat);
    }
  });
  wolfSeats.sort((a, b) => a - b);

  const voted = wolfSeats.filter((seat) => room.wolfVotes.has(seat));
  return `${voted.length}/${wolfSeats.length} 狼人已投票`;
}

/**
 * Calculate role statistics for display
 */
export function getRoleStats(roles: RoleId[]): RoleStats {
  const roleCounts: Record<string, number> = {};
  const wolfRolesList: string[] = [];
  const godRolesList: string[] = [];
  const specialRolesList: string[] = [];
  const wolfItemMap = new Map<string, RoleDisplayItem>();
  const godItemMap = new Map<string, RoleDisplayItem>();
  const specialItemMap = new Map<string, RoleDisplayItem>();
  const villagerItemMap = new Map<string, RoleDisplayItem>();
  let villagerCount = 0;

  // 板子配置是法官视角，使用真实角色 spec（不走 displayAs 伪装）
  roles.forEach((role) => {
    const spec = getRoleSpec(role);
    if (!spec) return;

    const { faction, displayName } = spec;

    if (faction === Faction.Wolf) {
      roleCounts[displayName] = (roleCounts[displayName] || 0) + 1;
      if (!wolfRolesList.includes(displayName)) {
        wolfRolesList.push(displayName);
      }
      const existing = wolfItemMap.get(role);
      wolfItemMap.set(
        role,
        existing
          ? { ...existing, count: existing.count + 1 }
          : { roleId: role, displayName, count: 1 },
      );
    } else if (faction === Faction.God) {
      roleCounts[displayName] = (roleCounts[displayName] || 0) + 1;
      if (!godRolesList.includes(displayName)) {
        godRolesList.push(displayName);
      }
      const existing = godItemMap.get(role);
      godItemMap.set(
        role,
        existing
          ? { ...existing, count: existing.count + 1 }
          : { roleId: role, displayName, count: 1 },
      );
    } else if (faction === Faction.Special) {
      roleCounts[displayName] = (roleCounts[displayName] || 0) + 1;
      if (!specialRolesList.includes(displayName)) {
        specialRolesList.push(displayName);
      }
      const existing = specialItemMap.get(role);
      specialItemMap.set(
        role,
        existing
          ? { ...existing, count: existing.count + 1 }
          : { roleId: role, displayName, count: 1 },
      );
    } else if (role === 'villager') {
      villagerCount++;
    } else {
      // Villager-faction but not generic villager (e.g. mirrorSeer)
      roleCounts[displayName] = (roleCounts[displayName] || 0) + 1;
      const existing = villagerItemMap.get(role);
      villagerItemMap.set(
        role,
        existing
          ? { ...existing, count: existing.count + 1 }
          : { roleId: role, displayName, count: 1 },
      );
    }
  });

  return {
    roleCounts,
    wolfRoles: wolfRolesList,
    godRoles: godRolesList,
    specialRoles: specialRolesList,
    villagerCount,
    wolfRoleItems: [...wolfItemMap.values()],
    godRoleItems: [...godItemMap.values()],
    specialRoleItems: [...specialItemMap.values()],
    villagerRoleItems: [...villagerItemMap.values()],
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
  selectedSeat: number | null,
  options?: {
    /**
     * Schema constraints for current action (e.g. ['notSelf']).
     * UX-only early rejection - server still validates.
     */
    schemaConstraints?: readonly TargetConstraint[];
    /**
     * Second selected seat for swap schema (magician).
     * Used to highlight the second seat being selected before confirmation.
     */
    secondSelectedSeat?: number | null;
    /**
     * Show ✅ ready badge on seats where player has viewed their role.
     * Typically true during Assigned phase.
     */
    showReadyBadges?: boolean;
  },
): SeatViewModel[] {
  // Wolf vote progress: reuse ✅ badge on wolf seats that have voted (ongoing phase only, mutually exclusive with assigned/ready badge)
  const wolfVotesBySeat = showWolves ? gameState.currentNightResults?.wolfVotesBySeat : undefined;

  return gameState.template.roles.map((role, seat) => {
    const player = gameState.players.get(seat);
    const effectiveRole = player?.role ?? role;
    // Wolf visibility is controlled by ActionerState.showWolves.
    // When true, only wolf-faction roles with canSeeWolves=true are highlighted.
    // Roles like gargoyle/wolfRobot (canSeeWolves=false) are hidden from wolf pack view.
    const isWolf = showWolves && isWolfRole(effectiveRole) && canRoleSeeWolves(effectiveRole);

    // UX-only early rejection based on schema constraints.
    // IMPORTANT: Server remains the authority. This is just early UI guidance.
    let disabledReason: string | undefined;

    // Constraint: notSelf - cannot select own seat
    if (
      options?.schemaConstraints?.includes(TargetConstraint.NotSelf) &&
      seat === actorSeatNumber
    ) {
      disabledReason = '不能选择自己';
    }

    // ✅ badge: assigned/ready → "已查看身份"
    // wolfVoteTarget badge 已包含"已投票"语义，两者互斥
    const hasWolfVoteTarget = isWolf && wolfVotesBySeat != null && String(seat) in wolfVotesBySeat;
    const readyBadge =
      !hasWolfVoteTarget &&
      options?.showReadyBadges &&
      player != null &&
      (player.hasViewedRole ?? false);

    return {
      seat,
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
      isMySpot: actorSeatNumber === seat,
      isWolf,
      isSelected: selectedSeat === seat || options?.secondSelectedSeat === seat,
      disabledReason,
      showReadyBadge: readyBadge,
      wolfVoteTarget: hasWolfVoteTarget ? wolfVotesBySeat[String(seat)] : undefined,
    };
  });
}
