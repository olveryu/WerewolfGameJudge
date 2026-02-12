/**
 * useRoomActions.ts - Room action orchestration hook (Intent Layer)
 *
 * Provides pure logic for determining what action to take when user interacts.
 * Returns ActionIntent objects that RoomScreen orchestrator handles.
 *
 * ❌ Do NOT: call dialogs, import services/nightFlow/supabase, call Room model functions
 * ✅ Allowed: pure logic, return ActionIntent, helper functions
 *
 * Phase 3: Schema-driven - uses currentSchema.kind instead of role names
 */

import { useCallback } from 'react';

import { GameStatus } from '@/models/GameStatus';
import { doesRoleParticipateInWolfVote, isWolfRole, RoleId } from '@/models/roles';
import type { ActionSchema, RevealKind, SchemaId } from '@/models/roles/spec';
import { isValidSchemaId, SCHEMAS } from '@/models/roles/spec';
import type { LocalGameState } from '@/types/GameStateTypes';

// ─────────────────────────────────────────────────────────────────────────────
// ActionIntent Types (must be serializable - no callbacks/refs/functions)
// ─────────────────────────────────────────────────────────────────────────────

type ActionIntentType =
  // Reveal (ANTI-CHEAT: RoomScreen only waits for private reveal + sends ack)
  | 'reveal'

  // Witch (schema-driven)

  // Two-step
  | 'magicianFirst' // Magician first target

  // Vote/Confirm
  | 'wolfVote' // Wolf vote
  | 'actionConfirm' // Normal action confirm
  | 'skip' // Skip action
  | 'confirmTrigger' // Hunter/DarkWolfKing: trigger status check via bottom button

  // WolfRobot hunter gate
  | 'wolfRobotViewHunterStatus' // WolfRobot learned hunter: view status gate

  // Auto-trigger prompt (dismiss → wait for seat tap)
  | 'actionPrompt'; // Generic action prompt for all roles

export interface ActionIntent {
  type: ActionIntentType;
  targetIndex: number;

  // Optional fields (based on type)
  wolfSeat?: number; // for wolfVote
  revealKind?: RevealKind; // for reveal
  message?: string; // for actionConfirm

  /**
   * For compound schemas (e.g. witchAction), this is the key of the active sub-step
   * (e.g., 'save' or 'poison' for witch). Used by RoomScreen to derive confirm copy + payload.
   */
  stepKey?: string;
}

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
  anotherIndex: number | null; // Magician first target
  /** Counter that ticks every second during wolf vote countdown, forcing re-render. */
  countdownTick?: number;
}

export interface ActionDeps {
  /** Check if wolf has voted */
  hasWolfVoted: (seatNumber: number) => boolean;

  /** UI-only: precomputed wolf-vote summary string (e.g. "1/3 狼人已投票"). */
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
  getActionIntent: (index: number) => ActionIntent | null;

  /** Get skip action intent */
  getSkipIntent: () => ActionIntent | null;

  /** Get auto-trigger intent (witch/etc. auto-popup on turn start) */
  getAutoTriggerIntent: () => ActionIntent | null;

  /** Build action confirm message */
  buildActionMessage: (index: number) => string;

  /** Find voting wolf seat */
  findVotingWolfSeat: () => number | null;

  /** Check if can tap for action */
  canTapForAction: () => boolean;

  /** UI-only: if current actor is wolf, returns vote summary + (optional) my-seat suffix. */
  getWolfStatusLine: () => string | null;

  /** UI-only: schema-driven bottom action button view-model (visibility + label). */
  getBottomAction: () => BottomActionVM;
}

interface BottomActionVM {
  buttons: BottomButton[];
}

interface BottomButton {
  /** Stable key (align to schema step keys when possible). */
  key: string; // 'save' | 'skip' | 'wolfEmpty' ...
  label: string;
  intent: ActionIntent;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helper: derive intent from schema kind (extracted to reduce complexity)
// ─────────────────────────────────────────────────────────────────────────────

interface IntentContext {
  actorRole: RoleId;
  schemaKind: ActionSchema['kind'] | undefined;
  schemaId: SchemaId | undefined;
  uiRevealKind: RevealKind | undefined;
  index: number;
  anotherIndex: number | null;
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
      return { type: 'skip', targetIndex: -1, message: buildMessage(-1) };
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
    return { type: 'wolfVote', targetIndex: -1, wolfSeat };
  }

  // default: confirm skip
  return { type: 'skip', targetIndex: -1, message: buildMessage(-1) };
}

/** chooseSeat schema: seer/psychic/gargoyle/wolfRobot reveal, or normal action */
function deriveChooseSeatIntent(ctx: IntentContext): ActionIntent {
  const { uiRevealKind, index, buildMessage } = ctx;

  if (uiRevealKind) {
    return { type: 'reveal', revealKind: uiRevealKind, targetIndex: index };
  }
  return { type: 'actionConfirm', targetIndex: index, message: buildMessage(index) };
}

/**
 * Derives ActionIntent from schema kind. Pure function (no hooks).
 * Uses focused sub-helpers to keep each branch simple.
 */
function deriveIntentFromSchema(ctx: IntentContext): ActionIntent | null {
  const { schemaKind, index, anotherIndex, isWolf, wolfSeat } = ctx;

  switch (schemaKind) {
    case 'confirm':
      // confirm schema (hunter/darkWolfKing): seat tap has no effect
      // Action is triggered via bottom button only
      return null;
    case 'swap':
      // swap (magician): two-step selection
      // - anotherIndex === null → first seat selection (magicianFirst)
      // - anotherIndex !== null → second seat selection (actionConfirm for swap)
      if (anotherIndex === null) {
        return { type: 'magicianFirst', targetIndex: index };
      } else {
        // Second seat: confirm the swap
        return {
          type: 'actionConfirm',
          targetIndex: index,
          message: ctx.buildMessage?.(index),
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
          targetIndex: index,
          message: poison.ui?.confirmText,
          stepKey: 'poison',
        };
      }
    case 'wolfVote':
      // NOTE: wolfKillDisabled is now handled by Host resolver.
      // UI no longer blocks seat taps. All votes go through submit → Host validates.
      return isWolf && wolfSeat !== null
        ? { type: 'wolfVote', targetIndex: index, wolfSeat }
        : null;
    case 'chooseSeat':
      return deriveChooseSeatIntent(ctx);
    default:
      return null;
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
    anotherIndex,
    countdownTick,
  } = gameContext;

  const { hasWolfVoted, getWolfVoteSummary, getWitchContext } = deps;

  // ─────────────────────────────────────────────────────────────────────────
  // Wolf vote helpers
  // ─────────────────────────────────────────────────────────────────────────

  const findVotingWolfSeat = useCallback((): number | null => {
    if (!gameState) return null;
    // Only wolves that participate in wolf vote can vote (excludes gargoyle, wolfRobot, etc.)
    // Revote allowed: no longer check hasWolfVoted
    if (actorSeatNumber !== null && actorRole && doesRoleParticipateInWolfVote(actorRole)) {
      return actorSeatNumber;
    }
    return null;
  }, [gameState, actorSeatNumber, actorRole]);

  // ─────────────────────────────────────────────────────────────────────────
  // Action message builder
  // ─────────────────────────────────────────────────────────────────────────

  const buildActionMessage = useCallback(
    (_index: number): string => {
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

      // NOTE: index/anotherIndex are not used in the confirm copy (schema-driven).
      // They're kept in the signature for interface compatibility.
      return confirmText || '';
    },
    [currentSchema],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Can tap for action
  // ─────────────────────────────────────────────────────────────────────────

  const canTapForAction = useCallback((): boolean => {
    if (!gameState) return false;
    if (roomStatus !== GameStatus.ongoing) return false;
    if (isAudioPlaying) return false;
    if (!imActioner) return false;
    return true;
  }, [gameState, roomStatus, isAudioPlaying, imActioner]);

  // ─────────────────────────────────────────────────────────────────────────
  // UI-only: wolf status line for the action prompt area
  // ─────────────────────────────────────────────────────────────────────────

  const getWolfStatusLine = useCallback((): string | null => {
    if (!actorRole || !isWolfRole(actorRole)) return null;
    // Only show during the schema-driven wolf-vote step.
    if (currentSchema?.kind !== 'wolfVote') return null;

    const base = getWolfVoteSummary();
    const voted = actorSeatNumber !== null && hasWolfVoted(actorSeatNumber);

    if (!voted) {
      return base;
    }

    // 已投票：检查倒计时
    const deadline = gameState?.wolfVoteDeadline;
    if (deadline != null) {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (remaining > 0) {
        return `${base}（${remaining}s 后确认）`;
      }
    }

    return `${base}（可点击改票或取消）`;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- countdownTick is a trigger to re-compute remaining time via Date.now()
  }, [
    currentSchema?.kind,
    getWolfVoteSummary,
    hasWolfVoted,
    actorRole,
    actorSeatNumber,
    gameState?.wolfVoteDeadline,
    countdownTick,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // UI-only: schema-driven bottom action button (skip / wolf empty vote / blocked)
  // ─────────────────────────────────────────────────────────────────────────

  const getBottomAction = useCallback((): BottomActionVM => {
    // Keep the same visibility rules previously in RoomScreen.
    if (!imActioner) return { buttons: [] };
    if (!gameState) return { buttons: [] };
    if (roomStatus !== GameStatus.ongoing) return { buttons: [] };
    if (isAudioPlaying) return { buttons: [] };

    // Schema-driven bottom action visibility.
    if (!currentSchema) return { buttons: [] };

    // ─────────────────────────────────────────────────────────────────────────
    // UI Hint（Host 广播驱动，UI 只读展示）
    // 如果 Host 广播了 currentActorHint，直接按 hint 渲染按钮，不再走 schema 分支。
    // 使用 targetRoleIds 过滤：只有 actorRole 在 targetRoleIds 中才显示 hint。
    // ─────────────────────────────────────────────────────────────────────────
    const hint = gameState.ui?.currentActorHint;
    const hintApplies = hint && actorRole && hint.targetRoleIds.includes(actorRole);
    if (hintApplies) {
      if (hint.bottomAction === 'skipOnly') {
        return {
          buttons: [
            {
              key: 'skip',
              label: hint.message,
              intent: { type: 'skip', targetIndex: -1, message: hint.message },
            },
          ],
        };
      }
      if (hint.bottomAction === 'wolfEmptyOnly') {
        return {
          buttons: [
            {
              key: 'wolfEmpty',
              label: hint.message,
              intent: { type: 'wolfVote', targetIndex: -1, wolfSeat: actorSeatNumber ?? undefined },
            },
          ],
        };
      }
      // hint 存在但没有 bottomAction 指示 → 按正常 schema 处理
    }

    // wolfRobot learned hunter gate: must view status before continuing
    // Condition: learned hunter (regardless of canShootAsHunter true/false)
    // This gate takes precedence over other bottom actions when wolfRobot step is active
    if (
      currentSchema.id === 'wolfRobotLearn' &&
      gameState.wolfRobotReveal?.learnedRoleId === 'hunter' &&
      gameState.wolfRobotHunterStatusViewed === false
    ) {
      // Schema-driven: read button text from schema (fail-fast if missing)
      const gateButtonText = currentSchema.ui?.hunterGateButtonText;
      if (!gateButtonText) {
        throw new Error(
          '[useRoomActions] wolfRobotLearn schema missing ui.hunterGateButtonText - schema-driven UI requires this field',
        );
      }
      return {
        buttons: [
          {
            key: 'viewHunterStatus',
            label: gateButtonText,
            intent: { type: 'wolfRobotViewHunterStatus', targetIndex: -1 },
          },
        ],
      };
    }

    // wolfVote: show empty vote + cancel button when already voted
    if (currentSchema.kind === 'wolfVote') {
      const buttons: BottomButton[] = [];
      const voted = actorSeatNumber !== null && hasWolfVoted(actorSeatNumber);

      // Cancel vote button (withdraw = -2)
      if (voted) {
        buttons.push({
          key: 'wolfCancel',
          label: '取消投票',
          intent: {
            type: 'wolfVote',
            targetIndex: -2,
            wolfSeat: actorSeatNumber ?? undefined,
          },
        });
      }

      // Empty vote button (always available)
      buttons.push({
        key: 'wolfEmpty',
        label: currentSchema.ui!.emptyVoteText!,
        intent: {
          type: 'wolfVote',
          targetIndex: -1,
          wolfSeat: actorSeatNumber ?? undefined,
        },
      });

      return { buttons };
    }

    // chooseSeat/swap: honor canSkip
    // NOTE: witchSave/witchPoison are chooseSeat sub-steps and should allow bottom skip.
    if (currentSchema.kind === 'chooseSeat' || currentSchema.kind === 'swap') {
      if (!currentSchema.canSkip) return { buttons: [] };
      return {
        buttons: [
          {
            key: 'skip',
            label: currentSchema.ui!.bottomActionText!,
            intent: {
              type: 'skip',
              targetIndex: -1,
              message: currentSchema.ui!.bottomActionText!,
            },
          },
        ],
      };
    }

    // compound (witchAction): return two buttons (save + skip)
    // Schema-driven: save step is 'confirmTarget' (fixed target from WITCH_CONTEXT),
    //                poison step is 'chooseSeat' (user taps seat).
    // NOTE: Sensitive info is from WitchContextPayload only.
    if (
      currentSchema.kind === 'compound' &&
      currentSchema.id === 'witchAction' &&
      currentSchema.steps?.length
    ) {
      const witchCtx = getWitchContext();
      if (!witchCtx) return { buttons: [] };

      // Schema-driven: save is confirmTarget (target = killedSeat), poison is chooseSeat
      const saveStep = currentSchema.steps.find(
        (s) => s.key === 'save' && s.kind === 'confirmTarget',
      );
      const poisonStep = currentSchema.steps.find(
        (s) => s.key === 'poison' && s.kind === 'chooseSeat',
      );

      const buttons: BottomButton[] = [];

      // 1) Save button (confirmTarget): only show when kill exists and canSave.
      //    Target is fixed (witchCtx.killedSeat), user only confirms.
      if (saveStep && witchCtx.killedSeat >= 0 && witchCtx.canSave) {
        const label = `对${witchCtx.killedSeat + 1}号用解药`;
        buttons.push({
          key: 'save',
          label,
          intent: {
            type: 'actionConfirm',
            targetIndex: witchCtx.killedSeat,
            message: saveStep.ui?.confirmText,
            stepKey: 'save',
          },
        });
      }

      // 2) Skip button: always available; should mean save=false AND poison=false.
      // We route through RoomScreen with stepKey='skipAll' (not a schema step) to avoid dual-submit.
      // RoomScreen will translate this to extra {save:false, poison:false}.
      const skipLabel = poisonStep!.ui!.bottomActionText!;
      buttons.push({
        key: 'skip',
        label: skipLabel,
        intent: { type: 'skip', targetIndex: -1, message: skipLabel, stepKey: 'skipAll' },
      });

      return { buttons };
    }

    // confirm schema (hunterConfirm/darkWolfKingConfirm)
    // NOTE: Blocked case is already handled above (unified blocked check).
    // Here we only handle the normal (not blocked) case: show confirm button.
    if (currentSchema.kind === 'confirm') {
      return {
        buttons: [
          {
            key: 'confirm',
            label: currentSchema.ui!.bottomActionText!,
            intent: { type: 'confirmTrigger', targetIndex: -1 },
          },
        ],
      };
    }

    // skip: no generic bottom action
    return { buttons: [] };
  }, [
    gameState,
    getWitchContext,
    imActioner,
    isAudioPlaying,
    currentSchema,
    roomStatus,
    actorSeatNumber,
    actorRole,
    hasWolfVoted,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // Auto-trigger intent (for roles that popup on turn start)
  // Phase 3: Schema-driven - uses currentSchema.kind instead of role names
  // ─────────────────────────────────────────────────────────────────────────

  const getAutoTriggerIntent = useCallback((): ActionIntent | null => {
    if (!actorRole || !imActioner || isAudioPlaying) return null;

    // NOTE: Nightmare block is handled by Host resolver (Host-authoritative).
    // UI does NOT intercept or change prompt for blocked players.
    // All actions go through submit → Host validates → ACTION_REJECTED if blocked.
    // UI then reads gameState.actionRejected and shows the rejection alert.

    // wolfRobotLearn: suppress auto-trigger if wolfRobot has already completed learning
    // (wolfRobotReveal exists means learning is done - don't re-popup the action prompt)
    if (currentSchema?.id === 'wolfRobotLearn' && gameState?.wolfRobotReveal) {
      // WolfRobot has already learned a role - don't auto-trigger actionPrompt
      // If learned hunter, the hunter gate button will be shown instead
      // If learned other role, wait for Host to advance to next step
      return null;
    }

    // Schema-driven: compound schema (witch two-phase flow)
    if (currentSchema?.kind === 'compound') {
      // ANTI-CHEAT: 仅在 WitchContext 到达后才弹 prompt（避免没有 killedSeat 时误导 UI）。
      const witchCtx = getWitchContext();
      if (!witchCtx) return null;
      return { type: 'actionPrompt', targetIndex: -1 };
    }

    // Schema-driven: confirm schema (hunterConfirm/darkWolfKingConfirm)
    if (currentSchema?.kind === 'confirm') {
      return { type: 'actionPrompt', targetIndex: -1 };
    }

    // Schema-driven: swap schema (magician)
    // When first target is already selected (anotherIndex !== null),
    // do NOT re-trigger actionPrompt - user is selecting second target.
    if (currentSchema?.kind === 'swap') {
      if (anotherIndex !== null) {
        return null; // Suppress auto-trigger while selecting second seat
      }
      return { type: 'actionPrompt', targetIndex: -1 };
    }

    // All other schemas: show generic action prompt, dismiss → wait for seat tap
    return { type: 'actionPrompt', targetIndex: -1 };
  }, [
    actorRole,
    imActioner,
    isAudioPlaying,
    currentSchema,
    gameState?.wolfRobotReveal,
    getWitchContext,
    anotherIndex,
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
    (index: number): ActionIntent | null => {
      if (!actorRole) return null;

      // wolfRobotLearn: after learning is done (wolfRobotReveal exists),
      // seat taps have no effect. User must interact via bottom button only.
      if (currentSchema?.id === 'wolfRobotLearn' && gameState?.wolfRobotReveal) {
        return null;
      }

      // NOTE: Nightmare block is handled by Host resolver (Host-authoritative).
      // UI does NOT intercept seat taps for blocked players.
      // All seat taps go through submit → Host validates → ACTION_REJECTED if blocked.
      // UI then reads gameState.actionRejected and shows the rejection alert.

      // Delegate to pure helper for schema-driven intent derivation
      const schemaIntent = deriveIntentFromSchema({
        actorRole: actorRole,
        schemaKind: currentSchema?.kind,
        schemaId:
          currentSchema?.id && isValidSchemaId(currentSchema.id) ? currentSchema.id : undefined,
        uiRevealKind:
          currentSchema?.kind === 'chooseSeat' ? currentSchema.ui?.revealKind : undefined,
        index,
        anotherIndex,
        // Schema-driven wolf vote eligibility.
        // Participation is defined by ROLE_SPECS[*].wolfMeeting.participatesInWolfVote.
        // Do NOT additionally gate by isWolfRole(): the meeting participation flag is the
        // single source for whether this role can submit WOLF_VOTE during wolfKill.
        isWolf: doesRoleParticipateInWolfVote(actorRole),
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
      currentSchema,
      anotherIndex,
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
    const isWolf = doesRoleParticipateInWolfVote(actorRole);
    const wolfSeat = findVotingWolfSeat();
    return deriveSkipIntentFromSchema(
      actorRole,
      currentSchema,
      (idx) => buildActionMessage(idx),
      isWolf,
      wolfSeat,
    );
  }, [actorRole, currentSchema, findVotingWolfSeat, buildActionMessage]);

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
