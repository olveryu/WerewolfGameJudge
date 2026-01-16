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
import { RoomStatus } from '../../../models/Room';
import { getRoleDisplayInfo, RoleName, isWolfRole } from '../../../models/roles';
import type { ActionSchema, SchemaId, RevealKind } from '../../../models/roles/spec';
import { SCHEMAS } from '../../../models/roles/spec';
import { isValidSchemaId } from '../../../models/roles/spec';

// ─────────────────────────────────────────────────────────────────────────────
// ActionIntent Types (must be serializable - no callbacks/refs/functions)
// ─────────────────────────────────────────────────────────────────────────────

export type ActionIntentType =
  // Block
  | 'blocked'              // Nightmare blocked
  
  // Reveal (ANTI-CHEAT: RoomScreen only waits for private reveal + sends ack)
  | 'reveal'
  
  // Witch (schema-driven)
  
  // Two-step
  | 'magicianFirst'        // Magician first target
  
  // Vote/Confirm
  | 'wolfVote'             // Wolf vote
  | 'actionConfirm'        // Normal action confirm
  | 'skip'                 // Skip action
  
  // Auto-trigger prompt (dismiss → wait for seat tap)
  | 'actionPrompt';        // Generic action prompt for all roles

export interface ActionIntent {
  type: ActionIntentType;
  targetIndex: number;
  
  // Optional fields (based on type)
  wolfSeat?: number;           // for wolfVote
  revealKind?: RevealKind;      // for reveal
  message?: string;            // for actionConfirm
  
}

// ─────────────────────────────────────────────────────────────────────────────
// Context & Dependencies
// ─────────────────────────────────────────────────────────────────────────────

export interface GameContext {
  gameState: LocalGameState | null;
  roomStatus: RoomStatus;
  currentActionRole: RoleName | null;
  currentSchema: ActionSchema | null;       // Phase 3: schema for current action role
  imActioner: boolean;
  mySeatNumber: number | null;
  myRole: RoleName | null;
  isAudioPlaying: boolean;
  isBlockedByNightmare: boolean;
  anotherIndex: number | null;              // Magician first target
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
  getWitchContext: () => import('../../../services/types/PrivateBroadcast').WitchContextPayload | null;
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
  visible: boolean;
  label: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helper: derive intent from schema kind (extracted to reduce complexity)
// ─────────────────────────────────────────────────────────────────────────────

interface IntentContext {
  myRole: RoleName;
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
  myRole: RoleName,
  currentSchema: ActionSchema | null | undefined,
  buildMessage: (idx: number) => string,
  isWolf: boolean,
  wolfSeat: number | null
): ActionIntent | null {
  // chooseSeat schemas: only allow generic skip when schema allows skipping
  if (currentSchema?.kind === 'chooseSeat') {
    if (currentSchema.canSkip) {
      return { type: 'skip', targetIndex: -1, message: buildMessage(-1) };
    }
    return null;
  }

  // wolfVote schema: skip means "vote empty knife" (handled elsewhere as wolfVote intent)
  if (currentSchema?.kind === 'wolfVote' && isWolf && wolfSeat !== null) {
    return { type: 'wolfVote', targetIndex: -1, wolfSeat };
  }

  // default: confirm skip
  return { type: 'skip', targetIndex: -1, message: buildMessage(-1) };
}

/** confirm schema: hunterConfirm/darkWolfKingConfirm */
function deriveConfirmIntent(ctx: IntentContext): ActionIntent {
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
      return deriveConfirmIntent(ctx);
    case 'swap':
      return anotherIndex === null ? { type: 'magicianFirst', targetIndex: index } : null;
    case 'compound':
  // compound 行为统一交给 RoomScreen 的通用 actionPrompt/skip/actionConfirm 流程处理。
  // 这里不再做 role-specific 的“poison/confirm”分支，避免 UI 层维护 witchPhase。
  return null;
    case 'wolfVote':
      return isWolf && wolfSeat !== null ? { type: 'wolfVote', targetIndex: index, wolfSeat } : null;
    case 'chooseSeat':
      return deriveChooseSeatIntent(ctx);
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook Implementation
// ─────────────────────────────────────────────────────────────────────────────

export function useRoomActions(
  gameContext: GameContext,
  deps: ActionDeps
): UseRoomActionsResult {
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

      // Contract: chooseSeat schemas must provide schema.ui.confirmText.
      // We still keep a tiny final fallback here to avoid crashing in dev if a schema is incomplete.
      // (UI copy should not quietly drift away from schema-driven source of truth.)
      const fallback = '确认操作？';

      if (confirmText) {
        return confirmText;
      }

      if (index === -1) {
        // Skip confirm
        return fallback;
      }
      if (anotherIndex === null) {
        return fallback;
      }
      return fallback;
    },
    [anotherIndex, currentSchema]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Can tap for action
  // ─────────────────────────────────────────────────────────────────────────

  const canTapForAction = useCallback((): boolean => {
    if (!gameState) return false;
    if (roomStatus !== RoomStatus.ongoing) return false;
    if (isAudioPlaying) return false;
    if (!imActioner) return false;
    return true;
  }, [gameState, roomStatus, isAudioPlaying, imActioner]);

  // ─────────────────────────────────────────────────────────────────────────
  // Magician two-target merge
  // ─────────────────────────────────────────────────────────────────────────

  const getMagicianTarget = useCallback((secondIndex: number): number => {
    if (anotherIndex === null) {
      throw new Error('getMagicianTarget called without first target set');
    }
    return anotherIndex + secondIndex * 100;
  }, [anotherIndex]);

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
    if (!imActioner) return { visible: false, label: '' };
    if (!gameState) return { visible: false, label: '' };
    if (roomStatus !== RoomStatus.ongoing) return { visible: false, label: '' };
    if (isAudioPlaying) return { visible: false, label: '' };

    // Nightmare blocked: UX-only skip button (Host still rejects illegal actions).
    if (isBlockedByNightmare) {
      return { visible: true, label: '跳过（技能被封锁）' };
    }

    // Schema-driven bottom action visibility.
    if (!currentSchema) return { visible: false, label: '' };

    // wolfVote: always allow empty vote (-1)
    if (currentSchema.kind === 'wolfVote') {
      return { visible: true, label: currentSchema.ui?.emptyVoteText || '投票空刀' };
    }

    // chooseSeat/swap: honor canSkip
    // NOTE: witchSave/witchPoison are chooseSeat sub-steps and should allow bottom skip.
    if (currentSchema.kind === 'chooseSeat' || currentSchema.kind === 'swap') {
      if (!currentSchema.canSkip) return { visible: false, label: '' };
      return { visible: true, label: currentSchema.ui?.bottomActionText || '不使用技能' };
    }

    // compound/confirm/skip: no generic bottom action
    return { visible: false, label: '' };
  }, [gameState, roomStatus, currentSchema, imActioner, isAudioPlaying, isBlockedByNightmare]);

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

  const getActionIntent = useCallback((index: number): ActionIntent | null => {
    if (!myRole) return null;

    // NOTE: Nightmare block is now handled by Host (ACTION_REJECTED).
    // Do NOT check isBlockedByNightmare here - let the action go to Host for validation.

    // Delegate to pure helper for schema-driven intent derivation
    const schemaIntent = deriveIntentFromSchema({
      myRole,
      schemaKind: currentSchema?.kind,
  schemaId: currentSchema?.id && isValidSchemaId(currentSchema.id) ? currentSchema.id : undefined,
      uiRevealKind:
        currentSchema?.kind === 'chooseSeat'
          ? currentSchema.ui?.revealKind
          : undefined,
      index,
      anotherIndex,
      isWolf: isWolfRole(myRole),
      wolfSeat: findVotingWolfSeat(),
      buildMessage: (idx) => buildActionMessage(idx),
    });

    if (schemaIntent) return schemaIntent;

    // Default fallback: normal action confirm
  const message = buildActionMessage(index);
    return { type: 'actionConfirm', targetIndex: index, message };
  }, [
    myRole,
    currentSchema,
    anotherIndex,
    findVotingWolfSeat,
    buildActionMessage,
  ]);

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
      wolfSeat
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
