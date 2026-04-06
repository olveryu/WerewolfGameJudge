/**
 * useRoomActions.ts - Room action orchestration hook (Intent Layer)
 *
 * Provides pure logic for determining what action to take when user interacts.
 * Returns ActionIntent objects that RoomScreen orchestrator handles.
 * Uses pure logic and helper functions to return ActionIntent. Does not call dialogs,
 * does not import services/nightFlow/supabase, and does not call Room model functions.
 *
 * Phase 3: Schema-driven - uses currentSchema.kind instead of role names
 */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import {
  doesRoleParticipateInWolfVote,
  isWolfRole,
  RoleId,
} from '@werewolf/game-engine/models/roles';
import type { ActionSchema, RevealKind, SchemaId } from '@werewolf/game-engine/models/roles/spec';
import { isValidSchemaId, SCHEMAS } from '@werewolf/game-engine/models/roles/spec';
import {
  getBottomCardEffectiveRole,
  isBottomCardWolfVoteExcluded,
} from '@werewolf/game-engine/utils/playerHelpers';
import { useCallback, useMemo } from 'react';

import type { ActionIntent } from '@/screens/RoomScreen/policy/types';
import type { LocalGameState } from '@/types/GameStateTypes';

import { type BottomActionVM, buildBottomAction } from './bottomActionBuilder';

// Re-export for architectural boundary contract (see hooks.boundary.test.ts)
export type { ActionIntent };

// ─────────────────────────────────────────────────────────────────────────────
// Context & Dependencies
// ─────────────────────────────────────────────────────────────────────────────

export interface GameContext {
  gameState: LocalGameState | null;
  roomStatus: GameStatus;
  currentActionRole: RoleId | null;
  currentSchema: ActionSchema | null; // Phase 3: schema for current action role
  imActioner: boolean;

  // Actor identity (for all action-related decisions)
  // When Host controls a bot, these are the bot's seat/role
  actorSeatNumber: number | null;
  actorRole: RoleId | null;

  isAudioPlaying: boolean;
  firstSwapSeat: number | null; // Magician first target
  /** Multi-select seats for multiChooseSeat schema (piper hypnotize) */
  multiSelectedSeats: readonly number[];
  /** Counter that ticks every second during wolf vote countdown, forcing re-render. */
  countdownTick?: number;
}

export interface ActionDeps {
  /** Check if wolf has voted */
  hasWolfVoted: (seatNumber: number) => boolean;

  /** UI-only: precomputed wolf-vote summary string (e.g. "1/3 狼人已确认"). */
  getWolfVoteSummary: () => string;
  /**
   * Get witch context from gameState (UI filters by myRole)
   * Returns null if no witchContext in current state
   */
  getWitchContext: () => {
    killedSeat: number;
    canSave: boolean;
    canPoison: boolean;
  } | null;
}

interface UseRoomActionsResult {
  /** Get intent when seat is tapped */
  getActionIntent: (seat: number) => ActionIntent | null;

  /** Get skip action intent */
  getSkipIntent: () => ActionIntent | null;

  /** Get auto-trigger intent (witch/etc. auto-popup on turn start) */
  getAutoTriggerIntent: () => ActionIntent | null;

  /** Build action confirm message */
  buildActionMessage: (seat: number) => string;

  /** Find voting wolf seat */
  findVotingWolfSeat: () => number | null;

  /** Check if can tap for action */
  canTapForAction: () => boolean;

  /** UI-only: if current actor is wolf, returns vote summary + (optional) my-seat suffix. */
  getWolfStatusLine: () => string | null;

  /** UI-only: schema-driven bottom action button view-model (visibility + label). */
  getBottomAction: () => BottomActionVM;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helper: derive intent from schema kind (extracted to reduce complexity)
// ─────────────────────────────────────────────────────────────────────────────

interface IntentContext {
  actorRole: RoleId;
  schemaKind: ActionSchema['kind'] | undefined;
  schemaId: SchemaId | undefined;
  uiRevealKind: RevealKind | undefined;
  seat: number;
  firstSwapSeat: number | null;
  isWolf: boolean;
  wolfSeat: number | null;
  buildMessage: (idx: number) => string;
}

/**
 * NOTE on "wolf meeting" fields (avoid double-write/drift):
 * - ROLE_SPECS[*].wolfMeeting.participatesInWolfVote answers "WHO can submit WOLF_VOTE".
 * - SCHEMAS.wolfKill.meeting.* answers "HOW the wolfVote step behaves in UI/meeting" (visibility, resolution, etc).
 * These are intentionally different responsibilities.
 */

/**
 * Pure helper used by getSkipIntent.
 * Exported for testability (avoid calling hooks directly in unit tests).
 */
export function deriveSkipIntentFromSchema(
  actorRole: RoleId,
  currentSchema: ActionSchema | null | undefined,
  buildMessage: (idx: number) => string,
  isWolf: boolean,
  wolfSeat: number | null,
): ActionIntent | null {
  // chooseSeat schemas: only allow generic skip when schema allows skipping
  if (currentSchema?.kind === 'chooseSeat') {
    if (currentSchema.canSkip) {
      return { type: 'skip', targetSeat: -1, message: buildMessage(-1) };
    }
    return null;
  }

  // multiChooseSeat schemas (piperHypnotize): skip if canSkip
  if (currentSchema?.kind === 'multiChooseSeat') {
    if (currentSchema.canSkip) {
      return { type: 'skip', targetSeat: -1, message: buildMessage(-1) };
    }
    return null;
  }

  // compound schema (witch): skip is handled via getBottomAction's 'skipAll' button.
  // getSkipIntent should not provide a generic skip for compound schemas.
  if (currentSchema?.kind === 'compound') {
    return null;
  }

  // wolfVote schema: skip means "vote empty knife" (handled elsewhere as wolfVote intent)
  if (currentSchema?.kind === 'wolfVote' && isWolf && wolfSeat !== null) {
    return { type: 'wolfVote', targetSeat: -1, wolfSeat };
  }

  // default: confirm skip
  return { type: 'skip', targetSeat: -1, message: buildMessage(-1) };
}

/** chooseSeat schema: seer/psychic/gargoyle/wolfRobot reveal, or normal action */
function deriveChooseSeatIntent(ctx: IntentContext): ActionIntent {
  const { uiRevealKind, seat, buildMessage } = ctx;

  if (uiRevealKind) {
    return { type: 'reveal', revealKind: uiRevealKind, targetSeat: seat };
  }
  return { type: 'actionConfirm', targetSeat: seat, message: buildMessage(seat) };
}

/**
 * Derives ActionIntent from schema kind. Pure function (no hooks).
 * Uses focused sub-helpers to keep each branch simple.
 */
function deriveIntentFromSchema(ctx: IntentContext): ActionIntent | null {
  const { schemaKind, seat, firstSwapSeat, isWolf, wolfSeat } = ctx;

  switch (schemaKind) {
    case 'confirm':
      // confirm schema (hunter/darkWolfKing): seat tap has no effect
      // Action is triggered via bottom button only
      return null;
    case 'swap':
      // swap (magician): two-step selection
      // - firstSwapSeat === null → first seat selection (magicianFirst)
      // - firstSwapSeat !== null → second seat selection (actionConfirm for swap)
      if (firstSwapSeat === null) {
        return { type: 'magicianFirst', targetSeat: seat };
      } else {
        // Second seat: confirm the swap
        return {
          type: 'actionConfirm',
          targetSeat: seat,
          message: ctx.buildMessage?.(seat),
        };
      }
    case 'compound':
      // Compound (witchAction): UX rule: seat tap is ALWAYS poison selection.
      // Save is only triggered via the dedicated bottom button.
      if (!ctx.schemaId) return null;
      if (ctx.schemaId !== 'witchAction') return null;

      {
        const compound = (SCHEMAS as Record<string, ActionSchema>)[ctx.schemaId];
        if (compound?.kind !== 'compound') return null;
        const poison = compound.steps?.find((s) => s.key === 'poison');
        if (!poison) {
          throw new Error('[SchemaDrivenUI] Missing poison sub-step in SCHEMAS.witchAction');
        }
        return {
          type: 'actionConfirm',
          targetSeat: seat,
          message: poison.ui?.confirmText,
          stepKey: 'poison',
        };
      }
    case 'wolfVote':
      // NOTE: wolfKillDisabled is now handled by server resolver.
      // UI no longer blocks seat taps. All votes go through submit → server validates.
      return isWolf && wolfSeat !== null ? { type: 'wolfVote', targetSeat: seat, wolfSeat } : null;
    case 'chooseSeat':
      return deriveChooseSeatIntent(ctx);
    case 'multiChooseSeat':
      // Multi-select: seat tap toggles selection (added/removed in orchestrator)
      return { type: 'multiSelectToggle', targetSeat: seat };
    case 'skip':
    case 'confirmTarget':
    case 'groupConfirm':
    case 'chooseCard':
    case undefined:
      return null;
    default: {
      const _exhaustive: never = schemaKind;
      return _exhaustive;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook Implementation
// ─────────────────────────────────────────────────────────────────────────────

export function useRoomActions(gameContext: GameContext, deps: ActionDeps): UseRoomActionsResult {
  const {
    gameState,
    roomStatus,
    currentSchema,
    imActioner,
    actorSeatNumber,
    actorRole,
    isAudioPlaying,
    firstSwapSeat,
    multiSelectedSeats,
    countdownTick,
  } = gameContext;

  const { hasWolfVoted, getWolfVoteSummary, getWitchContext } = deps;

  // Effective role for bottom card actors (thief/treasureMaster): use the chosen card's role
  // for wolf participation checks and meeting visibility.
  const effectiveActorRole = useMemo(
    () =>
      actorRole
        ? getBottomCardEffectiveRole(
            actorRole,
            gameState?.thiefChosenCard,
            gameState?.treasureMasterChosenCard,
          )
        : null,
    [actorRole, gameState?.thiefChosenCard, gameState?.treasureMasterChosenCard],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Wolf vote helpers
  // ─────────────────────────────────────────────────────────────────────────

  const findVotingWolfSeat = useCallback((): number | null => {
    if (!gameState) return null;
    // Only wolves that participate in wolf vote can vote (excludes gargoyle, wolfRobot, etc.)
    // treasureMaster never participates in wolfVote even if chosen card is wolf.
    // Revote allowed: no longer check hasWolfVoted
    if (
      actorSeatNumber !== null &&
      actorRole &&
      effectiveActorRole &&
      doesRoleParticipateInWolfVote(effectiveActorRole) &&
      !isBottomCardWolfVoteExcluded(actorRole)
    ) {
      return actorSeatNumber;
    }
    return null;
  }, [gameState, actorSeatNumber, actorRole, effectiveActorRole]);

  // ─────────────────────────────────────────────────────────────────────────
  // Action message builder
  // ─────────────────────────────────────────────────────────────────────────

  const buildActionMessage = useCallback(
    (_seat: number): string => {
      const confirmText = currentSchema?.ui?.confirmText;

      // Hardcore schema-driven UI contract:
      // confirm copy must come from schema.ui.confirmText (no role/legacy/dev fallback).
      // NOTE: compound schemas don't confirm directly (they delegate to stepSchemaId);
      // for those, confirmText is not required here.
      if (currentSchema?.kind !== 'compound') {
        if (!confirmText || typeof confirmText !== 'string') {
          throw new Error(
            `[SchemaDrivenUI] Missing currentSchema.ui.confirmText for schema: ${currentSchema?.id ?? 'unknown'}`,
          );
        }
      }

      // NOTE: seat/firstSwapSeat are not used in the confirm copy (schema-driven).
      // They're kept in the signature for interface compatibility.
      // Non-compound schemas throw above if confirmText is missing, so this is safe.
      return confirmText as string;
    },
    [currentSchema],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Can tap for action
  // ─────────────────────────────────────────────────────────────────────────

  const canTapForAction = useCallback((): boolean => {
    if (!gameState) return false;
    if (roomStatus !== GameStatus.Ongoing) return false;
    if (isAudioPlaying) return false;
    if (!imActioner) return false;
    return true;
  }, [gameState, roomStatus, isAudioPlaying, imActioner]);

  // ─────────────────────────────────────────────────────────────────────────
  // UI-only: wolf status line for the action prompt area
  // ─────────────────────────────────────────────────────────────────────────

  const getWolfStatusLine = useCallback((): string | null => {
    if (!effectiveActorRole || !isWolfRole(effectiveActorRole)) return null;
    // Only show during the schema-driven wolf-vote step.
    if (currentSchema?.kind !== 'wolfVote') return null;

    const base = getWolfVoteSummary();
    const voted = actorSeatNumber !== null && hasWolfVoted(actorSeatNumber);

    if (!voted) {
      return base;
    }

    // 已投票：检查倒计时
    const deadline = gameState?.stepDeadline;
    if (deadline != null) {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (remaining > 0) {
        return `${base}（${remaining}秒后确认）`;
      }
    }

    return `${base}（可点击改票或取消）`;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- countdownTick is a trigger to re-compute remaining time via Date.now()
  }, [
    currentSchema?.kind,
    getWolfVoteSummary,
    hasWolfVoted,
    effectiveActorRole,
    actorSeatNumber,
    gameState?.stepDeadline,
    countdownTick,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // UI-only: schema-driven bottom action button (skip / wolf empty vote / blocked)
  // ─────────────────────────────────────────────────────────────────────────

  const getBottomAction = useCallback(
    (): BottomActionVM =>
      buildBottomAction({
        gameState,
        roomStatus,
        isAudioPlaying,
        currentSchema,
        imActioner,
        actorSeatNumber,
        actorRole,
        multiSelectedSeats,
        hasWolfVoted,
        getWitchContext,
      }),
    [
      gameState,
      getWitchContext,
      imActioner,
      isAudioPlaying,
      currentSchema,
      roomStatus,
      actorSeatNumber,
      actorRole,
      hasWolfVoted,
      multiSelectedSeats,
    ],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Auto-trigger intent (for roles that popup on turn start)
  // Phase 3: Schema-driven - uses currentSchema.kind instead of role names
  // ─────────────────────────────────────────────────────────────────────────

  const getAutoTriggerIntent = useCallback((): ActionIntent | null => {
    if (!actorRole || !imActioner || isAudioPlaying) return null;

    // NOTE: Nightmare block is handled by server resolver (server-authoritative).
    // UI does NOT intercept or change prompt for blocked players.
    // All actions go through submit → server validates → ACTION_REJECTED if blocked.
    // UI then reads gameState.actionRejected and shows the rejection alert.

    // wolfRobotLearn: suppress auto-trigger if wolfRobot has already completed learning
    // (wolfRobotReveal exists means learning is done - don't re-popup the action prompt)
    if (currentSchema?.id === 'wolfRobotLearn' && gameState?.wolfRobotReveal) {
      // WolfRobot has already learned a role - don't auto-trigger actionPrompt
      // If learned hunter, the hunter gate button will be shown instead
      // If learned other role, wait for server to advance to next step
      return null;
    }

    // Schema-driven: compound schema (witch two-phase flow)
    if (currentSchema?.kind === 'compound') {
      // ANTI-CHEAT: 仅在 WitchContext 到达后才弹 prompt（避免没有 killedSeat 时误导 UI）。
      const witchCtx = getWitchContext();
      if (!witchCtx) return null;
      return { type: 'actionPrompt', targetSeat: -1 };
    }

    // Schema-driven: confirm schema (hunterConfirm/darkWolfKingConfirm)
    if (currentSchema?.kind === 'confirm') {
      return { type: 'actionPrompt', targetSeat: -1 };
    }

    // Schema-driven: swap schema (magician)
    // When first target is already selected (firstSwapSeat !== null),
    // do NOT re-trigger actionPrompt - user is selecting second target.
    if (currentSchema?.kind === 'swap') {
      if (firstSwapSeat !== null) {
        return null; // Suppress auto-trigger while selecting second seat
      }
      return { type: 'actionPrompt', targetSeat: -1 };
    }

    // Schema-driven: groupConfirm (e.g. piperHypnotizedReveal) — auto-trigger prompt dialog
    // (same as hunterConfirm: show prompt → dismiss → bottom-bar button triggers detail dialog → ack)
    if (currentSchema?.kind === 'groupConfirm') {
      return { type: 'actionPrompt', targetSeat: -1 };
    }

    // All other schemas: show generic action prompt, dismiss → wait for seat tap
    return { type: 'actionPrompt', targetSeat: -1 };
  }, [
    actorRole,
    imActioner,
    isAudioPlaying,
    currentSchema,
    gameState?.wolfRobotReveal,
    getWitchContext,
    firstSwapSeat,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // Get action intent when seat is tapped
  // Phase 3: Schema-driven - uses currentSchema.kind instead of role names
  // ─────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────
  // Get action intent when seat is tapped
  // Phase 3: Schema-driven - uses currentSchema.kind instead of role names
  // ─────────────────────────────────────────────────────────────────────────

  const getActionIntent = useCallback(
    (seat: number): ActionIntent | null => {
      if (!actorRole) return null;

      // wolfRobotLearn: after learning is done (wolfRobotReveal exists),
      // seat taps have no effect. User must interact via bottom button only.
      if (currentSchema?.id === 'wolfRobotLearn' && gameState?.wolfRobotReveal) {
        return null;
      }

      // NOTE: Nightmare block is handled by server resolver (server-authoritative).
      // UI does NOT intercept seat taps for blocked players.
      // All seat taps go through submit → server validates → ACTION_REJECTED if blocked.
      // UI then reads gameState.actionRejected and shows the rejection alert.

      // Delegate to pure helper for schema-driven intent derivation
      const schemaIntent = deriveIntentFromSchema({
        actorRole: actorRole,
        schemaKind: currentSchema?.kind,
        schemaId:
          currentSchema?.id && isValidSchemaId(currentSchema.id) ? currentSchema.id : undefined,
        uiRevealKind:
          currentSchema?.kind === 'chooseSeat' ? currentSchema.ui?.revealKind : undefined,
        seat,
        firstSwapSeat,
        // Schema-driven wolf vote eligibility.
        // Participation is defined by ROLE_SPECS[*].wolfMeeting.participatesInWolfVote.
        // Do NOT additionally gate by isWolfRole(): the meeting participation flag is the
        // single source for whether this role can submit WOLF_VOTE during wolfKill.
        // Uses effective role: thief/treasureMaster who chose a wolf card can vote.
        isWolf: effectiveActorRole ? doesRoleParticipateInWolfVote(effectiveActorRole) : false,
        wolfSeat: findVotingWolfSeat(),
        buildMessage: (idx) => buildActionMessage(idx),
      });

      // Schema-driven intent is the single source of truth for seat taps.
      // - chooseSeat → actionConfirm/revealIntent
      // - compound (witch) → actionConfirm for poison
      // - wolfVote → wolfVote intent
      // - swap (magician) → magicianFirst
      // - confirm (hunter/darkWolfKing) → null (action via bottom button only)
      // - default/unknown → null (no seat tap effect)
      return schemaIntent;
    },
    [
      actorRole,
      effectiveActorRole,
      currentSchema,
      firstSwapSeat,
      findVotingWolfSeat,
      buildActionMessage,
      gameState?.wolfRobotReveal,
    ],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Get skip intent
  // Phase 3: Schema-driven
  // ─────────────────────────────────────────────────────────────────────────

  const getSkipIntent = useCallback((): ActionIntent | null => {
    if (!actorRole) return null;

    // MUST use doesRoleParticipateInWolfVote (not isWolfRole) to align with getActionIntent.
    // isWolfRole checks team==='wolf' which includes non-voting wolves (wolfRobot/gargoyle).
    // doesRoleParticipateInWolfVote checks wolfMeeting.participatesInWolfVote (single source of truth).
    // Uses effective role: thief/treasureMaster who chose a wolf card can vote.
    const isWolf = effectiveActorRole ? doesRoleParticipateInWolfVote(effectiveActorRole) : false;
    const wolfSeat = findVotingWolfSeat();
    return deriveSkipIntentFromSchema(
      actorRole,
      currentSchema,
      (idx) => buildActionMessage(idx),
      isWolf,
      wolfSeat,
    );
  }, [actorRole, effectiveActorRole, currentSchema, findVotingWolfSeat, buildActionMessage]);

  return {
    getActionIntent,
    getSkipIntent,
    getAutoTriggerIntent,
    buildActionMessage,
    findVotingWolfSeat,
    canTapForAction,
    getWolfStatusLine,
    getBottomAction,
  };
}
