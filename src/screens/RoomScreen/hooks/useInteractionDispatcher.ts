/**
 * useInteractionDispatcher.ts - Interaction policy dispatcher & seat tap handlers
 *
 * ✅ Allowed:
 *   - Build InteractionContext from game state / actor identity
 *   - Call RoomInteractionPolicy (pure logic) and execute resulting instructions
 *   - Own dispatchInteraction, onSeatTapped, onSeatLongPressed
 *   - Execute side effects: showAlert, showDialog, navigation, role card, bot takeover
 *
 * ❌ Do NOT:
 *   - Contain business rules / action processing (that's useActionOrchestrator)
 *   - Import services directly
 *   - Own night flow / audio logic
 *   - Render UI or hold JSX
 *   - Duplicate any policy logic (single-source-of-truth is policy layer)
 */

import { useCallback, useMemo } from 'react';

import { GameStatus } from '@/models/GameStatus';
import type { RoleId } from '@/models/roles';
import {
  getInteractionResult,
  type InteractionContext,
  type InteractionEvent,
} from '@/screens/RoomScreen/policy';
import type { LocalGameState } from '@/types/GameStateTypes';
import { showAlert } from '@/utils/alert';
import { roomScreenLog } from '@/utils/logger';

import type { ActionIntent } from './useRoomActions';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface UseInteractionDispatcherParams {
  // ── Game state ──
  gameState: LocalGameState | null;
  roomStatus: GameStatus;
  isAudioPlaying: boolean;
  isHost: boolean;
  imActioner: boolean;

  // ── Gate state (from useActionOrchestrator) ──
  pendingRevealDialog: boolean;
  pendingHunterStatusViewed: boolean;

  // ── Identity ──
  mySeatNumber: number | null;
  myRole: RoleId | null;
  actorSeatForUi: number | null;
  actorRoleForUi: RoleId | null;
  effectiveSeat: number | null;

  // ── Debug mode ──
  isDebugMode: boolean;
  controlledSeat: number | null;
  isDelegating: boolean;

  // ── Action intent handler (from useActionOrchestrator) ──
  handleActionIntent: (intent: ActionIntent) => Promise<void>;
  getActionIntent: (seat: number) => ActionIntent | null;

  // ── Dialog callbacks ──
  showEnterSeatDialog: (seat: number) => void;
  showLeaveSeatDialog: (seat: number) => void;
  handleLeaveRoom: () => void;
  viewedRole: () => Promise<void>;

  // ── Host dialogs ──
  handleSettingsPress: () => void;
  showPrepareToFlipDialog: () => void;
  showStartGameDialog: () => void;
  showLastNightInfoDialog: () => void;
  showRestartDialog: () => void;

  // ── Submission callbacks ──
  submitRevealAckSafe: (role: 'seer' | 'psychic' | 'gargoyle' | 'wolfRobot') => void;
  sendWolfRobotHunterStatusViewed: (seat: number) => Promise<void>;
  setControlledSeat: (seat: number | null) => void;

  // ── Role card state setters (owned by RoomScreen) ──
  setPendingRevealDialog: (v: boolean) => void;
  setRoleCardVisible: (v: boolean) => void;
  setShouldPlayRevealAnimation: (v: boolean) => void;
}

interface UseInteractionDispatcherResult {
  /** Unified interaction entry point — calls policy → executes side effects. */
  dispatchInteraction: (event: InteractionEvent) => void;
  /** Main seat tap handler — wraps dispatchInteraction with SEAT_TAP event. */
  onSeatTapped: (seat: number, disabledReason?: string) => void;
  /** Seat long-press handler for bot takeover (debug mode). */
  onSeatLongPressed: (seat: number) => void;
  /** Computed interaction context (exposed for BottomActionPanel / tests). */
  interactionContext: InteractionContext;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useInteractionDispatcher({
  gameState,
  roomStatus,
  isAudioPlaying,
  isHost,
  imActioner,
  pendingRevealDialog,
  pendingHunterStatusViewed,
  mySeatNumber,
  myRole,
  actorSeatForUi,
  actorRoleForUi,
  effectiveSeat,
  isDebugMode,
  controlledSeat,
  isDelegating,
  handleActionIntent,
  getActionIntent,
  showEnterSeatDialog,
  showLeaveSeatDialog,
  handleLeaveRoom,
  viewedRole,
  handleSettingsPress,
  showPrepareToFlipDialog,
  showStartGameDialog,
  showLastNightInfoDialog,
  showRestartDialog,
  submitRevealAckSafe,
  sendWolfRobotHunterStatusViewed,
  setControlledSeat,
  setPendingRevealDialog,
  setRoleCardVisible,
  setShouldPlayRevealAnimation,
}: UseInteractionDispatcherParams): UseInteractionDispatcherResult {
  // ─── Seat tap sub-handlers ───────────────────────────────────────────────

  const handleSeatingTap = useCallback(
    (seat: number) => {
      if (mySeatNumber !== null && seat === mySeatNumber) {
        showLeaveSeatDialog(seat);
      } else {
        showEnterSeatDialog(seat);
      }
    },
    [mySeatNumber, showLeaveSeatDialog, showEnterSeatDialog],
  );

  const handleActionTap = useCallback(
    (seat: number) => {
      const intent = getActionIntent(seat);
      if (intent) {
        void handleActionIntent(intent).catch((err) =>
          roomScreenLog.error('[handleActionTap] Unhandled error in handleActionIntent', err),
        );
      }
    },
    [getActionIntent, handleActionIntent],
  );

  // ─── Interaction context ─────────────────────────────────────────────────

  const interactionContext: InteractionContext = useMemo(
    () => ({
      roomStatus,
      hasGameState: !!gameState,
      isAudioPlaying,
      pendingRevealAck: pendingRevealDialog,
      pendingHunterGate: pendingHunterStatusViewed,
      isHost,
      imActioner,
      // Real identity (for display purposes only)
      mySeatNumber,
      myRole,
      // Actor identity (for all action-related decisions)
      actorSeatForUi,
      actorRoleForUi,
      // Debug mode fields
      isDebugMode,
      controlledSeat,
      isDelegating,
      getBotSeats: () => {
        if (!gameState) return [];
        return Array.from(gameState.players.entries())
          .filter(([, player]) => player?.isBot)
          .map(([seat]) => seat);
      },
    }),
    [
      roomStatus,
      gameState,
      isAudioPlaying,
      pendingRevealDialog,
      pendingHunterStatusViewed,
      isHost,
      imActioner,
      mySeatNumber,
      myRole,
      actorSeatForUi,
      actorRoleForUi,
      isDebugMode,
      controlledSeat,
      isDelegating,
    ],
  );

  // ─── Unified dispatcher ──────────────────────────────────────────────────

  const dispatchInteraction = useCallback(
    (event: InteractionEvent) => {
      const result = getInteractionResult(interactionContext, event);

      switch (result.kind) {
        case 'NOOP':
          roomScreenLog.debug('[dispatchInteraction] NOOP', {
            reason: result.reason,
            event: event.kind,
          });
          return;

        case 'ALERT':
          roomScreenLog.debug('[dispatchInteraction] ALERT', { title: result.title });
          showAlert(result.title, result.message, [{ text: '好' }]);
          return;

        case 'SHOW_DIALOG':
          switch (result.dialogType) {
            case 'seatingEnter':
              if (result.seat !== undefined) showEnterSeatDialog(result.seat);
              return;
            case 'seatingLeave':
              if (result.seat !== undefined) showLeaveSeatDialog(result.seat);
              return;
            case 'roleCard':
              {
                roomScreenLog.debug('[dispatchInteraction] Show roleCard', { effectiveSeat });
                const effectivePlayer =
                  effectiveSeat === null ? null : gameState?.players.get(effectiveSeat);
                const needAnimation = !(effectivePlayer?.hasViewedRole ?? false);
                setShouldPlayRevealAnimation(needAnimation);
                setRoleCardVisible(true);
                void viewedRole();
              }
              return;
            case 'leaveRoom':
              roomScreenLog.debug('[dispatchInteraction] Show leaveRoom dialog');
              handleLeaveRoom();
              return;
          }
          return;

        case 'SEATING_FLOW':
          roomScreenLog.debug('[dispatchInteraction] SEATING_FLOW', {
            seat: result.seat,
          });
          handleSeatingTap(result.seat);
          return;

        case 'ACTION_FLOW':
          if (result.intent) {
            void handleActionIntent(result.intent).catch((err) =>
              roomScreenLog.error('[ACTION_FLOW] Unhandled error in handleActionIntent', err),
            );
          } else if (result.seat !== undefined) {
            handleActionTap(result.seat);
          }
          return;

        case 'HOST_CONTROL':
          roomScreenLog.debug('[dispatchInteraction] HOST_CONTROL', { action: result.action });
          switch (result.action) {
            case 'settings':
              handleSettingsPress();
              return;
            case 'prepareToFlip':
              showPrepareToFlipDialog();
              return;
            case 'startGame':
              showStartGameDialog();
              return;
            case 'lastNightInfo':
              showLastNightInfoDialog();
              return;
            case 'restart':
              showRestartDialog();
              return;
          }
          return;

        case 'REVEAL_ACK':
          roomScreenLog.debug('[dispatchInteraction] REVEAL_ACK', {
            revealRole: result.revealRole,
          });
          submitRevealAckSafe(result.revealRole);
          setPendingRevealDialog(false);
          return;

        case 'HUNTER_STATUS_VIEWED':
          if (pendingHunterStatusViewed) {
            roomScreenLog.debug(
              '[HUNTER_STATUS_VIEWED] Skipping - pending submission (duplicate prevention)',
            );
            return;
          }
          if (effectiveSeat === null) {
            roomScreenLog.warn(
              '[HUNTER_STATUS_VIEWED] Cannot submit without seat (effectiveSeat is null)',
            );
          } else {
            void sendWolfRobotHunterStatusViewed(effectiveSeat);
          }
          return;

        case 'TAKEOVER_BOT_SEAT':
          roomScreenLog.debug('[dispatchInteraction] TAKEOVER_BOT_SEAT', {
            seat: result.seat,
          });
          setControlledSeat(result.seat);
          return;

        case 'RELEASE_BOT_SEAT':
          roomScreenLog.debug('[dispatchInteraction] RELEASE_BOT_SEAT');
          setControlledSeat(null);
          return;
      }
    },
    [
      interactionContext,
      handleSeatingTap,
      handleActionTap,
      handleActionIntent,
      showEnterSeatDialog,
      showLeaveSeatDialog,
      handleLeaveRoom,
      viewedRole,
      handleSettingsPress,
      showPrepareToFlipDialog,
      showStartGameDialog,
      showLastNightInfoDialog,
      showRestartDialog,
      submitRevealAckSafe,
      sendWolfRobotHunterStatusViewed,
      setControlledSeat,
      effectiveSeat,
      pendingHunterStatusViewed,
      gameState,
      setPendingRevealDialog,
      setRoleCardVisible,
      setShouldPlayRevealAnimation,
    ],
  );

  // ─── Public seat tap handlers ────────────────────────────────────────────

  const onSeatTapped = useCallback(
    (seat: number, disabledReason?: string) => {
      dispatchInteraction({ kind: 'SEAT_TAP', seat: seat, disabledReason });
    },
    [dispatchInteraction],
  );

  const onSeatLongPressed = useCallback(
    (seat: number) => {
      dispatchInteraction({ kind: 'TAKEOVER_BOT_SEAT', seat });
    },
    [dispatchInteraction],
  );

  return {
    dispatchInteraction,
    onSeatTapped,
    onSeatLongPressed,
    interactionContext,
  };
}
