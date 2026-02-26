/**
 * useRoomScreenState - Composition hook that wires all RoomScreen sub-hooks together
 *
 * Calls all sub-hooks in dependency order (useGameRoom → useRoomInit → useRoomActions → …),
 * owns local UI state (magician seats, modals, countdown, isStartingGame), computes derived
 * data (seatViewModels, roleStats, wolfVotesMap, actorIdentity), owns side-effects (countdown
 * timer, seat error alert, restart reset, delegation warning), and returns a flat bag of values
 * consumed by RoomScreen JSX. Does not render JSX, does not import components, does not own
 * styles (that stays in the component), and does not contain business logic (delegated to
 * sub-hooks).
 */

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Sentry from '@sentry/react-native';
import type { RoleAction } from '@werewolf/game-engine/models/actions/RoleAction';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type { RoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';
import { createSeededRng } from '@werewolf/game-engine/utils/random';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';

import { useServices } from '@/contexts/ServiceContext';
import { useGameRoom } from '@/hooks/useGameRoom';
import type { RootStackParamList } from '@/navigation/types';
import { showAlert } from '@/utils/alert';
import { roomScreenLog } from '@/utils/logger';

import { getActorIdentity, isActorIdentityValid } from '../policy';
import {
  buildSeatViewModels,
  getRoleStats,
  getWolfVoteSummary,
  toGameRoomLike,
} from '../RoomScreen.helpers';
import { useRoomActionDialogs } from '../useRoomActionDialogs';
import { generateSpeakOrder, useRoomHostDialogs } from '../useRoomHostDialogs';
import { useRoomSeatDialogs } from '../useRoomSeatDialogs';
import { useActionerState } from './useActionerState';
import { useActionOrchestrator } from './useActionOrchestrator';
import { useHiddenDebugTrigger } from './useHiddenDebugTrigger';
import { useInteractionDispatcher } from './useInteractionDispatcher';
import { useNightProgress } from './useNightProgress';
import { useRoomActions } from './useRoomActions';
import { useRoomInit } from './useRoomInit';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Stable empty Map to avoid new reference on every render when gameState is null */
const EMPTY_ACTIONS: Map<RoleId, RoleAction> = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

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
    submitWolfVote,
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
    void submitRevealAck().catch((err) => {
      roomScreenLog.error('[submitRevealAckSafe] Unhandled error', err);
      Sentry.captureException(err);
    });
  }, [submitRevealAck]);

  const submitGroupConfirmAckSafe = useCallback(async () => {
    await submitGroupConfirmAck();
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
  const [nightReviewVisible, setNightReviewVisible] = useState(false);
  const [shareReviewVisible, setShareReviewVisible] = useState(false);

  // ── Wolf vote countdown tick ─────────────────────────────────────────────
  const [countdownTick, setCountdownTick] = useState(0);
  const wolfVoteDeadline = gameState?.wolfVoteDeadline;
  const postProgressionFiredRef = useRef(false);

  // Reset fire-guard when deadline changes (new deadline = new countdown)
  useEffect(() => {
    postProgressionFiredRef.current = false;
  }, [wolfVoteDeadline]);

  useEffect(() => {
    if (wolfVoteDeadline == null) return;
    // Guard: only fire postProgression while game is ongoing.
    // On host rejoin with status `ended`, stale wolfVoteDeadline may still exist
    // and be expired — without this guard it would fire immediately and get 400.
    if (roomStatus !== GameStatus.Ongoing) return;

    // Already expired on mount — fire postProgression immediately (once)
    if (Date.now() >= wolfVoteDeadline) {
      if (isHost && !postProgressionFiredRef.current) {
        postProgressionFiredRef.current = true;
        void postProgression().catch((err) => {
          roomScreenLog.error('[postProgression] countdown expired fire failed', err);
          Sentry.captureException(err);
        });
      }
      return;
    }

    const interval = setInterval(() => {
      if (Date.now() >= wolfVoteDeadline) {
        clearInterval(interval);
        // Host triggers server-side progression when countdown expires
        if (isHost && !postProgressionFiredRef.current) {
          postProgressionFiredRef.current = true;
          void postProgression().catch((err) => {
            roomScreenLog.error('[postProgression] countdown interval fire failed', err);
            Sentry.captureException(err);
          });
        }
      }
      setCountdownTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [wolfVoteDeadline, isHost, postProgression, roomStatus]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Simple hooks
  // ═══════════════════════════════════════════════════════════════════════════

  const { handleDebugTitleTap } = useHiddenDebugTrigger();

  const { isInitialized, loadingMessage, showRetryButton, handleRetry } = useRoomInit({
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
  // Actor Identity
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

  const actorIdentity = useMemo(
    () =>
      getActorIdentity({
        mySeatNumber,
        myRole,
        effectiveSeat,
        effectiveRole,
        controlledSeat,
      }),
    [mySeatNumber, myRole, effectiveSeat, effectiveRole, controlledSeat],
  );

  const { actorSeatForUi, actorRoleForUi, isDelegating } = actorIdentity;

  // FAIL-FAST: Log warning when delegating but identity is invalid
  useEffect(() => {
    if (isDelegating && !isActorIdentityValid(actorIdentity)) {
      roomScreenLog.warn('[ActorIdentity] Invalid delegation state detected', {
        controlledSeat,
        effectiveSeat,
        effectiveRole,
        actorSeatForUi,
        actorRoleForUi,
        hint: 'effectiveSeat should equal controlledSeat when delegating',
      });
    }
  }, [
    isDelegating,
    actorIdentity,
    controlledSeat,
    effectiveSeat,
    effectiveRole,
    actorSeatForUi,
    actorRoleForUi,
  ]);

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
  // Derived view models
  // ═══════════════════════════════════════════════════════════════════════════

  const currentSchemaConstraints = useMemo(() => {
    if (!currentSchema) return undefined;
    if (
      currentSchema.kind === 'chooseSeat' ||
      currentSchema.kind === 'swap' ||
      currentSchema.kind === 'multiChooseSeat'
    ) {
      return currentSchema.constraints;
    }
    return undefined;
  }, [currentSchema]);

  const seatViewModels = useMemo(() => {
    if (!gameState) return [];

    const skipConstraints =
      currentSchema?.id === 'wolfRobotLearn' && gameState.wolfRobotReveal != null;

    return buildSeatViewModels(gameState, actorSeatForUi, showWolves, firstSwapSeat, {
      schemaConstraints: imActioner && !skipConstraints ? currentSchemaConstraints : undefined,
      secondSelectedSeat: secondSeat,
      multiSelectedSeats,
      showReadyBadges: roomStatus === GameStatus.Assigned || roomStatus === GameStatus.Ready,
      groupConfirmAcks:
        currentSchema?.kind === 'groupConfirm' ? (gameState.piperRevealAcks ?? []) : undefined,
    });
  }, [
    gameState,
    actorSeatForUi,
    showWolves,
    firstSwapSeat,
    secondSeat,
    multiSelectedSeats,
    imActioner,
    currentSchemaConstraints,
    currentSchema?.id,
    currentSchema?.kind,
    roomStatus,
  ]);

  const {
    roleCounts,
    wolfRoles,
    godRoles,
    specialRoles,
    villagerCount,
    wolfRoleItems,
    godRoleItems,
    specialRoleItems,
    villagerRoleItems,
  } = useMemo(() => {
    if (!gameState) {
      return {
        roleCounts: {},
        wolfRoles: [],
        godRoles: [],
        specialRoles: [],
        villagerCount: 0,
        wolfRoleItems: [],
        godRoleItems: [],
        specialRoleItems: [],
        villagerRoleItems: [],
      };
    }
    return getRoleStats(gameState.template.roles);
  }, [gameState]);

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

  // Show one-time hint toast for the AI assistant bubble (bottom-right)
  // 6s delay avoids collision with the registration toast (5s visibilityTime)
  useEffect(() => {
    if (!isInitialized) return;
    if (settingsService.hasSeenAssistantHint()) return;

    const timer = setTimeout(() => {
      Toast.show({
        type: 'info',
        text1: '💡 右下角小助手可以记笔记、问规则',
        position: 'bottom',
        visibilityTime: 5000,
      });
      void settingsService.setHasSeenAssistantHint(true);
    }, 6000);

    return () => clearTimeout(timer);
  }, [isInitialized, settingsService]);

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
        gameState ? getWolfVoteSummary(toGameRoomLike(gameState)) : '0/0 狼人已投票',
      getWitchContext: () => gameState?.witchContext ?? null,
    }),
    [gameState, hasWolfVoted],
  );

  const {
    getActionIntent,
    getAutoTriggerIntent,
    findVotingWolfSeat,
    getWolfStatusLine,
    getBottomAction,
  } = useRoomActions(gameContext, actionDeps);

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
    firstSwapSeat,
    setFirstSwapSeat,
    setSecondSeat,
    submitAction,
    submitWolfVote,
    submitRevealAckSafe,
    sendWolfRobotHunterStatusViewed,
    submitGroupConfirmAck: submitGroupConfirmAckSafe,
    multiSelectedSeats,
    setMultiSelectedSeats,
    getAutoTriggerIntent,
    findVotingWolfSeat,
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

  // ═══════════════════════════════════════════════════════════════════════════
  // Role card modal
  // ═══════════════════════════════════════════════════════════════════════════

  const [roleCardVisible, setRoleCardVisible] = useState(false);
  const [shouldPlayRevealAnimation, setShouldPlayRevealAnimation] = useState(false);

  const handleRoleCardClose = useCallback(() => {
    setRoleCardVisible(false);
    setShouldPlayRevealAnimation(false);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // Skill preview modal (BoardInfoCard role chip tap)
  // ═══════════════════════════════════════════════════════════════════════════

  const [skillPreviewRoleId, setSkillPreviewRoleId] = useState<RoleId | null>(null);

  const handleSkillPreviewOpen = useCallback((roleId: string) => {
    setSkillPreviewRoleId(roleId as RoleId);
  }, []);

  const handleSkillPreviewClose = useCallback(() => {
    setSkillPreviewRoleId(null);
  }, []);

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
  // Speaking order (shown in BoardInfoCard for 20s after night ends)
  // ═══════════════════════════════════════════════════════════════════════════

  const [speakingOrderText, setSpeakingOrderText] = useState<string | undefined>();
  const speakingOrderShownRef = useRef(false);

  useEffect(() => {
    // Reset when leaving ended status (e.g. restart)
    if (roomStatus !== GameStatus.Ended) {
      speakingOrderShownRef.current = false;
      return;
    }
    if (!gameState || isAudioPlaying || speakingOrderShownRef.current) {
      return;
    }
    speakingOrderShownRef.current = true;

    const seed = gameState.roleRevealRandomNonce ?? gameState.roomCode;
    const rng = createSeededRng(seed);
    const playerCount = gameState.template.roles.length;
    const { startSeat, direction } = generateSpeakOrder(playerCount, rng);
    setSpeakingOrderText(`🎙️ 从 ${startSeat} 号开始 ${direction}发言`);

    const timer = setTimeout(() => setSpeakingOrderText(undefined), 20_000);
    return () => clearTimeout(timer);
  }, [roomStatus, gameState, isAudioPlaying]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Action message builder
  // ═══════════════════════════════════════════════════════════════════════════

  const actionMessage = useMemo(() => {
    if (!currentActionRole) return '';
    if (!currentSchema?.ui?.prompt) {
      throw new Error(`[FAIL-FAST] Missing schema.ui.prompt for role: ${currentActionRole}`);
    }

    const isWolfRobotHunterGateActive =
      currentSchema.id === 'wolfRobotLearn' &&
      gameState?.wolfRobotReveal?.learnedRoleId === 'hunter' &&
      !gameState?.wolfRobotHunterStatusViewed;

    const baseMessage = isWolfRobotHunterGateActive
      ? (currentSchema.ui.hunterGatePrompt ?? currentSchema.ui.prompt)
      : currentSchema.ui.prompt;

    const wolfStatusLine = getWolfStatusLine();
    if (wolfStatusLine) {
      return `${baseMessage}\n${wolfStatusLine}`;
    }

    return baseMessage;
  }, [gameState, currentActionRole, currentSchema, getWolfStatusLine]);

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

    // ── Initialization ──
    isInitialized,
    loadingMessage,
    showRetryButton,
    handleRetry,

    // ── Auth gate (first-time direct URL user) ──
    needsAuth,
    clearNeedsAuth,

    // ── Derived view models ──
    seatViewModels,
    roleCounts,
    wolfRoles,
    godRoles,
    specialRoles,
    villagerCount,
    wolfRoleItems,
    godRoleItems,
    specialRoleItems,
    villagerRoleItems,
    nightProgress,
    speakingOrderText,
    actionMessage,

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
    showLastNightInfo: useCallback(() => {
      showAlert('提示', '请在警长竞选结束后再查看，请勿作弊', [
        { text: '取消', style: 'cancel' },
        {
          text: '确定查看',
          onPress: () => {
            const info = getLastNightInfoFn();
            showAlert('昨夜信息', info, [{ text: '知道了', style: 'default' }]);
          },
        },
      ]);
    }, [getLastNightInfoFn]),

    // ── Night review modal ──
    nightReviewVisible,
    openNightReview: useCallback(() => {
      if (isHost) {
        // Host: choose between viewing or sharing
        showAlert('详细信息', '选择操作', [
          {
            text: '自己查看',
            onPress: () => setNightReviewVisible(true),
          },
          {
            text: '分享给玩家',
            onPress: () => setShareReviewVisible(true),
          },
          { text: '取消', style: 'cancel' },
        ]);
      } else {
        // Non-host: confirm before viewing (anti-cheat reminder)
        showAlert('提示', '请确保你是裁判或观战玩家，再查看详细信息', [
          { text: '取消', style: 'cancel' },
          {
            text: '确定查看',
            onPress: () => setNightReviewVisible(true),
          },
        ]);
      }
    }, [isHost]),
    closeNightReview: useCallback(() => setNightReviewVisible(false), []),

    // ── Share review modal ──
    shareReviewVisible,
    closeShareReview: useCallback(() => setShareReviewVisible(false), []),
    shareNightReview: useCallback(
      async (allowedSeats: number[]) => {
        await shareNightReview(allowedSeats);
        setShareReviewVisible(false);
      },
      [shareNightReview],
    ),
  };
}
