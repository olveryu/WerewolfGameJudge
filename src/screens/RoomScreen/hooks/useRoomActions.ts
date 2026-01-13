/**
 * useRoomActions.ts - Room action orchestration hook (Intent Layer)
 *
 * Provides pure logic for determining what action to take when user interacts.
 * Returns ActionIntent objects that RoomScreen orchestrator handles.
 *
 * ❌ Do NOT: call dialogs, import services/nightFlow/supabase, call Room model functions
 * ✅ Allowed: pure logic, return ActionIntent, helper functions
 */

import { useCallback } from 'react';
import type { LocalGameState } from '../../../services/types/GameStateTypes';
import { RoomStatus } from '../../../models/Room';
import { getRoleModel, RoleName, isWolfRole } from '../../../models/roles';

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
  /** Get killed player index (provided by RoomScreen from gameState) */
  getKilledIndex: () => number;
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
// Hook Implementation
// ─────────────────────────────────────────────────────────────────────────────

export function useRoomActions(
  gameContext: GameContext,
  deps: ActionDeps
): UseRoomActionsResult {
  const {
    gameState,
    roomStatus,
    currentActionRole,
    imActioner,
    mySeatNumber,
    myRole,
    isAudioPlaying,
    isBlockedByNightmare,
    anotherIndex,
    witchPhase,
  } = gameContext;

  const { hasWolfVoted, getKilledIndex } = deps;

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
    const roleModel = getRoleModel(actingRole);
    const actionConfirmMessage = roleModel?.actionConfirmMessage || '对';

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
  // ─────────────────────────────────────────────────────────────────────────

  const getAutoTriggerIntent = useCallback((): ActionIntent | null => {
    if (!myRole || !imActioner || isAudioPlaying) return null;

    // Witch: auto-trigger when becoming actioner (two-phase flow)
    // witchPhase === null means just became actioner → start with save phase
    // witchPhase === 'save' means we need to show save dialog
    // witchPhase === 'poison' means we need to show poison prompt
    if (myRole === 'witch') {
      if (witchPhase === null || witchPhase === 'save') {
        const killedIndex = getKilledIndex();
        const canSave = killedIndex !== -1 && killedIndex !== mySeatNumber;
        return {
          type: 'witchSavePhase',
          targetIndex: killedIndex,
          killedIndex,
          canSave,
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

    // Hunter: auto-trigger status dialog, click "确定" → proceedWithAction(null)
    if (myRole === 'hunter') {
      return { type: 'hunterStatus', targetIndex: -1 };
    }

    // DarkWolfKing: auto-trigger status dialog, click "确定" → proceedWithAction(null)
    if (myRole === 'darkWolfKing') {
      return { type: 'darkWolfKingStatus', targetIndex: -1 };
    }

    // All other roles: show generic action prompt, dismiss → wait for seat tap
    return { type: 'actionPrompt', targetIndex: -1 };
  }, [myRole, imActioner, isAudioPlaying, witchPhase, mySeatNumber, getKilledIndex]);

  // ─────────────────────────────────────────────────────────────────────────
  // Get action intent when seat is tapped
  // ─────────────────────────────────────────────────────────────────────────

  const getActionIntent = useCallback((index: number): ActionIntent | null => {
    if (!myRole) return null;

    // Nightmare block
    if (isBlockedByNightmare) {
      return { type: 'blocked', targetIndex: index };
    }

    // Hunter shows status dialog
    if (myRole === 'hunter') {
      return { type: 'hunterStatus', targetIndex: index };
    }

    // DarkWolfKing shows status dialog
    if (myRole === 'darkWolfKing') {
      return { type: 'darkWolfKingStatus', targetIndex: index };
    }

    // Magician first target selection
    if (myRole === 'magician' && anotherIndex === null) {
      return { type: 'magicianFirst', targetIndex: index };
    }

    // Seer reveal
    if (myRole === 'seer') {
      return { type: 'seerReveal', targetIndex: index };
    }

    // Psychic reveal
    if (myRole === 'psychic') {
      return { type: 'psychicReveal', targetIndex: index };
    }

    // Witch poison phase - tap seat to poison
    if (myRole === 'witch' && witchPhase === 'poison') {
      const message = `确定要毒杀${index + 1}号玩家吗？`;
      return {
        type: 'witchPoison',
        targetIndex: index,
        message,
      };
    }

    // Wolf vote flow
    if (currentActionRole === 'wolf' && isWolfRole(myRole)) {
      const wolfSeat = findVotingWolfSeat();
      if (wolfSeat !== null) {
        return { type: 'wolfVote', targetIndex: index, wolfSeat };
      }
    }

    // Normal action confirm
    const message = buildActionMessage(index, myRole);
    return { type: 'actionConfirm', targetIndex: index, message };
  }, [
    myRole,
    isBlockedByNightmare,
    anotherIndex,
    witchPhase,
    currentActionRole,
    findVotingWolfSeat,
    buildActionMessage,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // Get skip intent
  // ─────────────────────────────────────────────────────────────────────────

  const getSkipIntent = useCallback((): ActionIntent | null => {
    if (!myRole) return null;

    // Wolf: vote for empty knife
    if (currentActionRole === 'wolf' && isWolfRole(myRole)) {
      const wolfSeat = findVotingWolfSeat();
      if (wolfSeat !== null) {
        return { type: 'wolfVote', targetIndex: -1, wolfSeat };
      }
    }

    // Other roles: confirm skip
    const message = buildActionMessage(-1, myRole);
    return { type: 'skip', targetIndex: -1, message };
  }, [myRole, currentActionRole, findVotingWolfSeat, buildActionMessage]);

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
