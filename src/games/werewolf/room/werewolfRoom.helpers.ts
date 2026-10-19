/**
 * werewolfRoom.helpers.ts - Pure functions for WerewolfRoomScreen
 *
 * These are pure utility functions with no side effects.
 * They only depend on types and the roles registry (getRoleSpec, isWolfRole).
 * Does not import services, navigation, or React.
 */

import type { RoleAction } from '@game-judge/game-engine/games/werewolf/public';
import type { CurrentNightResults } from '@game-judge/game-engine/games/werewolf/public';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import type { GameTemplate } from '@game-judge/game-engine/games/werewolf/public';
import type { WerewolfNightStep } from '@game-judge/game-engine/games/werewolf/public';
import type { WerewolfViewModel } from '@game-judge/game-engine/games/werewolf/public';
import {
  doesRoleParticipateInWolfVote,
  getRoleSpec,
  isWolfRole,
} from '@game-judge/game-engine/games/werewolf/public';
import {
  type ActionSchema,
  SCHEMAS,
  TargetConstraint,
} from '@game-judge/game-engine/games/werewolf/public';
import { Faction } from '@game-judge/game-engine/games/werewolf/public';
import {
  getBottomCardEffectiveRole,
  isBottomCardWolfVoteExcluded,
} from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';

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
      userId: string;
      seat: number;
      role: RoleId | null;
      hasViewedRole: boolean;
      displayName?: string;
      avatarUrl?: string | null;
      level?: number;
    } | null
  >;
  actions: Map<RoleId, RoleAction>;
  wolfVotes: Map<number, number>;
  nightStep: WerewolfNightStep | null;
  currentNightResults: CurrentNightResults;
}

/** Whether the current player is the actioner and whether to show wolf teammates. */
export interface ActionerState {
  imActioner: boolean;
  showWolves: boolean;
}

/** Structured role item for BoardInfoCard touchable chips.
 * @deprecated Use RoleDisplayItem from '@/features/room/model/BoardInfoSection' instead. */
import type { RoleDisplayItem as SharedRoleDisplayItem } from '@/features/room/model/BoardInfoSection';
export type RoleDisplayItem = SharedRoleDisplayItem;

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
    userId: string;
    displayName: string;
    avatarUrl?: string;
    avatarFrame?: string;
    seatFlair?: string;
    seatAnimation?: string;
    nameStyle?: string;
    roleRevealEffect?: string;
    level?: number;
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
  /** Pre-formatted wolf vote badge text (visible to wolf-faction only during wolf meeting). */
  wolfVoteBadge?: string;
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
 * @param actorSeat - Actor's seat number (actorSeatForUi — may be bot's seat when delegating)
 * @param wolfVotes - Map of wolf votes (seat -> target)
 * @param actions - Map of already submitted role actions
 * @param currentNightResults - The authoritative accumulated night results
 * @param groupConfirmAcks - Seats that have already acked the current groupConfirm step
 */
export function determineActionerState(
  actorRole: RoleId | null,
  currentActionRole: RoleId | null,
  currentSchema: ActionSchema | null,
  actorSeat: number | null,
  wolfVotes: Map<number, number>,
  actions: Map<RoleId, RoleAction> = new Map(),
  currentNightResults?: CurrentNightResults,
  groupConfirmAcks: readonly number[] = [],
): ActionerState {
  if (!currentActionRole || !actorRole) {
    return { imActioner: false, showWolves: false };
  }

  // groupConfirm: ALL seated players are actioners, UNLESS they already acked
  if (currentSchema?.kind === 'groupConfirm' && actorSeat !== null) {
    const alreadyAcked = groupConfirmAcks.includes(actorSeat);
    return { imActioner: !alreadyAcked, showWolves: false };
  }

  // Schema-driven: determine if this is a wolf meeting phase
  const isWolfMeetingSchema =
    currentSchema?.kind === 'wolfVote' && currentSchema.meeting?.canSeeEachOther === true;

  // Effective role: for bottom card actors (thief/treasureMaster), use the chosen card's role
  const effectiveRole = getBottomCardEffectiveRole(actorRole, currentNightResults);

  // My effective role matches current action
  if (effectiveRole === currentActionRole) {
    return handleMatchingRole(effectiveRole, actorSeat, wolfVotes, actions, isWolfMeetingSchema);
  }

  // Wolf meeting phase: participating wolves can see pack list and act
  if (isWolfMeetingSchema && isWolfRole(effectiveRole)) {
    if (isBottomCardWolfVoteExcluded(actorRole)) {
      return { imActioner: false, showWolves: false };
    }
    if (!doesRoleParticipateInWolfVote(effectiveRole)) {
      // Non-voting wolves (e.g., wolfRobot) cannot see the pack
      return { imActioner: false, showWolves: false };
    }
    return handleWolfTeamTurn(actorSeat, wolfVotes);
  }

  return { imActioner: false, showWolves: false };
}

function handleMatchingRole(
  actorRole: RoleId,
  actorSeat: number | null,
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
  _actorSeat: number | null,
  _wolfVotes: Map<number, number>,
): ActionerState {
  // Revote allowed: always imActioner during wolf meeting
  return { imActioner: true, showWolves: true };
}

/**
 * Project LocalGameState into the fields required by room helper functions.
 */
export function toGameRoomLike(gameState: LocalGameState): GameRoomLike {
  return {
    template: gameState.template,
    players: gameState.players,
    actions: gameState.actions,
    wolfVotes: gameState.wolfVotes,
    nightStep: gameState.nightStep,
    currentNightResults: gameState.currentNightResults,
  };
}

/**
 * Format a wolf vote entry into badge text.
 * -1 → schema-defined empty knife text; ≥0 → "袭击{seat+1}号".
 */
function formatWolfVoteBadge(vote: number): string {
  return vote === -1 ? SCHEMAS.wolfKill.ui!.emptyVoteText! : `袭击${formatSeat(vote)}`;
}

/**
 * Get wolf vote summary for display (e.g. "2/3 狼人已确认")
 */
export function getWolfVoteSummary(room: GameRoomLike): string {
  const wolfSeats: number[] = [];
  room.players.forEach((player, seat) => {
    if (player?.role) {
      const effectiveRole = getBottomCardEffectiveRole(player.role, room.currentNightResults);
      if (
        doesRoleParticipateInWolfVote(effectiveRole) &&
        !isBottomCardWolfVoteExcluded(player.role)
      ) {
        wolfSeats.push(seat);
      }
    }
  });
  wolfSeats.sort((a, b) => a - b);

  const voted = wolfSeats.filter((seat) => room.wolfVotes.has(seat));
  return `${voted.length}/${wolfSeats.length} 狼人已确认`;
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

  // Role config is from the judge's perspective — use the real role spec (bypass displayAs masking)
  roles.forEach((role) => {
    const spec = getRoleSpec(role);
    if (!spec) return;

    const { faction, displayName } = spec;

    if (faction === Faction.Wolf) {
      roleCounts[displayName] = (roleCounts[displayName] ?? 0) + 1;
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
      roleCounts[displayName] = (roleCounts[displayName] ?? 0) + 1;
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
      roleCounts[displayName] = (roleCounts[displayName] ?? 0) + 1;
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
      roleCounts[displayName] = (roleCounts[displayName] ?? 0) + 1;
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
 * Build SeatViewModel array from game state
 *
 * Wolf visibility and wolf-vote badges come from the AU-39 view model
 * (viewer-cropped projection): a seat is highlighted when the view model
 * flags it as a wolf-pack peer for this viewer, and vote badges read the
 * view model's gated wolfVotesBySeat. Interaction state (selection,
 * schema disabled reasons) is layered on here, never projected.
 *
 * @param viewModel - AU-39 view model for the effective viewer.
 * @param actorSeat - Actor's seat (actorSeatForUi). Used for isMySpot + notSelf constraint.
 */
export function buildSeatViewModels(
  gameState: LocalGameState,
  viewModel: WerewolfViewModel,
  actorSeat: number | null,
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
     * Multi-selected seats for multiChooseSeat schema (piper hypnotize).
     * Each selected seat is highlighted.
     */
    multiSelectedSeats?: readonly number[];
    /**
     * Show ✅ ready badge on seats where player has viewed their role.
     * Typically true during Assigned phase.
     */
    showReadyBadges?: boolean;
    /**
     * Seats that have acked groupConfirm (e.g. piperHypnotizedReveal).
     * Shows ✅ badge on acked seats during groupConfirm phase.
     */
    groupConfirmAcks?: readonly number[];
  },
): SeatViewModel[] {
  // Wolf vote progress comes from the view model (viewer-gated; null while
  // the viewer may not see wolf votes): reuse ✅ badge on wolf seats that
  // have voted (ongoing phase only, mutually exclusive with assigned/ready badge)
  const wolfVotesBySeat = viewModel.night.wolfVotesBySeat;
  const seatViewBySeat = new Map(viewModel.seats.map((seatView) => [seatView.seat, seatView]));

  const playerRoles = gameState.template.roles.slice(0, gameState.template.numberOfPlayers);
  return playerRoles.map((role, seat) => {
    const player = gameState.players.get(seat);
    const seatView = seatViewBySeat.get(seat);
    // Wolf visibility is decided by the view model: a seat is highlighted
    // when it is a wolf-pack peer for this viewer (bottom-card effective
    // role, canSeeWolves and bottom-card exclusion rules applied
    // engine-side). Gargoyle/wolfRobot and bottom-card actors never appear.
    const isWolf = seatView?.isWolfPackPeer ?? false;

    // UX-only early rejection based on schema constraints.
    // IMPORTANT: Server remains the authority. This is just early UI guidance.
    let disabledReason: string | undefined;

    // Constraint: notSelf - cannot select own seat
    if (options?.schemaConstraints?.includes(TargetConstraint.NotSelf) && seat === actorSeat) {
      disabledReason = '不能选择自己';
    }

    // ✅ badge: assigned/ready → "已查看身份"
    // groupConfirm ack → "已确认催眠"
    // wolfVoteBadge already covers the "已投票" semantic; the two are mutually exclusive
    const hasWolfVoteBadge = isWolf && wolfVotesBySeat != null && String(seat) in wolfVotesBySeat;
    const readyBadge =
      !hasWolfVoteBadge &&
      ((options?.showReadyBadges && player != null && (seatView?.hasViewedRole ?? false)) ||
        (options?.groupConfirmAcks?.includes(seat) ?? false));

    return {
      seat,
      role,
      player: player
        ? {
            userId: player.userId,
            displayName: player.displayName || '玩家',
            avatarUrl: player.avatarUrl,
            avatarFrame: player.avatarFrame,
            seatFlair: player.seatFlair,
            seatAnimation: player.seatAnimation,
            nameStyle: player.nameStyle,
            roleRevealEffect: player.roleRevealEffect,
            level: player.level,
            isBot: player.isBot,
            role: player.role, // For bot role display (debug mode)
          }
        : null,
      isMySpot: actorSeat === seat,
      isWolf,
      isSelected:
        selectedSeat === seat ||
        options?.secondSelectedSeat === seat ||
        (options?.multiSelectedSeats?.includes(seat) ?? false),
      disabledReason,
      showReadyBadge: readyBadge,
      wolfVoteBadge: hasWolfVoteBadge
        ? formatWolfVoteBadge(wolfVotesBySeat[String(seat)]!)
        : undefined,
    };
  });
}
