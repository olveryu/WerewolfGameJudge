/**
 * useRoomActions.ts - Room action orchestration hook
 *
 * Coordinates player actions during night phase (tap handling, wolf vote, etc.)
 * but does NOT advance night phase. That is NightFlowController's job (host-side).
 *
 * ❌ Do NOT: advance game phase, call NightFlowController directly
 * ✅ Allowed: call submitAction/submitWolfVote, show dialogs, manage UI state
 */

import { useCallback, useEffect, useRef } from 'react';
import type { LocalGameState } from '../../../services/GameStateService';
import { RoomStatus } from '../../../models/Room';
import { getRoleModel, RoleName, isWolfRole } from '../../../models/roles';
import { showAlert } from '../../../utils/alert';

// ─────────────────────────────────────────────────────────────────────────────
// Parameter aggregation (per hard constraint: aggregate into 2-3 objects)
// ─────────────────────────────────────────────────────────────────────────────

export interface GameContext {
  /** Current game state from useGameRoom */
  gameState: LocalGameState | null;
  /** Current room status */
  roomStatus: RoomStatus;
  /** Current action role in night phase */
  currentActionRole: RoleName | null;
  /** Whether I'm an actioner this turn */
  imActioner: boolean;
  /** My seat number */
  mySeatNumber: number | null;
  /** My role */
  myRole: RoleName | null;
  /** Whether audio is playing */
  isAudioPlaying: boolean;
  /** Whether blocked by nightmare */
  isBlockedByNightmare: boolean;
}

export interface UiState {
  /** Current magician first-target selection (for two-target action) */
  anotherIndex: number | null;
  /** Setter for magician first-target */
  setAnotherIndex: (index: number | null) => void;
}

export interface ActionCallbacks {
  /** From useGameRoom: submit action result */
  submitAction: (targetIndex: number | null, extra?: Record<string, unknown>) => Promise<void>;
  /** From useGameRoom: submit wolf vote */
  submitWolfVote: (wolfSeat: number, targetSeat: number) => Promise<void>;
  /** From useGameRoom: check if wolf has voted */
  hasWolfVoted: (seatNumber: number) => boolean;
  /** Show action dialog for a role */
  showActionDialog: (role: RoleName) => void;
  /** Show action confirm dialog */
  showActionConfirmDialog: (targetIndex: number) => void;
  /** Show wolf vote confirm dialog */
  showWolfVoteConfirmDialog: (targetIndex: number) => void;
  /** Show hunter status dialog */
  showHunterStatusDialog: () => void;
  /** Show dark wolf king status dialog */
  showDarkWolfKingStatusDialog: () => void;
}

export interface UseRoomActionsResult {
  /** Handler for seat tap (delegates to seating or action based on status) */
  onSeatTapped: (index: number) => void;
  /** Handler for skip action button */
  handleSkipAction: () => void;
  /** Build action message for current actioner */
  buildActionMessage: (index: number, actingRole: RoleName) => string;
  /** Find which wolf seat should vote (for wolf vote flow) */
  findVotingWolfSeat: () => number | null;
  /** Perform the action (may show reveal dialog for seer/psychic) */
  performAction: (targetIndex: number) => void;
  /** Proceed with action submission */
  proceedWithAction: (targetIndex: number | null, extra?: Record<string, unknown>) => Promise<void>;
  /** Ref to proceedWithAction for stable callback reference */
  proceedWithActionRef: React.RefObject<((targetIndex: number | null, extra?: Record<string, unknown>) => Promise<void>) | null>;
}

/**
 * Orchestrates player actions during the game.
 * Does NOT advance the night phase (that's NightFlowController's job).
 */
export function useRoomActions(
  gameContext: GameContext,
  uiState: UiState,
  callbacks: ActionCallbacks
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
  } = gameContext;

  const { anotherIndex, setAnotherIndex } = uiState;

  const {
    submitAction,
    // submitWolfVote is used via showWolfVoteConfirmDialog, not directly here
    hasWolfVoted,
    showActionConfirmDialog,
    showWolfVoteConfirmDialog,
    showHunterStatusDialog,
    showDarkWolfKingStatusDialog,
  } = callbacks;

  // Ref for stable callback
  const proceedWithActionRef = useRef<((targetIndex: number | null, extra?: Record<string, unknown>) => Promise<void>) | null>(null);

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
  // Action handlers
  // ─────────────────────────────────────────────────────────────────────────

  const proceedWithAction = useCallback(async (targetIndex: number | null, extra?: Record<string, unknown>) => {
    await submitAction(targetIndex, extra);
  }, [submitAction]);

  // Keep ref in sync
  useEffect(() => {
    proceedWithActionRef.current = proceedWithAction;
  }, [proceedWithAction]);

  const performAction = useCallback((targetIndex: number) => {
    if (!gameState || !myRole) return;

    // Magician two-target handling
    if (myRole === 'magician' && anotherIndex !== null) {
      const target = anotherIndex + targetIndex * 100;
      setAnotherIndex(null);
      void proceedWithAction(target);
      return;
    }

    void proceedWithAction(targetIndex);
  }, [gameState, myRole, anotherIndex, setAnotherIndex, proceedWithAction]);

  const handleActionTap = useCallback((index: number) => {
    // Nightmare block: prevent action when blocked
    if (isBlockedByNightmare) {
      showAlert('技能被封锁', '你被梦魇恐惧，今晚无法使用技能。\n请点击"跳过"按钮。');
      return;
    }

    // Hunter and DarkWolfKing show status dialog instead
    if (myRole === 'hunter') {
      showHunterStatusDialog();
      return;
    }
    if (myRole === 'darkWolfKing') {
      showDarkWolfKingStatusDialog();
      return;
    }

    // Magician: first target selection
    if (myRole === 'magician' && anotherIndex === null) {
      setAnotherIndex(index);
      showAlert('已选择第一位玩家', `${index + 1}号，请选择第二位玩家`);
      return;
    }

    // Normal action confirm
    showActionConfirmDialog(index);
  }, [
    myRole,
    anotherIndex,
    setAnotherIndex,
    isBlockedByNightmare,
    showHunterStatusDialog,
    showDarkWolfKingStatusDialog,
    showActionConfirmDialog,
  ]);

  const onSeatTapped = useCallback((index: number) => {
    if (!gameState) return;

    // Block taps during audio
    if (roomStatus === RoomStatus.ongoing && isAudioPlaying) {
      return;
    }

    // During ongoing game, only actioners can tap to perform action
    if (roomStatus === RoomStatus.ongoing && imActioner) {
      handleActionTap(index);
    }
    // Note: seating taps (unseated/seated status) are handled separately
    // in RoomScreen via handleSeatingTap, not in this hook
  }, [gameState, roomStatus, isAudioPlaying, imActioner, handleActionTap]);

  const handleSkipAction = useCallback(() => {
    if (!myRole) return;

    // Wolf: vote for empty knife
    if (myRole === 'wolf' || (currentActionRole === 'wolf' && isWolfRole(myRole))) {
      showWolfVoteConfirmDialog(-1);
      return;
    }

    // Other roles: confirm skip
    showActionConfirmDialog(-1);
  }, [myRole, currentActionRole, showActionConfirmDialog, showWolfVoteConfirmDialog]);

  return {
    onSeatTapped,
    handleSkipAction,
    buildActionMessage,
    findVotingWolfSeat,
    performAction,
    proceedWithAction,
    proceedWithActionRef,
  };
}
