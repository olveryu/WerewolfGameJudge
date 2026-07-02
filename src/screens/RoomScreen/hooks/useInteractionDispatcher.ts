/**
 * useInteractionDispatcher.ts - Interaction policy dispatcher & seat tap handlers
 *
 * Builds InteractionContext from game state / actor identity, calls RoomInteractionPolicy
 * (pure logic) and executes resulting instructions, owns dispatchInteraction / onSeatTapped /
 * onSeatLongPressed, and executes side effects (showAlert, showDialog, navigation, role card,
 * bot takeover). Does not contain business rules / action processing (that's useActionOrchestrator),
 * does not import services directly, does not own night flow / audio logic, does not render UI
 * or hold JSX, and does not duplicate any policy logic (single-source-of-truth is policy layer).
 */

import type { ActionResult } from '@werewolf/game-engine/protocol/ActionResult';
import { GameStatus } from '@werewolf/game-engine/werewolf/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';
import { useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner-native';

import { usePlayerProfileController } from '@/components/room/hooks/usePlayerProfileController';
import type { LocalWerewolfState } from '@/hooks/adapters/werewolfStateTypes';
import { usePendingAcks } from '@/hooks/usePendingAcks';
import {
  getInteractionResult,
  type InteractionContext,
  type InteractionEvent,
} from '@/screens/RoomScreen/policy';
import type { ActionIntent } from '@/screens/RoomScreen/policy/types';
import { showDismissAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface UseInteractionDispatcherParams {
  // ── Game state ──
  gameState: LocalWerewolfState | null;
  roomStatus: GameStatus;
  isAudioPlaying: boolean;
  isHost: boolean;
  imActioner: boolean;

  // ── Identity ──
  myUserId: string | null;
  mySeat: number | null;
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
  showKickSeatDialog: (seat: number) => void;
  handleLeaveRoom: () => void;

  // ── Modal state (guard against duplicate opens) ──
  seatModalVisible: boolean;

  // ── Seat operations (raw API) ──
  viewedRole: () => Promise<ActionResult>;

  // ── Host dialogs ──
  handleSettingsPress: () => void;
  showPrepareToFlipDialog: () => void;
  showStartGameDialog: () => void;
  showRestartDialog: () => void;

  // ── Submission callbacks ──
  setControlledSeat: (seat: number | null) => void;

  // ── Role card state setters (owned by RoomScreen) ──
  setRoleCardVisible: (v: boolean) => void;
  setShouldPlayRevealAnimation: (v: boolean) => void;
  setIsLoadingRole: (v: boolean) => void;
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
  /** Player profile card state */
  profileCardVisible: boolean;
  profileCardTargetUserId: string;
  profileCardTargetSeat: number;
  /** Display name from roster (for bots or offline render without API) */
  profileCardRosterName: string;
  /** Whether the profile card is showing the current player's own profile */
  profileCardIsSelf: boolean;
  closeProfileCard: () => void;
  handleProfileKick: ((seat: number) => void) | undefined;
  /** Callback when self-profile leave seat button is tapped */
  handleProfileLeaveSeat: ((seat: number) => void) | undefined;
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
  myUserId,
  mySeat,
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
  showKickSeatDialog,
  handleLeaveRoom,
  seatModalVisible,
  viewedRole,
  handleSettingsPress,
  showPrepareToFlipDialog,
  showStartGameDialog,
  showRestartDialog,
  setControlledSeat,
  setRoleCardVisible,
  setShouldPlayRevealAnimation,
  setIsLoadingRole,
}: UseInteractionDispatcherParams): UseInteractionDispatcherResult {
  // ─── Profile card state ──────────────────────────────────────────────────

  const canKick = roomStatus === GameStatus.Unseated || roomStatus === GameStatus.Seated;

  const getProfileDisplayName = useCallback(
    (seat: number, userId: string): string => {
      if (!gameState) {
        throw new Error('useInteractionDispatcher.getProfileDisplayName: missing gameState');
      }

      const player = gameState.players.get(seat);
      if (!player) {
        throw new Error(
          `useInteractionDispatcher.getProfileDisplayName: missing player at seat ${seat}`,
        );
      }
      if (player.userId !== userId) {
        throw new Error(
          `useInteractionDispatcher.getProfileDisplayName: user mismatch at seat ${seat}`,
        );
      }

      return player.displayName ?? '';
    },
    [gameState],
  );

  const kickSeatFromProfile = useCallback(
    (seat: number) => {
      roomScreenLog.debug('handleProfileKick', { seat });
      showKickSeatDialog(seat);
    },
    [showKickSeatDialog],
  );

  const leaveSeatFromProfile = useCallback(
    (seat: number) => {
      roomScreenLog.debug('handleProfileLeaveSeat', { seat });
      showLeaveSeatDialog(seat);
    },
    [showLeaveSeatDialog],
  );

  const profile = usePlayerProfileController({
    myUserId,
    getDisplayName: getProfileDisplayName,
    onKickSeat: kickSeatFromProfile,
    onLeaveSeat: leaveSeatFromProfile,
  });

  const profileTarget = profile.target;
  const closeProfileCard = profile.closeProfile;
  const handleProfileKick = useMemo(
    () => (canKick ? profile.handleKick : undefined),
    [canKick, profile.handleKick],
  );
  const handleProfileLeaveSeat = useMemo(
    () => (canKick ? profile.handleLeaveSeat : undefined),
    [canKick, profile.handleLeaveSeat],
  );

  // ─── Seat tap sub-handlers ───────────────────────────────────────────────

  /** Throttle guard for audio-gate toast — avoids spamming when user taps repeatedly */
  const lastAudioToastRef = useRef(0);
  const AUDIO_TOAST_THROTTLE_MS = 3000;

  const handleSeatingTap = useCallback(
    (seat: number) => {
      if (seatModalVisible) return;

      if (mySeat !== null && seat === mySeat) {
        showLeaveSeatDialog(seat);
      } else {
        showEnterSeatDialog(seat);
      }
    },
    [seatModalVisible, mySeat, showLeaveSeatDialog, showEnterSeatDialog],
  );

  const handleActionTap = useCallback(
    (seat: number) => {
      const intent = getActionIntent(seat);
      roomScreenLog.debug('handleActionTap', {
        seat,
        intentType: intent?.type ?? null,
      });
      if (intent) {
        void handleActionIntent(intent).catch((err) => {
          handleError(err, { label: 'handleActionTap', logger: roomScreenLog, feedback: false });
        });
      }
    },
    [getActionIntent, handleActionIntent],
  );

  // ─── Interaction context ─────────────────────────────────────────────────

  // ─── Server-ack pending state ────────────────────────────────────────────
  // Single signal aggregated from useIsMutating({ mutationKey: ['ack'] }).
  // Replaces the previous per-ack pendingRevealDialog / pendingHunterStatusViewed.
  const hasPendingAck = usePendingAcks();

  const interactionContext: InteractionContext = useMemo(
    () => ({
      roomStatus,
      hasGameState: !!gameState,
      isAudioPlaying,
      hasPendingAck,
      isHost,
      imActioner,
      // Real identity (for display purposes only)
      mySeat,
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
      isSeatOccupied: (seat: number) => {
        if (!gameState) return false;
        return gameState.players.get(seat) != null;
      },
      getPlayerUid: (seat: number) => {
        return gameState?.players.get(seat)?.userId;
      },
    }),
    [
      roomStatus,
      gameState,
      isAudioPlaying,
      hasPendingAck,
      isHost,
      imActioner,
      mySeat,
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
          roomScreenLog.debug('dispatchInteraction NOOP', {
            reason: result.reason,
            event: event.kind,
          });
          if (result.reason === 'audio_playing') {
            const now = Date.now();
            if (now - lastAudioToastRef.current >= AUDIO_TOAST_THROTTLE_MS) {
              lastAudioToastRef.current = now;
              toast.info('语音播报中，请稍候');
            }
          }
          return;

        case 'ALERT':
          roomScreenLog.debug('dispatchInteraction ALERT', { title: result.title });
          showDismissAlert(result.title, result.message);
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
                const effectivePlayer =
                  effectiveSeat === null ? null : gameState?.players.get(effectiveSeat);
                const alreadyViewed = effectivePlayer?.hasViewedRole ?? false;
                if (alreadyViewed) {
                  // Already viewed → show card directly, no animation, no POST
                  setShouldPlayRevealAnimation(false);
                  setRoleCardVisible(true);
                } else {
                  // First view → show loading immediately → switch to role card after POST succeeds
                  setIsLoadingRole(true);
                  setRoleCardVisible(true);
                  void (async () => {
                    try {
                      const result = await viewedRole();
                      if (!result.success) {
                        // handleMutationResult already handles user feedback inside viewedRole
                        setRoleCardVisible(false);
                        setIsLoadingRole(false);
                        return;
                      }
                      setShouldPlayRevealAnimation(true);
                      setIsLoadingRole(false);
                    } catch (err) {
                      handleError(err, {
                        label: '查看角色',
                        logger: roomScreenLog,
                        feedback: false,
                      });
                      setRoleCardVisible(false);
                      setIsLoadingRole(false);
                    }
                  })();
                }
              }
              return;
            case 'leaveRoom':
              roomScreenLog.debug('dispatchInteraction Show leaveRoom dialog');
              handleLeaveRoom();
              return;
            default: {
              const _exhaustive: never = result.dialogType;
              roomScreenLog.warn('dispatchInteraction Unhandled dialogType', _exhaustive);
              return;
            }
          }
          return;

        case 'SEATING_FLOW':
          roomScreenLog.debug('dispatchInteraction SEATING_FLOW', {
            seat: result.seat,
          });
          handleSeatingTap(result.seat);
          return;

        case 'ACTION_FLOW':
          roomScreenLog.debug('dispatchInteraction ACTION_FLOW', {
            seat: result.seat,
            hasIntent: !!result.intent,
            isAudioPlaying: interactionContext.isAudioPlaying,
            imActioner: interactionContext.imActioner,
          });
          if (result.intent) {
            void handleActionIntent(result.intent).catch((err) => {
              handleError(err, { label: 'ACTION_FLOW', logger: roomScreenLog, feedback: false });
            });
          } else if (result.seat !== undefined) {
            handleActionTap(result.seat);
          }
          return;

        case 'HOST_CONTROL':
          roomScreenLog.debug('dispatchInteraction HOST_CONTROL', { action: result.action });
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
            case 'restart':
              showRestartDialog();
              return;
            default: {
              const _exhaustive: never = result.action;
              roomScreenLog.warn('dispatchInteraction Unhandled host action', _exhaustive);
              return;
            }
          }
          return;

        case 'TAKEOVER_BOT_SEAT':
          roomScreenLog.debug('dispatchInteraction TAKEOVER_BOT_SEAT', {
            seat: result.seat,
          });
          setControlledSeat(result.seat);
          return;

        case 'RELEASE_BOT_SEAT':
          roomScreenLog.debug('dispatchInteraction RELEASE_BOT_SEAT');
          setControlledSeat(null);
          return;

        case 'VIEW_PROFILE': {
          roomScreenLog.debug('dispatchInteraction VIEW_PROFILE', {
            seat: result.seat,
            targetUserId: result.targetUserId,
          });
          profile.openProfile(result.seat, result.targetUserId);
          return;
        }

        default: {
          const _exhaustive: never = result;
          roomScreenLog.warn('dispatchInteraction Unhandled result kind', _exhaustive);
          return;
        }
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
      showRestartDialog,
      setControlledSeat,
      effectiveSeat,
      gameState,
      profile,
      setRoleCardVisible,
      setShouldPlayRevealAnimation,
      setIsLoadingRole,
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
    profileCardVisible: profileTarget !== null,
    profileCardTargetUserId: profileTarget?.userId ?? '',
    profileCardTargetSeat: profileTarget?.seat ?? 0,
    profileCardRosterName: profileTarget?.displayName ?? '',
    profileCardIsSelf: profileTarget?.isSelf ?? false,
    closeProfileCard,
    handleProfileKick,
    handleProfileLeaveSeat,
  };
}
