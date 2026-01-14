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
import type { ActionSchema } from '../../../models/roles/spec';

// ─────────────────────────────────────────────────────────────────────────────
// ActionIntent Types (must be serializable - no callbacks/refs/functions)
// ─────────────────────────────────────────────────────────────────────────────

export type ActionIntentType =
  // Block
  | 'blocked'              // Nightmare blocked
  
  // Special role status
  | 'hunterStatus'         // Hunter view status
  | 'darkWolfKingStatus'   // DarkWolfKing view status
  
  // Reveal (RoomScreen calculates result)
  | 'seerReveal'           // Seer check
  | 'psychicReveal'        // Psychic check
  | 'gargoyleReveal'       // Gargoyle check
  | 'wolfRobotReveal'      // Wolf Robot learn identity
  
  // Witch two-phase
  | 'witchSavePhase'       // Witch save phase (auto-trigger)
  | 'witchPoisonPhase'     // Witch poison phase (after save)
  | 'witchPoison'          // Witch poison confirm (tap seat)
  
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
  message?: string;            // for actionConfirm
  
  // Witch specific
  killedIndex?: number;        // for witchSavePhase
  canSave?: boolean;           // for witchSavePhase
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
  witchPhase: 'save' | 'poison' | null;     // Witch current phase
}

export interface ActionDeps {
  /** Check if wolf has voted */
  hasWolfVoted: (seatNumber: number) => boolean;
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
  buildActionMessage: (index: number, actingRole: RoleName) => string;
  
  /** Find voting wolf seat */
  findVotingWolfSeat: () => number | null;
  
  /** Check if can tap for action */
  canTapForAction: () => boolean;
  
  /** Merge magician two-target */
  getMagicianTarget: (secondIndex: number) => number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helper: derive intent from schema kind (extracted to reduce complexity)
// ─────────────────────────────────────────────────────────────────────────────

interface IntentContext {
  myRole: RoleName;
  schemaKind: ActionSchema['kind'] | undefined;
  index: number;
  anotherIndex: number | null;
  witchPhase: 'save' | 'poison' | null;
  isWolf: boolean;
  wolfSeat: number | null;
  buildMessage: (idx: number) => string;
}

/** confirm schema: hunter/darkWolfKing status dialog */
function deriveConfirmIntent(ctx: IntentContext): ActionIntent {
  const { myRole, index, buildMessage } = ctx;
  if (myRole === 'hunter') return { type: 'hunterStatus', targetIndex: index };
  if (myRole === 'darkWolfKing') return { type: 'darkWolfKingStatus', targetIndex: index };
  return { type: 'actionConfirm', targetIndex: index, message: buildMessage(index) };
}

/** chooseSeat schema: seer/psychic/gargoyle/wolfRobot reveal, or normal action */
function deriveChooseSeatIntent(ctx: IntentContext): ActionIntent {
  const { myRole, index, buildMessage } = ctx;
  if (myRole === 'seer') return { type: 'seerReveal', targetIndex: index };
  if (myRole === 'psychic') return { type: 'psychicReveal', targetIndex: index };
  if (myRole === 'gargoyle') return { type: 'gargoyleReveal', targetIndex: index };
  if (myRole === 'wolfRobot') return { type: 'wolfRobotReveal', targetIndex: index };
  return { type: 'actionConfirm', targetIndex: index, message: buildMessage(index) };
}

/**
 * Derives ActionIntent from schema kind. Pure function (no hooks).
 * Uses focused sub-helpers to keep each branch simple.
 */
function deriveIntentFromSchema(ctx: IntentContext): ActionIntent | null {
  const { schemaKind, index, anotherIndex, witchPhase, isWolf, wolfSeat } = ctx;

  switch (schemaKind) {
    case 'confirm':
      return deriveConfirmIntent(ctx);
    case 'swap':
      return anotherIndex === null ? { type: 'magicianFirst', targetIndex: index } : null;
    case 'compound':
      return witchPhase === 'poison'
        ? { type: 'witchPoison', targetIndex: index, message: `确定要毒杀${index + 1}号玩家吗？` }
        : null;
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
    isBlockedByNightmare,
    anotherIndex,
    witchPhase,
  } = gameContext;

  const { hasWolfVoted, getWitchContext } = deps;

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

  const buildActionMessage = useCallback((index: number, actingRole: RoleName): string => {
    const roleInfo = getRoleDisplayInfo(actingRole);
    const actionConfirmMessage = roleInfo?.actionConfirmMessage || '对';

    if (index === -1) {
      return '确定不发动技能吗？';
    }
    if (anotherIndex === null) {
      return `确定${actionConfirmMessage}${index + 1}号玩家?`;
    }
    return `确定${actionConfirmMessage}${index + 1}号和${anotherIndex + 1}号玩家?`;
  }, [anotherIndex]);

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
  // Auto-trigger intent (for roles that popup on turn start)
  // Phase 3: Schema-driven - uses currentSchema.kind instead of role names
  // ─────────────────────────────────────────────────────────────────────────

  const getAutoTriggerIntent = useCallback((): ActionIntent | null => {
    if (!myRole || !imActioner || isAudioPlaying) return null;

    // Schema-driven: compound schema (witch two-phase flow)
    if (currentSchema?.kind === 'compound') {
      // witchPhase === null means just became actioner → start with save phase
      // witchPhase === 'save' means we need to show save dialog
      // witchPhase === 'poison' means we need to show poison prompt
      if (witchPhase === null || witchPhase === 'save') {
        // ANTI-CHEAT: Read witch context from private inbox (Zero-Trust)
        // Returns null if Host hasn't sent WITCH_CONTEXT yet
        const witchCtx = getWitchContext();
        if (!witchCtx) {
          // Still waiting for private message - don't trigger yet
          return null;
        }
        // Host already calculated canSave (including self-save check)
        return {
          type: 'witchSavePhase',
          targetIndex: witchCtx.killedIndex,
          killedIndex: witchCtx.killedIndex,
          canSave: witchCtx.canSave,
        };
      }
      if (witchPhase === 'poison') {
        return {
          type: 'witchPoisonPhase',
          targetIndex: -1,
        };
      }
      return null;
    }

    // Schema-driven: confirm schema (hunter/darkWolfKing status dialog)
    if (currentSchema?.kind === 'confirm') {
      // Use role-specific intent type for backward compatibility
      if (myRole === 'hunter') {
        return { type: 'hunterStatus', targetIndex: -1 };
      }
      if (myRole === 'darkWolfKing') {
        return { type: 'darkWolfKingStatus', targetIndex: -1 };
      }
      // Fallback for future confirm roles
      return { type: 'actionPrompt', targetIndex: -1 };
    }

    // All other schemas: show generic action prompt, dismiss → wait for seat tap
    return { type: 'actionPrompt', targetIndex: -1 };
  }, [myRole, imActioner, isAudioPlaying, currentSchema, witchPhase, getWitchContext]);

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

    // Nightmare block (applies to all schemas)
    if (isBlockedByNightmare) {
      return { type: 'blocked', targetIndex: index };
    }

    // Delegate to pure helper for schema-driven intent derivation
    const schemaIntent = deriveIntentFromSchema({
      myRole,
      schemaKind: currentSchema?.kind,
      index,
      anotherIndex,
      witchPhase,
      isWolf: isWolfRole(myRole),
      wolfSeat: findVotingWolfSeat(),
      buildMessage: (idx) => buildActionMessage(idx, myRole),
    });

    if (schemaIntent) return schemaIntent;

    // Default fallback: normal action confirm
    const message = buildActionMessage(index, myRole);
    return { type: 'actionConfirm', targetIndex: index, message };
  }, [
    myRole,
    isBlockedByNightmare,
    currentSchema,
    anotherIndex,
    witchPhase,
    findVotingWolfSeat,
    buildActionMessage,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // Get skip intent
  // Phase 3: Schema-driven
  // ─────────────────────────────────────────────────────────────────────────

  const getSkipIntent = useCallback((): ActionIntent | null => {
    if (!myRole) return null;

    // Schema-driven: wolfVote schema (vote for empty knife)
    if (currentSchema?.kind === 'wolfVote' && isWolfRole(myRole)) {
      const wolfSeat = findVotingWolfSeat();
      if (wolfSeat !== null) {
        return { type: 'wolfVote', targetIndex: -1, wolfSeat };
      }
    }

    // Other schemas: confirm skip
    const message = buildActionMessage(-1, myRole);
    return { type: 'skip', targetIndex: -1, message };
  }, [myRole, currentSchema, findVotingWolfSeat, buildActionMessage]);

  return {
    getActionIntent,
    getSkipIntent,
    getAutoTriggerIntent,
    buildActionMessage,
    findVotingWolfSeat,
    canTapForAction,
    getMagicianTarget,
  };
}
