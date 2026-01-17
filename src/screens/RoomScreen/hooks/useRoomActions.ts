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
import type { LocalGameState } from '../../../services/types/GameStateTypes';
import { GameStatus } from '../../../models/Room';
import { RoleId, isWolfRole } from '../../../models/roles';
import type { ActionSchema, SchemaId, RevealKind } from '../../../models/roles/spec';
import { SCHEMAS, BLOCKED_UI_DEFAULTS, isValidSchemaId } from '../../../models/roles/spec';

// ─────────────────────────────────────────────────────────────────────────────
// ActionIntent Types (must be serializable - no callbacks/refs/functions)
// ─────────────────────────────────────────────────────────────────────────────

export type ActionIntentType =
  // Block
  | 'blocked' // Nightmare blocked

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
  mySeatNumber: number | null;
  myRole: RoleId | null;
  isAudioPlaying: boolean;
  isBlockedByNightmare: boolean;
  anotherIndex: number | null; // Magician first target
}

export interface ActionDeps {
  /** Check if wolf has voted */
  hasWolfVoted: (seatNumber: number) => boolean;

  /** UI-only: precomputed wolf-vote summary string (e.g. "1/3 狼人已投票"). */
  getWolfVoteSummary: () => string;
  /**
   * Get witch context from private inbox (ANTI-CHEAT: Zero-Trust)
   * Returns null if no WITCH_CONTEXT received for current turn
   * @see docs/phase4-final-migration.md
   */
  getWitchContext: () =>
    | import('../../../services/types/PrivateBroadcast').WitchContextPayload
    | null;
}

export interface UseRoomActionsResult {
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

  /** Merge magician two-target */
  getMagicianTarget: (secondIndex: number) => number;

  /** UI-only: if current actor is wolf, returns vote summary + (optional) my-seat suffix. */
  getWolfStatusLine: () => string | null;

  /** UI-only: schema-driven bottom action button view-model (visibility + label). */
  getBottomAction: () => BottomActionVM;
}

export interface BottomActionVM {
  buttons: BottomButton[];
}

export interface BottomButton {
  /** Stable key (align to schema step keys when possible). */
  key: string; // 'save' | 'skip' | 'wolfEmpty' ...
  label: string;
  intent: ActionIntent;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helper: derive intent from schema kind (extracted to reduce complexity)
// ─────────────────────────────────────────────────────────────────────────────

interface IntentContext {
  myRole: RoleId;
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
 * Pure helper used by getSkipIntent.
 * Exported for testability (avoid calling hooks directly in unit tests).
 */
export function deriveSkipIntentFromSchema(
  myRole: RoleId,
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

/** confirm schema: hunterConfirm/darkWolfKingConfirm (kept for future use) */
function _deriveConfirmIntent(ctx: IntentContext): ActionIntent {
  const { index, buildMessage } = ctx;
  return { type: 'actionConfirm', targetIndex: index, message: buildMessage(index) };
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
      if (!isValidSchemaId(ctx.schemaId)) return null;

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
    mySeatNumber,
    myRole,
    isAudioPlaying,
    // NOTE: isBlockedByNightmare is no longer used for intent derivation.
    // Nightmare block is handled by Host (ACTION_REJECTED). Kept in GameContext for UX hints only.
    isBlockedByNightmare,
    anotherIndex,
  } = gameContext;

  const { hasWolfVoted, getWolfVoteSummary, getWitchContext } = deps;

  // ─────────────────────────────────────────────────────────────────────────
  // Wolf vote helpers
  // ─────────────────────────────────────────────────────────────────────────

  const findVotingWolfSeat = useCallback((): number | null => {
    if (!gameState) return null;
    if (mySeatNumber !== null && myRole && isWolfRole(myRole) && !hasWolfVoted(mySeatNumber)) {
      return mySeatNumber;
    }
    return null;
  }, [gameState, mySeatNumber, myRole, hasWolfVoted]);

  // ─────────────────────────────────────────────────────────────────────────
  // Action message builder
  // ─────────────────────────────────────────────────────────────────────────

  const buildActionMessage = useCallback(
    (index: number): string => {
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

      // Keep dependencies explicit; index/anotherIndex affect action payload, not copy.
      void index;
      void anotherIndex;
      return confirmText || '';
    },
    [anotherIndex, currentSchema],
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
  // Magician two-target merge
  // ─────────────────────────────────────────────────────────────────────────

  const getMagicianTarget = useCallback(
    (secondIndex: number): number => {
      if (anotherIndex === null) {
        throw new Error('getMagicianTarget called without first target set');
      }
      return anotherIndex + secondIndex * 100;
    },
    [anotherIndex],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // UI-only: wolf status line for the action prompt area
  // ─────────────────────────────────────────────────────────────────────────

  const getWolfStatusLine = useCallback((): string | null => {
    if (!myRole || !isWolfRole(myRole)) return null;
    // Only show during the schema-driven wolf-vote step.
    if (currentSchema?.kind !== 'wolfVote') return null;

    const base = getWolfVoteSummary();
    if (mySeatNumber !== null && !hasWolfVoted(mySeatNumber)) {
      return base;
    }
    return `${base} (你已投票，等待其他狼人)`;
  }, [currentSchema?.kind, getWolfVoteSummary, hasWolfVoted, myRole, mySeatNumber]);

  // ─────────────────────────────────────────────────────────────────────────
  // UI-only: schema-driven bottom action button (skip / wolf empty vote / blocked)
  // ─────────────────────────────────────────────────────────────────────────

  const getBottomAction = useCallback((): BottomActionVM => {
    // Keep the same visibility rules previously in RoomScreen.
    if (!imActioner) return { buttons: [] };
    if (!gameState) return { buttons: [] };
    if (roomStatus !== GameStatus.ongoing) return { buttons: [] };
    if (isAudioPlaying) return { buttons: [] };

    // Nightmare blocked: UX-only skip button (Host still rejects illegal actions).
    // EXCEPTION: Blocked wolves during wolfVote should still use wolfVote intent (target=-1)
    // so that only their vote is recorded, not advancing the entire phase.
    if (isBlockedByNightmare) {
      if (currentSchema?.kind === 'wolfVote') {
        // Blocked wolf: send wolfVote with -1 (empty vote), not skip
        return {
          buttons: [
            {
              key: 'wolfEmpty',
              label: BLOCKED_UI_DEFAULTS.skipButtonText,
              intent: { type: 'wolfVote', targetIndex: -1 },
            },
          ],
        };
      }
      return {
        buttons: [
          {
            key: 'skip',
            label: BLOCKED_UI_DEFAULTS.skipButtonText,
            intent: { type: 'skip', targetIndex: -1, message: BLOCKED_UI_DEFAULTS.skipButtonText },
          },
        ],
      };
    }

    // Schema-driven bottom action visibility.
    if (!currentSchema) return { buttons: [] };

    // wolfVote: always allow empty vote (-1)
    if (currentSchema.kind === 'wolfVote') {
      return {
        buttons: [
          {
            key: 'wolfEmpty',
            label: currentSchema.ui?.emptyVoteText || '投票空刀',
            // NOTE: wolfSeat is derived by RoomScreen on intent handling; omit here.
            intent: { type: 'wolfVote', targetIndex: -1 },
          },
        ],
      };
    }

    // chooseSeat/swap: honor canSkip
    // NOTE: witchSave/witchPoison are chooseSeat sub-steps and should allow bottom skip.
    if (currentSchema.kind === 'chooseSeat' || currentSchema.kind === 'swap') {
      if (!currentSchema.canSkip) return { buttons: [] };
      return {
        buttons: [
          {
            key: 'skip',
            label: currentSchema.ui?.bottomActionText || '不使用技能',
            intent: {
              type: 'skip',
              targetIndex: -1,
              message: currentSchema.ui?.bottomActionText || '不使用技能',
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

      // Schema-driven: save is confirmTarget (target = killedIndex), poison is chooseSeat
      const saveStep = currentSchema.steps.find(
        (s) => s.key === 'save' && s.kind === 'confirmTarget',
      );
      const poisonStep = currentSchema.steps.find(
        (s) => s.key === 'poison' && s.kind === 'chooseSeat',
      );

      const buttons: BottomButton[] = [];

      // 1) Save button (confirmTarget): only show when kill exists and canSave.
      //    Target is fixed (witchCtx.killedIndex), user only confirms.
      if (saveStep && witchCtx.killedIndex >= 0 && witchCtx.canSave) {
        const label = `对${witchCtx.killedIndex + 1}号用解药`;
        buttons.push({
          key: 'save',
          label,
          intent: {
            type: 'actionConfirm',
            targetIndex: witchCtx.killedIndex,
            message: saveStep.ui?.confirmText,
            stepKey: 'save',
          },
        });
      }

      // 2) Skip button: always available; should mean save=false AND poison=false.
      // We route through RoomScreen with stepKey='skipAll' (not a schema step) to avoid dual-submit.
      // RoomScreen will translate this to extra {save:false, poison:false}.
      const skipLabel =
        poisonStep?.ui?.bottomActionText || saveStep?.ui?.bottomActionText || '不使用技能';
      buttons.push({
        key: 'skip',
        label: skipLabel,
        intent: { type: 'skip', targetIndex: -1, message: skipLabel, stepKey: 'skipAll' },
      });

      return { buttons };
    }

    // confirm schema (hunterConfirm/darkWolfKingConfirm): show bottom button to trigger status check
    if (currentSchema.kind === 'confirm') {
      return {
        buttons: [
          {
            key: 'confirm',
            label: currentSchema.ui?.bottomActionText || '查看发动状态',
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
    isBlockedByNightmare,
    currentSchema,
    roomStatus,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // Auto-trigger intent (for roles that popup on turn start)
  // Phase 3: Schema-driven - uses currentSchema.kind instead of role names
  // ─────────────────────────────────────────────────────────────────────────

  const getAutoTriggerIntent = useCallback((): ActionIntent | null => {
    if (!myRole || !imActioner || isAudioPlaying) return null;

    // Schema-driven: compound schema (witch two-phase flow)
    if (currentSchema?.kind === 'compound') {
      // ANTI-CHEAT: 仅在 WitchContext 到达后才弹 prompt（避免没有 killedIndex 时误导 UI）。
      const witchCtx = getWitchContext();
      if (!witchCtx) return null;
      return { type: 'actionPrompt', targetIndex: -1 };
    }

    // Schema-driven: confirm schema (hunterConfirm/darkWolfKingConfirm)
    if (currentSchema?.kind === 'confirm') {
      return { type: 'actionPrompt', targetIndex: -1 };
    }

    // All other schemas: show generic action prompt, dismiss → wait for seat tap
    return { type: 'actionPrompt', targetIndex: -1 };
  }, [myRole, imActioner, isAudioPlaying, currentSchema, getWitchContext]);

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
      if (!myRole) return null;

      // UX: Blocked players cannot tap seats to take action.
      // Return 'blocked' intent so UI can show "你被封锁了" feedback.
      if (isBlockedByNightmare) {
        return { type: 'blocked', targetIndex: index };
      }

      // Delegate to pure helper for schema-driven intent derivation
      const schemaIntent = deriveIntentFromSchema({
        myRole,
        schemaKind: currentSchema?.kind,
        schemaId:
          currentSchema?.id && isValidSchemaId(currentSchema.id) ? currentSchema.id : undefined,
        uiRevealKind:
          currentSchema?.kind === 'chooseSeat' ? currentSchema.ui?.revealKind : undefined,
        index,
        anotherIndex,
        isWolf: isWolfRole(myRole),
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
    [myRole, currentSchema, anotherIndex, findVotingWolfSeat, buildActionMessage, isBlockedByNightmare],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Get skip intent
  // Phase 3: Schema-driven
  // ─────────────────────────────────────────────────────────────────────────

  const getSkipIntent = useCallback((): ActionIntent | null => {
    if (!myRole) return null;

    const isWolf = isWolfRole(myRole);
    const wolfSeat = findVotingWolfSeat();
    return deriveSkipIntentFromSchema(
      myRole,
      currentSchema,
      (idx) => buildActionMessage(idx),
      isWolf,
      wolfSeat,
    );
  }, [myRole, currentSchema, findVotingWolfSeat, buildActionMessage]);

  return {
    getActionIntent,
    getSkipIntent,
    getAutoTriggerIntent,
    buildActionMessage,
    findVotingWolfSeat,
    canTapForAction,
    getMagicianTarget,
    getWolfStatusLine,
    getBottomAction,
  };
}
