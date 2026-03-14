/**
 * useRoomScreenState — Composition root that wires all RoomScreen sub-hooks together.
 *
 * Calls hooks in dependency order and returns a flat bag consumed by RoomScreen JSX.
 * Identity → actioner → derived → actions → orchestrator → dialogs → interaction.
 * Does not render JSX, own styles, or contain business logic.
 */

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RoleAction } from '@werewolf/game-engine/models/actions/RoleAction';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type { RoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { View } from 'react-native';

import { useNotepad } from '@/components/AIChatBubble/useNotepad';
import { useServices } from '@/contexts/ServiceContext';
import { useGameRoom } from '@/hooks/useGameRoom';
import type { RootStackParamList } from '@/navigation/types';
import { showAlert } from '@/utils/alert';
import { fireAndForget } from '@/utils/errorUtils';
import { roomScreenLog } from '@/utils/logger';

import { buildNightReviewData } from '../NightReview.helpers';
import { getWolfVoteSummary, toGameRoomLike } from '../RoomScreen.helpers';
import { captureNightReviewCard, shareNightReviewReportImage } from '../shareNightReview';
import { useRoomActionDialogs } from '../useRoomActionDialogs';
import { useRoomHostDialogs } from '../useRoomHostDialogs';
import { useRoomSeatDialogs } from '../useRoomSeatDialogs';
import { useActionerState } from './useActionerState';
import { useActionOrchestrator } from './useActionOrchestrator';
import { useHiddenDebugTrigger } from './useHiddenDebugTrigger';
import { useInteractionDispatcher } from './useInteractionDispatcher';
import { useNightProgress } from './useNightProgress';
import { useRoomActions } from './useRoomActions';
import { useRoomDerived } from './useRoomDerived';
import { useRoomIdentity } from './useRoomIdentity';
import { useRoomInit } from './useRoomInit';
import { useRoomModals } from './useRoomModals';
import { useRoomSettings } from './useRoomSettings';
import { useSpeakingOrder } from './useSpeakingOrder';
import { useWolfVoteCountdown } from './useWolfVoteCountdown';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Stable empty Map to avoid new reference on every render when gameState is null */
const EMPTY_ACTIONS: Map<RoleId, RoleAction> = new Map();

/** Errors that cannot be recovered by retrying — auto-redirect to Home */
const FATAL_ROOM_ERRORS = new Set(['房间不存在', '房间状态已过期，请重新创建房间']);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Route params that RoomScreen receives (mirrors RootStackParamList['Room']) */
interface RoomScreenRouteParams {
  roomNumber: string;
  isHost: boolean;
  template?: GameTemplate;
  roleRevealAnimation?: RoleRevealAnimation;
}

/** Navigation type required by useRoomScreenState */
type RoomScreenNavigation = NativeStackNavigationProp<RootStackParamList, 'Room'>;

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useRoomScreenState(
  params: RoomScreenRouteParams,
  navigation: RoomScreenNavigation,
) {
  const {
    roomNumber,
    // Default to false: URL navigation (refresh) may omit isHost;
    // joinRoom auto-detects host status from DB record.hostUid
    isHost: isHostParam = false,
    template,
    roleRevealAnimation: initialRoleRevealAnimation,
  } = params;

  const { audioService, settingsService } = useServices();

  // ═══════════════════════════════════════════════════════════════════════════
  // Core game room hook
  // ═══════════════════════════════════════════════════════════════════════════

  const {
    facade,
    gameState,
    isHost,
    mySeatNumber,
    myRole,
    myUid,
    roomStatus,
    currentActionRole,
    currentSchema,
    currentStepId,
    isAudioPlaying,
    roleRevealAnimation,
    resolvedRoleRevealAnimation,
    connectionStatus,
    error: gameRoomError,
    initializeRoom,
    joinRoom,
    leaveRoom,
    takeSeat,
    leaveSeat,
    assignRoles,
    startGame,
    restartGame,
    clearAllSeats,
    setRoleRevealAnimation,
    shareNightReview,
    viewedRole,
    submitAction,
    hasWolfVoted,
    getLastNightInfo: getLastNightInfoFn,
    lastSeatError,
    clearLastSeatError,
    needsAuth,
    clearNeedsAuth,
    requestSnapshot,
    submitRevealAck,
    submitGroupConfirmAck,
    sendWolfRobotHunterStatusViewed,
    // Debug mode
    isDebugMode,
    fillWithBots,
    markAllBotsViewed,
    controlledSeat,
    setControlledSeat,
    effectiveSeat,
    effectiveRole,
    // Progression
    postProgression,
    // Rejoin recovery
    resumeAfterRejoin,
    needsContinueOverlay,
    dismissContinueOverlay,
  } = useGameRoom();

  // ═══════════════════════════════════════════════════════════════════════════
  // Derived primitives
  // ═══════════════════════════════════════════════════════════════════════════

  const hasBots = useMemo(() => {
    if (!gameState) return false;
    return Array.from(gameState.players.values()).some((p) => p?.isBot);
  }, [gameState]);

  const submitRevealAckSafe = useCallback(() => {
    fireAndForget(submitRevealAck(), '[submitRevealAckSafe] Unhandled error', roomScreenLog);
  }, [submitRevealAck]);

  const submitGroupConfirmAckSafe = useCallback(() => {
    fireAndForget(
      submitGroupConfirmAck(),
      '[submitGroupConfirmAckSafe] Unhandled error',
      roomScreenLog,
    );
  }, [submitGroupConfirmAck]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Local UI state
  // ═══════════════════════════════════════════════════════════════════════════

  const [firstSwapSeat, setFirstSwapSeat] = useState<number | null>(null);
  const [secondSeat, setSecondSeat] = useState<number | null>(null);
  const [multiSelectedSeats, setMultiSelectedSeats] = useState<readonly number[]>([]);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [seatModalVisible, setSeatModalVisible] = useState(false);
  const [pendingSeat, setPendingSeat] = useState<number | null>(null);
  const [modalType, setModalType] = useState<'enter' | 'leave'>('enter');

  // ── Settings sheet (delegated to useRoomSettings) ─────────────────────────
  const roomSettings = useRoomSettings({ settingsService, setRoleRevealAnimation });

  // ── Wolf vote countdown tick ─────────────────────────────────────────────
  const countdownTick = useWolfVoteCountdown({
    wolfVoteDeadline: gameState?.wolfVoteDeadline,
    isHost,
    roomStatus,
    postProgression,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Simple hooks
  // ═══════════════════════════════════════════════════════════════════════════

  const { handleDebugTitleTap } = useHiddenDebugTrigger();

  const init = useRoomInit({
    roomNumber,
    isHostParam,
    template,
    initializeRoom,
    joinRoom,
    hasGameState: !!gameState,
    initialRoleRevealAnimation,
    setRoleRevealAnimation,
    gameRoomError,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Fatal error auto-redirect: room gone → alert + navigate Home
  // ═══════════════════════════════════════════════════════════════════════════

  const fatalErrorFiredRef = useRef(false);
  useEffect(() => {
    if (!gameRoomError) return;
    const fatal = FATAL_ROOM_ERRORS.has(gameRoomError);
    if (!fatal) return;
    // Guard: fire only once to prevent alert-storm from rapid error state toggles
    if (fatalErrorFiredRef.current) return;
    fatalErrorFiredRef.current = true;
    roomScreenLog.debug('[useRoomScreenState] Fatal room error, redirecting to Home', {
      error: gameRoomError,
    });
    showAlert('房间异常', gameRoomError);
    navigation.navigate('Home');
  }, [gameRoomError, navigation]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Actor Identity (delegated to useRoomIdentity)
  // ═══════════════════════════════════════════════════════════════════════════

  const wolfVotesMap = useMemo(() => {
    const raw = gameState?.currentNightResults?.wolfVotesBySeat;
    if (!raw) return new Map<number, number>();
    const map = new Map<number, number>();
    for (const [k, v] of Object.entries(raw as Record<string, number>)) {
      map.set(Number.parseInt(k, 10), v);
    }
    return map;
  }, [gameState?.currentNightResults]);

  const { actorSeatForUi, actorRoleForUi, isDelegating } = useRoomIdentity({
    mySeatNumber,
    myRole,
    effectiveSeat,
    effectiveRole,
    controlledSeat,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Actioner state
  // ═══════════════════════════════════════════════════════════════════════════

  const { imActioner, showWolves } = useActionerState({
    actorRole: actorRoleForUi,
    currentActionRole,
    currentSchema,
    actorSeatNumber: actorSeatForUi,
    wolfVotes: wolfVotesMap,
    actions: gameState?.actions ?? EMPTY_ACTIONS,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Side effects
  // ═══════════════════════════════════════════════════════════════════════════

  // Show alert when seat request is rejected
  useEffect(() => {
    if (lastSeatError) {
      roomScreenLog.warn('[useRoomScreenState] Seat error received', { lastSeatError });
      showAlert('入座失败', '该座位已被占用，请选择其他位置。');
      clearLastSeatError();
    }
  }, [lastSeatError, clearLastSeatError]);

  // Reset UI state when game restarts
  useEffect(() => {
    if (!gameState) return;
    if (roomStatus === GameStatus.Unseated || roomStatus === GameStatus.Seated) {
      roomScreenLog.debug('[useRoomScreenState] Resetting UI state for restart', { roomStatus });
      setIsStartingGame(false);
      setFirstSwapSeat(null);
      setMultiSelectedSeats([]);
    }
  }, [gameState, roomStatus]);

  // Reset multi-select state when night step changes
  useEffect(() => {
    setMultiSelectedSeats([]);
  }, [currentStepId]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Intent Layer: useRoomActions
  // ═══════════════════════════════════════════════════════════════════════════

  const gameContext = useMemo(
    () => ({
      gameState,
      roomStatus,
      currentActionRole,
      currentSchema,
      imActioner,
      actorSeatNumber: actorSeatForUi,
      actorRole: actorRoleForUi,
      isAudioPlaying,
      firstSwapSeat,
      multiSelectedSeats,
      countdownTick,
    }),
    [
      gameState,
      roomStatus,
      currentActionRole,
      currentSchema,
      imActioner,
      actorSeatForUi,
      actorRoleForUi,
      isAudioPlaying,
      firstSwapSeat,
      multiSelectedSeats,
      countdownTick,
    ],
  );

  const actionDeps = useMemo(
    () => ({
      hasWolfVoted,
      getWolfVoteSummary: () =>
        gameState ? getWolfVoteSummary(toGameRoomLike(gameState)) : '0/0 狼人已确认',
      getWitchContext: () => gameState?.witchContext ?? null,
    }),
    [gameState, hasWolfVoted],
  );

  const { getActionIntent, getAutoTriggerIntent, getWolfStatusLine, getBottomAction } =
    useRoomActions(gameContext, actionDeps);

  // ═══════════════════════════════════════════════════════════════════════════
  // Derived view models (delegated to useRoomDerived)
  // ═══════════════════════════════════════════════════════════════════════════

  const derived = useRoomDerived({
    gameState,
    currentSchema,
    currentActionRole,
    roomStatus,
    actorSeatForUi,
    showWolves,
    imActioner,
    firstSwapSeat,
    secondSeat,
    multiSelectedSeats,
    getWolfStatusLine,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Dialog Layer
  // ═══════════════════════════════════════════════════════════════════════════

  const actionDialogs = useRoomActionDialogs();

  const handleLeaveRoomCleanup = useCallback(() => {
    roomScreenLog.debug('handleLeaveRoomCleanup: calling leaveRoom + cleanup');
    void leaveRoom();
    audioService.cleanup();
  }, [leaveRoom, audioService]);

  const seatDialogs = useRoomSeatDialogs({
    pendingSeat,
    setPendingSeat,
    setSeatModalVisible,
    setModalType,
    takeSeat,
    leaveSeat,
    roomStatus,
    navigation,
    onLeaveRoom: handleLeaveRoomCleanup,
  });

  const {
    showEnterSeatDialog,
    showLeaveSeatDialog,
    handleConfirmSeat,
    handleCancelSeat,
    handleConfirmLeave,
    handleLeaveRoom,
  } = seatDialogs;

  // ═══════════════════════════════════════════════════════════════════════════
  // Action Orchestrator
  // ═══════════════════════════════════════════════════════════════════════════

  const {
    handleActionIntent,
    pendingRevealDialog,
    setPendingRevealDialog,
    pendingHunterStatusViewed,
    isActionSubmitting,
  } = useActionOrchestrator({
    gameState,
    roomStatus,
    currentActionRole,
    currentSchema,
    effectiveSeat,
    effectiveRole,
    controlledSeat,
    actorSeatForUi,
    imActioner,
    isAudioPlaying,
    myUid,
    needsContinueOverlay,
    firstSwapSeat,
    setFirstSwapSeat,
    setSecondSeat,
    submitAction,
    submitRevealAckSafe,
    sendWolfRobotHunterStatusViewed,
    submitGroupConfirmAck: submitGroupConfirmAckSafe,
    multiSelectedSeats,
    setMultiSelectedSeats,
    getAutoTriggerIntent,
    actionDialogs,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Host Dialogs
  // ═══════════════════════════════════════════════════════════════════════════

  const {
    showPrepareToFlipDialog,
    showStartGameDialog,
    showRestartDialog,
    handleSettingsPress,
    isHostActionSubmitting,
  } = useRoomHostDialogs({
    gameState,
    assignRoles,
    startGame,
    restartGame,
    setIsStartingGame,
    navigation,
    roomNumber,
  });

  const nightReviewData = useMemo(() => {
    if (!gameState?.currentNightResults) return null;
    if (gameState.status !== GameStatus.Ended) return null;
    return buildNightReviewData(gameState);
  }, [gameState]);
  const nightReviewShareCardRef = useRef<View>(null);

  const shareNightReviewReportDirectly = useCallback(async () => {
    if (!nightReviewData) {
      showAlert('分享失败', '当前暂无可分享的战报');
      return;
    }

    const result = await shareNightReviewReportImage(
      () => captureNightReviewCard(nightReviewShareCardRef),
      roomNumber,
    );
    if (result === 'failed') {
      showAlert('分享失败', '无法分享战报，请稍后重试');
    }
  }, [nightReviewData, roomNumber]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Modal / dialog state (role card, skill preview, night review, share review)
  // ═══════════════════════════════════════════════════════════════════════════

  const {
    roleCardVisible,
    shouldPlayRevealAnimation,
    isLoadingRole,
    setRoleCardVisible,
    setShouldPlayRevealAnimation,
    setIsLoadingRole,
    handleRoleCardClose,
    skillPreviewRoleId,
    handleSkillPreviewOpen,
    handleSkillPreviewClose,
    nightReviewVisible,
    openNightReview,
    closeNightReview,
    shareReviewVisible,
    closeShareReview,
    handleShareNightReview,
    showLastNightInfo,
  } = useRoomModals({
    isHost,
    getLastNightInfo: getLastNightInfoFn,
    shareNightReview,
    shareNightReviewReport: shareNightReviewReportDirectly,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Interaction Dispatcher
  // ═══════════════════════════════════════════════════════════════════════════

  const { dispatchInteraction, onSeatTapped, onSeatLongPressed } = useInteractionDispatcher({
    gameState,
    roomStatus,
    isAudioPlaying,
    pendingRevealDialog,
    pendingHunterStatusViewed,
    isHost,
    imActioner,
    mySeatNumber,
    myRole,
    effectiveSeat,
    actorSeatForUi,
    actorRoleForUi,
    isDebugMode,
    controlledSeat,
    isDelegating,
    handleActionIntent,
    getActionIntent,
    showEnterSeatDialog,
    showLeaveSeatDialog,
    setShouldPlayRevealAnimation,
    setIsLoadingRole,
    setRoleCardVisible,
    setControlledSeat,
    setPendingRevealDialog,
    viewedRole,
    submitRevealAckSafe,
    sendWolfRobotHunterStatusViewed,
    handleLeaveRoom,
    handleSettingsPress,
    showPrepareToFlipDialog,
    showStartGameDialog,
    showRestartDialog,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Night Progress
  // ═══════════════════════════════════════════════════════════════════════════

  const { nightProgress } = useNightProgress({
    currentStepId,
    gameState,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Speaking order (shown in BoardInfoCard after night ends)
  // ═══════════════════════════════════════════════════════════════════════════

  const speakingOrderText = useSpeakingOrder({ roomStatus, isAudioPlaying, gameState });

  // ═══════════════════════════════════════════════════════════════════════════
  // Notepad (pure client-side per-seat notes via AsyncStorage)
  // ═══════════════════════════════════════════════════════════════════════════

  const notepad = useNotepad(facade);

  // ═══════════════════════════════════════════════════════════════════════════
  // Return bag
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // ── Route params ──
    roomNumber,
    template,

    // ── Game state (from useGameRoom) ──
    gameState,
    isHost,
    roomStatus,
    currentActionRole,
    currentSchema,
    isAudioPlaying,
    roleRevealAnimation,
    resolvedRoleRevealAnimation,
    connectionStatus,
    gameRoomError,
    effectiveSeat,
    effectiveRole,
    isDebugMode,
    controlledSeat,
    hasBots,
    fillWithBots,
    markAllBotsViewed,
    clearAllSeats,
    requestSnapshot,
    setControlledSeat,

    // ── Initialization (from useRoomInit) ──
    ...init,

    // ── Auth gate (first-time direct URL user) ──
    needsAuth,
    clearNeedsAuth,

    // ── Derived view models (from useRoomDerived) ──
    ...derived,
    nightProgress,
    speakingOrderText,

    // ── Actioner ──
    imActioner,

    // ── Interaction ──
    dispatchInteraction,
    onSeatTapped,
    onSeatLongPressed,
    getBottomAction,
    handleDebugTitleTap,

    // ── Local UI state ──
    isStartingGame,
    isHostActionSubmitting,
    isActionSubmitting,

    // ── Seat modal ──
    seatModalVisible,
    pendingSeat,
    modalType,
    handleConfirmSeat,
    handleCancelSeat,
    handleConfirmLeave,

    // ── Role card modal ──
    roleCardVisible,
    shouldPlayRevealAnimation,
    isLoadingRole,
    handleRoleCardClose,

    // ── Skill preview modal ──
    skillPreviewRoleId,
    handleSkillPreviewOpen,
    handleSkillPreviewClose,

    // ── Rejoin recovery ──
    resumeAfterRejoin,
    needsContinueOverlay,
    dismissContinueOverlay,

    // ── Last night info (all players) ──
    showLastNightInfo,

    // ── Night review modal ──
    nightReviewData,
    nightReviewShareCardRef,
    nightReviewVisible,
    openNightReview,
    closeNightReview,

    // ── Share review modal ──
    shareReviewVisible,
    closeShareReview,
    shareNightReview: handleShareNightReview,

    // ── Settings sheet (from useRoomSettings) ──
    ...roomSettings,

    // ── Notepad (from useNotepad) ──
    notepad,
  };
}
