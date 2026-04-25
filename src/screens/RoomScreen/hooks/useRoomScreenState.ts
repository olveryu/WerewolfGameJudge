/**
 * useRoomScreenState — Composition root that wires all RoomScreen sub-hooks together.
 *
 * Calls hooks in dependency order and returns a flat bag consumed by RoomScreen JSX.
 * Identity → actioner → derived → actions → orchestrator → dialogs → interaction.
 * Does not render JSX, own styles, or contain business logic.
 */

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getUnlockedRoleRevealEffects } from '@werewolf/game-engine/growth';
import type { RoleAction } from '@werewolf/game-engine/models/actions/RoleAction';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { ROLE_SPECS } from '@werewolf/game-engine/models/roles/spec/specs';
import { Faction } from '@werewolf/game-engine/models/roles/spec/types';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type { ResolvedRoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';
import {
  RANDOMIZABLE_ANIMATIONS,
  resolveRandomAnimation,
} from '@werewolf/game-engine/types/RoleRevealAnimation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { View } from 'react-native';

import { useAuthContext } from '@/contexts/AuthContext';
import { useUserStatsQuery } from '@/hooks/queries/useUserStatsQuery';
import { useGameRoom } from '@/hooks/useGameRoom';
import { getNotepadStorageKey } from '@/hooks/useNotepad';
import { storage } from '@/lib/storage';
import type { RootStackParamList } from '@/navigation/types';
import { uploadShareImage } from '@/services/feature/ShareImageService';
import { colors } from '@/theme';
import { showErrorAlert } from '@/utils/alertPresets';
import { fireAndForget } from '@/utils/errorUtils';
import { roomScreenLog } from '@/utils/logger';
import { isMiniProgram, wxPreviewImage } from '@/utils/miniProgram';

import { buildNightReviewData } from '../NightReview.helpers';
import { getWolfVoteSummary, toGameRoomLike } from '../RoomScreen.helpers';
import {
  captureNightReviewCard,
  renderNightReviewToCanvas,
  shareNightReviewReportImage,
} from '../shareNightReview';
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
import { useSpeakingOrder } from './useSpeakingOrder';
import { useStepDeadlineCountdown } from './useStepDeadlineCountdown';

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
  roomCode: string;
  isHost: boolean;
  template?: GameTemplate;
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
    roomCode,
    // Default to false: URL navigation (refresh) may omit isHost;
    // joinRoom auto-detects host status from DB record.hostUserId
    isHost: isHostParam = false,
    template,
  } = params;

  // ═══════════════════════════════════════════════════════════════════════════
  // Core game room hook
  // ═══════════════════════════════════════════════════════════════════════════

  const {
    gameState,
    isHost,
    mySeat,
    myRole,
    myUserId,
    roomStatus,
    currentActionRole,
    currentSchema,
    currentStepId,
    isAudioPlaying,
    connectionStatus,
    manualReconnect,
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
    shareNightReview,
    viewedRole,
    submitAction,
    hasWolfVoted,
    getLastNightInfo: getLastNightInfoFn,
    getCurseInfo: getCurseInfoFn,
    lastSeatError,
    clearLastSeatError,
    needsAuth,
    clearNeedsAuth,
    requestSnapshot,
    submitRevealAck,
    submitGroupConfirmAck,
    sendWolfRobotHunterStatusViewed,
    kickPlayer,
    // Debug mode
    isDebugMode,
    fillWithBots,
    markAllBotsViewed,
    markAllBotsGroupConfirmed,
    controlledSeat,
    setControlledSeat,
    effectiveSeat,
    effectiveRole,
    // Progression
    postProgression,
    // Board nomination
    boardNominate,
    boardUpvote,
    boardWithdraw,
    // BGM manual control
    isBgmPlaying,
    playBgm,
    stopBgm,
    // Rejoin recovery
    resumeAfterRejoin,
    needsContinueOverlay,
    dismissContinueOverlay,
  } = useGameRoom();

  // ═══════════════════════════════════════════════════════════════════════════
  // Personal role reveal animation (from user profile, not GameState)
  // ═══════════════════════════════════════════════════════════════════════════

  const { user } = useAuthContext();
  const { data: statsData } = useUserStatsQuery();

  const resolvedRoleRevealAnimation: ResolvedRoleRevealAnimation = useMemo(() => {
    const effect = user?.equippedEffect;
    if (!effect) return 'none';
    if (effect === 'none') return 'none';
    if (effect === 'random') {
      const unlocked = getUnlockedRoleRevealEffects(statsData?.unlockedItems ?? []);
      if (unlocked.size === 0) return 'none';
      const candidates = [...unlocked];
      const picked = resolveRandomAnimation(roomCode);
      return candidates.includes(picked)
        ? (picked as ResolvedRoleRevealAnimation)
        : (candidates[0] as ResolvedRoleRevealAnimation);
    }
    // Validate against known animation IDs — DB may contain stale values
    if (!(RANDOMIZABLE_ANIMATIONS as readonly string[]).includes(effect)) {
      roomScreenLog.warn('Unknown equippedEffect from profile, falling back to none', { effect });
      return 'none';
    }
    return effect as ResolvedRoleRevealAnimation;
  }, [user?.equippedEffect, statsData?.unlockedItems, roomCode]);

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

  // ── Step deadline countdown tick ──────────────────────────────────────────
  const countdownTick = useStepDeadlineCountdown({
    stepDeadline: gameState?.stepDeadline,
    isHost,
    roomStatus,
    postProgression,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Simple hooks
  // ═══════════════════════════════════════════════════════════════════════════

  const { handleDebugTitleTap } = useHiddenDebugTrigger();

  const init = useRoomInit({
    roomCode,
    isHostParam,
    template,
    initializeRoom,
    joinRoom,
    hasGameState: !!gameState,
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
    roomScreenLog.debug('Fatal room error, redirecting to Home', {
      error: gameRoomError,
    });
    showErrorAlert('房间异常', gameRoomError);
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
    mySeat,
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
    actorSeat: actorSeatForUi,
    wolfVotes: wolfVotesMap,
    actions: gameState?.actions ?? EMPTY_ACTIONS,
    treasureMasterChosenCard: gameState?.treasureMasterChosenCard,
    thiefChosenCard: gameState?.thiefChosenCard,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Side effects
  // ═══════════════════════════════════════════════════════════════════════════

  // Show alert when seat request is rejected
  useEffect(() => {
    if (lastSeatError) {
      roomScreenLog.warn('Seat error received', { lastSeatError });
      showErrorAlert('入座失败', '该座位已被占用，请选择其他位置。');
      clearLastSeatError();
    }
  }, [lastSeatError, clearLastSeatError]);

  // Reset UI state when game restarts
  useEffect(() => {
    if (!gameState) return;
    if (roomStatus === GameStatus.Unseated || roomStatus === GameStatus.Seated) {
      roomScreenLog.debug('Resetting UI state for restart', { roomStatus });
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
      actorSeat: actorSeatForUi,
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
    roomScreenLog.debug('handleLeaveRoomCleanup: calling leaveRoom');
    void leaveRoom();
  }, [leaveRoom]);

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
    isSeatSubmitting,
  } = seatDialogs;

  // ═══════════════════════════════════════════════════════════════════════════
  // Choose card modal state (declared before orchestrator so openChooseCardModal
  // is available to pass into ExecutorContext)
  // ═══════════════════════════════════════════════════════════════════════════

  const [chooseCardModalVisible, setChooseCardModalVisible] = useState(false);
  const openChooseCardModal = useCallback(() => setChooseCardModalVisible(true), []);
  const closeChooseCardModal = useCallback(() => setChooseCardModalVisible(false), []);

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
    myUserId,
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
    openChooseCardModal,
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
    roomCode,
  });

  const nightReviewData = useMemo(() => {
    if (!gameState?.currentNightResults) return null;
    if (gameState.status !== GameStatus.Ended) return null;
    return buildNightReviewData(gameState);
  }, [gameState]);
  const nightReviewShareCardRef = useRef<View>(null);
  const [isCapturingShareCard, setIsCapturingShareCard] = useState(false);
  const cachedShareBase64Ref = useRef<string | null>(null);

  // Begin report capture on demand (called when user opens "详细信息" alert).
  // Mounts the hidden share card, waits for paint, captures via html2canvas / captureRef.
  const beginReportCapture = useCallback(async (): Promise<string | null> => {
    cachedShareBase64Ref.current = null;
    setIsCapturingShareCard(true);
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const base64 = await captureNightReviewCard(nightReviewShareCardRef);
      cachedShareBase64Ref.current = base64;
      return base64;
    } catch {
      return null;
    } finally {
      setIsCapturingShareCard(false);
    }
  }, []);

  const shareNightReviewReportDirectly = useCallback(async () => {
    if (!nightReviewData) {
      showErrorAlert('分享失败', '当前暂无可分享的战报');
      return;
    }

    // Use base64 pre-captured by beginReportCapture (triggered when "详细信息" alert opened)
    const base64 = cachedShareBase64Ref.current;

    // Mini program web-view: Canvas 2D → upload to R2 → wx.previewImage
    if (isMiniProgram()) {
      try {
        const canvasBase64 = renderNightReviewToCanvas(nightReviewData, roomCode, colors);
        const url = await uploadShareImage(canvasBase64);
        await wxPreviewImage(url);
      } catch (err) {
        roomScreenLog.error('Mini program share failed', err);
        showErrorAlert('分享失败', '无法分享战报，请稍后重试');
      }
      return;
    }

    if (base64) {
      const result = await shareNightReviewReportImage(() => Promise.resolve(base64), roomCode);
      if (result === 'failed') {
        showErrorAlert('分享失败', '无法分享战报，请稍后重试');
      }
      return;
    }

    // Fallback: on-demand capture (Chrome may download instead of share due to activation expiry)
    const freshBase64 = await beginReportCapture();
    if (!freshBase64) {
      showErrorAlert('分享失败', '无法生成战报截图，请稍后重试');
      return;
    }
    const result = await shareNightReviewReportImage(() => Promise.resolve(freshBase64), roomCode);
    if (result === 'failed') {
      showErrorAlert('分享失败', '无法分享战报，请稍后重试');
    }
  }, [nightReviewData, roomCode, beginReportCapture]);

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
    canShareReport:
      isHost ||
      (effectiveSeat !== null &&
        gameState?.nightReviewAllowedSeats?.includes(effectiveSeat) === true),
    getLastNightInfo: getLastNightInfoFn,
    getCurseInfo: getCurseInfoFn,
    shareNightReview,
    beginReportCapture,
    shareNightReviewReport: shareNightReviewReportDirectly,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Interaction Dispatcher
  // ═══════════════════════════════════════════════════════════════════════════

  const {
    dispatchInteraction,
    onSeatTapped,
    onSeatLongPressed,
    profileCardVisible,
    profileCardTargetUserId,
    profileCardTargetSeat,
    profileCardRosterName,
    closeProfileCard,
    handleProfileKick,
  } = useInteractionDispatcher({
    gameState,
    roomStatus,
    isAudioPlaying,
    pendingRevealDialog,
    pendingHunterStatusViewed,
    isHost,
    imActioner,
    mySeat,
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
    kickPlayer,
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
  // Guide message (contextual hint bar — host gets detailed tips, others get phase hints)
  // ═══════════════════════════════════════════════════════════════════════════

  const guideMessage = useMemo((): string | null => {
    if (!gameState) return null;

    const players = gameState.players;
    const totalSeats = gameState.template.numberOfPlayers;

    if (isHost) {
      switch (roomStatus) {
        case GameStatus.Unseated:
        case GameStatus.Seated: {
          let seatedCount = 0;
          for (const p of players.values()) {
            if (p !== null) seatedCount++;
          }
          if (seatedCount === 0) return '等待玩家入座，或分享房间邀请好友';
          if (seatedCount < totalSeats) return `还有 ${totalSeats - seatedCount} 个空位等待入座`;
          return '全员已就位 → 点击下方「分配角色」';
        }
        case GameStatus.Assigned: {
          let viewedCount = 0;
          for (const p of players.values()) {
            if (p && p.hasViewedRole) viewedCount++;
          }
          if (viewedCount < totalSeats) {
            return `${viewedCount}/${totalSeats} 位玩家已查看角色，等待剩余玩家`;
          }
          return null;
        }
        case GameStatus.Ready:
          return '全员就绪 → 「开始天黑」🔊';
        case GameStatus.Ongoing:
          return null;
        case GameStatus.Ended:
          return '游戏结束 → 可「重新开始」或修改配置再来一局';
        default:
          return null;
      }
    }

    // Non-host phase hints
    switch (roomStatus) {
      case GameStatus.Unseated:
      case GameStatus.Seated:
        return '等待所有玩家入座';
      case GameStatus.Assigned: {
        let viewedCount = 0;
        for (const p of players.values()) {
          if (p && p.hasViewedRole) viewedCount++;
        }
        if (viewedCount < totalSeats) {
          return '请点击你的头像查看身份';
        }
        return null;
      }
      case GameStatus.Ready:
        return '准备就绪，等待房主开始';
      case GameStatus.Ended:
        return '游戏结束';
      default:
        return null;
    }
  }, [isHost, gameState, roomStatus]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Notepad cleanup on game restart (NotepadScreen is not always mounted)
  // ═══════════════════════════════════════════════════════════════════════════

  const notepadPrevStatusRef = useRef(roomStatus);
  useEffect(() => {
    const prev = notepadPrevStatusRef.current;
    if (
      prev !== undefined &&
      prev !== GameStatus.Unseated &&
      prev !== GameStatus.Seated &&
      roomStatus === GameStatus.Seated
    ) {
      const key = getNotepadStorageKey(gameState?.roomCode ?? null);
      if (key) {
        storage.remove(key);
      }
    }
    notepadPrevStatusRef.current = roomStatus;
  }, [roomStatus, gameState?.roomCode]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Choose card handler (treasureMaster / thief bottom card selection)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleChooseCard = useCallback(
    async (cardIndex: number) => {
      closeChooseCardModal();
      await submitAction(null, { cardIndex });
    },
    [closeChooseCardModal, submitAction],
  );

  // Compute disabled indices / hint / team label for ChooseBottomCardModal.
  // TreasureMaster: wolf cards disabled. Thief: non-wolf disabled when wolf exists.
  const isThiefChoose = currentSchema?.id === 'thiefChoose';
  const bottomCards = gameState?.bottomCards;

  const { bottomCardDisabledIndices, bottomCardDisabledHint, bottomCardSubtitle } = useMemo(() => {
    if (!bottomCards)
      return {
        bottomCardDisabledIndices: [],
        bottomCardDisabledHint: undefined,
        bottomCardSubtitle: '',
      };

    const factions = bottomCards.map((r) => ROLE_SPECS[r]?.faction);
    const hasWolf = factions.some((f) => f === Faction.Wolf);

    if (isThiefChoose) {
      // Thief: when wolf exists, must choose wolf → non-wolf disabled
      const disabled = hasWolf
        ? bottomCards.map((_, i) => i).filter((i) => factions[i] !== Faction.Wolf)
        : [];
      return {
        bottomCardDisabledIndices: disabled,
        bottomCardDisabledHint: hasWolf ? '必须选择狼人阵营' : undefined,
        bottomCardSubtitle: hasWolf ? '底牌含狼人阵营' : '底牌均为好人阵营',
      };
    }

    // TreasureMaster (S21): wolf cards disabled, always wolf team
    const disabledWolf = bottomCards.map((_, i) => i).filter((i) => factions[i] === Faction.Wolf);
    return {
      bottomCardDisabledIndices: disabledWolf,
      bottomCardDisabledHint: disabledWolf.length > 0 ? '不可选择狼人阵营' : undefined,
      bottomCardSubtitle: '你的阵营：狼人阵营',
    };
  }, [bottomCards, isThiefChoose]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Return bag
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // ── Route params ──
    roomCode,
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
    markAllBotsGroupConfirmed,
    clearAllSeats,
    requestSnapshot,
    manualReconnect,
    setControlledSeat,

    // ── Board nomination ──
    boardNominate,
    boardUpvote,
    boardWithdraw,

    // ── BGM manual control ──
    isBgmPlaying,
    playBgm,
    stopBgm,

    // ── Initialization (from useRoomInit) ──
    ...init,

    // ── Auth gate (first-time direct URL user) ──
    needsAuth,
    clearNeedsAuth,

    // ── Derived view models (from useRoomDerived) ──
    ...derived,
    nightProgress,
    speakingOrderText,
    guideMessage,

    // ── Actioner ──
    imActioner,

    // ── Interaction ──
    dispatchInteraction,
    onSeatTapped,
    onSeatLongPressed,
    getBottomAction,
    handleDebugTitleTap,

    // ── Player profile card ──
    profileCardVisible,
    profileCardTargetUserId,
    profileCardTargetSeat,
    profileCardRosterName,
    closeProfileCard,
    handleProfileKick,

    // ── Local UI state ──
    isStartingGame,
    isHostActionSubmitting,
    isActionSubmitting,

    // ── Seat modal ──
    seatModalVisible,
    pendingSeat,
    modalType,
    isSeatSubmitting,
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
    isCapturingShareCard,
    nightReviewVisible,
    openNightReview,
    closeNightReview,

    // ── Share review modal ──
    shareReviewVisible,
    closeShareReview,
    shareNightReview: handleShareNightReview,

    // ── Choose card modal (treasureMaster / thief) ──
    chooseCardModalVisible,
    closeChooseCardModal,
    handleChooseCard,
    bottomCardDisabledIndices,
    bottomCardDisabledHint,
    bottomCardSubtitle,
  };
}
