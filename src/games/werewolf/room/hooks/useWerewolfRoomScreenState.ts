/**
 * useWerewolfRoomScreenState — Composition root that wires all WerewolfRoomScreen sub-hooks together.
 *
 * Calls hooks in dependency order and returns a flat bag consumed by WerewolfRoomScreen JSX.
 * Identity → actioner → derived → actions → orchestrator → dialogs → interaction.
 * Does not render JSX, own styles, or contain business logic.
 */

import type { RoleAction } from '@game-judge/game-engine/games/werewolf/public';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { ROLE_SPECS } from '@game-judge/game-engine/games/werewolf/public';
import { Faction } from '@game-judge/game-engine/games/werewolf/public';
import type { ResolvedRoleRevealAnimation } from '@game-judge/game-engine/product/rewards';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { View } from 'react-native';

import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useRoomHostOperations } from '@/features/room/controllers/useRoomHostOperations';
import { useRoomProfileController } from '@/features/room/controllers/useRoomProfileController';
import { useRoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import { useRoomShareController } from '@/features/room/controllers/useRoomShareController';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type { RoomRecord } from '@/features/room/model/RoomDirectory';
import { useWerewolfRoom } from '@/games/werewolf/hooks/useWerewolfRoom';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import { uploadNightReviewImage } from '@/games/werewolf/services/uploadNightReviewImage';
import {
  createWerewolfRoomCapabilities,
  WEREWOLF_DISPLAY_NAME,
} from '@/games/werewolf/werewolfRoomAdapter';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme';
import { showErrorAlert } from '@/utils/alertPresets';
import { roomScreenLog } from '@/utils/logger';
import { isMiniProgram, wxPreviewImage } from '@/utils/miniProgram';

import { buildNightReviewData } from '../NightReview.helpers';
import {
  captureNightReviewCard,
  renderNightReviewToCanvas,
  shareNightReviewReportImage,
} from '../shareNightReview';
import { useRoomActionDialogs } from '../useRoomActionDialogs';
import { useRoomHostDialogs } from '../useRoomHostDialogs';
import { getWolfVoteSummary, toGameRoomLike } from '../werewolfRoom.helpers';
import { useActionerState } from './useActionerState';
import { useActionOrchestrator } from './useActionOrchestrator';
import { useHiddenDebugTrigger } from './useHiddenDebugTrigger';
import { useInteractionDispatcher } from './useInteractionDispatcher';
import { useNightProgress } from './useNightProgress';
import { useRoomActions } from './useRoomActions';
import { useRoomDerived } from './useRoomDerived';
import { useRoomIdentity } from './useRoomIdentity';
import { useRoomModals } from './useRoomModals';
import { useSheriffElection } from './useSheriffElection';
import { useStepDeadlineCountdown } from './useStepDeadlineCountdown';
import { useWerewolfActionDraft } from './useWerewolfActionDraft';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Stable empty Map to avoid new reference on every render when gameState is null */
const EMPTY_ACTIONS: Map<RoleId, RoleAction> = new Map();

/** Stable empty array for groupConfirm acks when not in a groupConfirm step */
const EMPTY_ACKS: readonly number[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Navigation type required by useWerewolfRoomScreenState */
type RoomScreenNavigation = NativeStackNavigationProp<RootStackParamList, 'Room'>;

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useWerewolfRoomScreenState(
  room: RoomRecord,
  navigation: RoomScreenNavigation,
  entryController: RoomEntryController,
  client: WerewolfGameClient,
) {
  const { roomCode } = room;

  // ═══════════════════════════════════════════════════════════════════════════
  // Core game room hook
  // ═══════════════════════════════════════════════════════════════════════════

  const {
    gameState,
    stateRevision,
    isHost,
    mySeat,
    myRole,
    myUserId,
    roomStatus,
    currentActionRole,
    currentSchema,
    currentStepId,
    isAudioPlaying,
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
    takeOverBot,
    releaseBot,
    effectiveSeat,
    effectiveRole,
    // Progression
    postProgression,
    // Board nomination
    boardNominate,
    boardUpvote,
    boardWithdraw,
    registerSheriffCandidate,
    cancelSheriffRegistration,
    withdrawSheriffCandidate,
    castSheriffVote,
    advanceSheriffElection,
    // BGM manual control
    isBgmPlaying,
    playBgm,
    stopBgm,
    // Rejoin recovery
    resumeAfterRejoin,
    needsContinueOverlay,
    dismissContinueOverlay,
  } = useWerewolfRoom(client);

  // ═══════════════════════════════════════════════════════════════════════════
  // Personal role reveal animation (from GameState roster, already resolved)
  // ═══════════════════════════════════════════════════════════════════════════

  const resolvedRoleRevealAnimation: ResolvedRoleRevealAnimation = useMemo(() => {
    if (mySeat === null || !gameState) return 'none';
    const effect = gameState.players.get(mySeat)?.roleRevealEffect;
    if (!effect) return 'none';
    return effect;
  }, [mySeat, gameState]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Derived primitives
  // ═══════════════════════════════════════════════════════════════════════════

  const hasBots = useMemo(() => {
    if (!gameState) return false;
    return Array.from(gameState.players.values()).some((p) => p?.isBot);
  }, [gameState]);

  const sheriffElectionPanel = useSheriffElection({
    gameState,
    effectiveSeat,
    isHost,
    isAudioPlaying,
    registerSheriffCandidate,
    cancelSheriffRegistration,
    withdrawSheriffCandidate,
    castSheriffVote,
    advanceSheriffElection,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Local UI state
  // ═══════════════════════════════════════════════════════════════════════════

  const [secondSeat, setSecondSeat] = useState<number | null>(null);
  const [isStartingGame, setIsStartingGame] = useState(false);

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

  const roomConnection = entryController;

  const seatController = useRoomSeatController({
    currentSeat: mySeat,
    takeSeat,
  });
  const profileController = useRoomProfileController({
    myUserId,
    kickSeat: kickPlayer,
    leaveSeat,
  });
  const shareController = useRoomShareController({
    roomCode,
    gameDisplayName: WEREWOLF_DISPLAY_NAME,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Actor Identity (delegated to useRoomIdentity)
  // ═══════════════════════════════════════════════════════════════════════════

  const wolfVotesMap = useMemo(() => {
    const raw = gameState?.currentNightResults?.wolfVotesBySeat;
    if (!raw) return new Map<number, number>();
    const map = new Map<number, number>();
    for (const [k, v] of Object.entries(raw)) {
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

  const groupConfirmAcks = useMemo((): readonly number[] => {
    if (currentSchema?.kind !== 'groupConfirm' || !gameState) return EMPTY_ACKS;
    if (currentSchema.id === 'awakenedGargoyleConvertReveal') return gameState.conversionRevealAcks;
    if (currentSchema.id === 'seedWolfInfectReveal') {
      return gameState.seedWolfInfectionRevealAcks;
    }
    if (currentSchema.id === 'cupidLoversReveal') return gameState.cupidLoversRevealAcks;
    return gameState.piperRevealAcks;
  }, [currentSchema, gameState]);

  const { imActioner, showWolves } = useActionerState({
    actorRole: actorRoleForUi,
    currentActionRole,
    currentSchema,
    actorSeat: actorSeatForUi,
    wolfVotes: wolfVotesMap,
    actions: gameState?.actions ?? EMPTY_ACTIONS,
    currentNightResults: gameState?.currentNightResults,
    groupConfirmAcks,
  });

  const actionDraftScope = useMemo(() => {
    if (
      !imActioner ||
      gameState === null ||
      myUserId === null ||
      currentStepId === null ||
      currentStepId === undefined ||
      actorSeatForUi === null ||
      gameState.currentStepIndex < 0 ||
      gameState.template.numberOfPlayers === 0
    ) {
      return null;
    }
    return {
      scope: {
        roomId: room.roomId,
        userId: myUserId,
        currentStepId,
        currentStepIndex: gameState.currentStepIndex,
        roleRevealRandomNonce: gameState.roleRevealRandomNonce ?? null,
        actorSeat: actorSeatForUi,
      },
      seatCount: gameState.template.numberOfPlayers,
    };
  }, [actorSeatForUi, currentStepId, gameState, imActioner, myUserId, room.roomId]);
  const { firstSwapSeat, multiSelectedSeats, setFirstSwapSeat, setMultiSelectedSeats } =
    useWerewolfActionDraft(actionDraftScope);

  // ═══════════════════════════════════════════════════════════════════════════
  // Side effects
  // ═══════════════════════════════════════════════════════════════════════════

  // Reset UI state when game restarts
  useEffect(() => {
    if (!gameState) return;
    if (roomStatus === GameStatus.Unseated || roomStatus === GameStatus.Seated) {
      roomScreenLog.debug('Resetting UI state for restart', { roomStatus });
      setIsStartingGame(false);
      setFirstSwapSeat(null);
      setSecondSeat(null);
      setMultiSelectedSeats([]);
    }
  }, [gameState, roomStatus, setFirstSwapSeat, setMultiSelectedSeats]);

  // A confirmation dialog is ephemeral; a restored first target remains editable.
  useEffect(() => {
    setSecondSeat(null);
  }, [currentStepId, gameState?.currentStepIndex, gameState?.roleRevealRandomNonce]);

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
    effectiveRole,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Dialog Layer
  // ═══════════════════════════════════════════════════════════════════════════

  const actionDialogs = useRoomActionDialogs();

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

  const { handleActionIntent, isActionSubmitting } = useActionOrchestrator({
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
    hasPendingActionCommand: roomConnection.connection.pendingCommandCount > 0,
    needsContinueOverlay,
    firstSwapSeat,
    setFirstSwapSeat,
    setSecondSeat,
    submitAction,
    submitRevealAck,
    sendWolfRobotHunterStatusViewed,
    submitGroupConfirmAck,
    multiSelectedSeats,
    setMultiSelectedSeats,
    getAutoTriggerIntent,
    actionDialogs,
    openChooseCardModal,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Host Dialogs
  // ═══════════════════════════════════════════════════════════════════════════

  const nightReviewData = useMemo(() => {
    if (!gameState?.currentNightResults) return null;
    if (gameState.status !== GameStatus.Ended) return null;
    return buildNightReviewData(gameState);
  }, [gameState]);
  const nightReviewShareCardRef = useRef<View>(null);
  const [isCapturingShareCard, setIsCapturingShareCard] = useState(false);
  const cachedShareBase64Ref = useRef<string | null>(null);

  // Begin report capture on demand (called when user opens "本局复盘" alert).
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

  const shareNightReviewReportDirectly = useCallback(async (): Promise<boolean> => {
    if (!nightReviewData) {
      showErrorAlert('分享失败', '当前暂无可分享的战报');
      return false;
    }

    // Use base64 pre-captured by beginReportCapture (triggered when "本局复盘" alert opened)
    const base64 = cachedShareBase64Ref.current;

    // Mini program web-view: Canvas 2D → upload to R2 → wx.previewImage
    if (isMiniProgram()) {
      try {
        const canvasBase64 = renderNightReviewToCanvas(nightReviewData, roomCode, colors);
        const url = await uploadNightReviewImage(canvasBase64);
        await wxPreviewImage(url);
        return true;
      } catch (err) {
        roomScreenLog.error('Mini program share failed', err);
        showErrorAlert('分享失败', '无法分享战报，请稍后重试');
        return false;
      }
    }

    if (base64) {
      const result = await shareNightReviewReportImage(() => Promise.resolve(base64), roomCode);
      if (result === 'failed') {
        showErrorAlert('分享失败', '无法分享战报，请稍后重试');
        return false;
      }
      return true;
    }

    // Fallback: on-demand capture (Chrome may download instead of share due to activation expiry)
    const freshBase64 = await beginReportCapture();
    if (!freshBase64) {
      showErrorAlert('分享失败', '无法生成战报截图，请稍后重试');
      return false;
    }
    const result = await shareNightReviewReportImage(() => Promise.resolve(freshBase64), roomCode);
    if (result === 'failed') {
      showErrorAlert('分享失败', '无法分享战报，请稍后重试');
      return false;
    }
    return true;
  }, [nightReviewData, roomCode, beginReportCapture]);

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
    shareNightReviewReport: shareNightReviewReportDirectly,
    setIsStartingGame,
    navigation,
    roomCode,
  });

  const hostOperations = useRoomHostOperations({
    clearSeats: clearAllSeats,
    fillBots: fillWithBots,
  });

  const hasOccupiedSeats = useMemo(
    () =>
      gameState ? Array.from(gameState.players.values()).some((player) => player !== null) : false,
    [gameState],
  );

  const capabilities = useMemo(
    (): RoomCapabilities =>
      createWerewolfRoomCapabilities({
        status: roomStatus,
        isHost,
        mySeat,
        isDebugMode,
        isAudioPlaying,
        hasOccupiedSeats,
        requestTakeSeat: seatController.requestTakeSeat,
        requestMoveSeat: seatController.requestMoveSeat,
        leaveSeat: profileController.leaveSelf,
        kickSeat: profileController.kick,
        clearSeats: hostOperations.requestClearSeats,
        fillBots: hostOperations.requestFillBots,
        configureGame: handleSettingsPress,
        openProfile: profileController.open,
        takeOverBot,
        shareRoom: shareController.open,
      }),
    [
      roomStatus,
      isHost,
      mySeat,
      isDebugMode,
      isAudioPlaying,
      hasOccupiedSeats,
      seatController.requestTakeSeat,
      seatController.requestMoveSeat,
      profileController.leaveSelf,
      profileController.kick,
      profileController.open,
      hostOperations.requestClearSeats,
      hostOperations.requestFillBots,
      handleSettingsPress,
      takeOverBot,
      shareController.open,
    ],
  );

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

  const { requestExit } = roomConnection;
  const requestRoomExit = useCallback(() => {
    requestExit(capabilities.shouldConfirmExit);
  }, [capabilities.shouldConfirmExit, requestExit]);

  const { dispatchInteraction, onSeatTapped, onSeatLongPressed } = useInteractionDispatcher({
    gameState,
    roomStatus,
    isAudioPlaying,
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
    capabilities,
    requestRoomExit,
    releaseBot,
    setShouldPlayRevealAnimation,
    setIsLoadingRole,
    setRoleCardVisible,
    viewedRole,
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
          return '全员已就位 → 点击下方「分配角色」｜右上角菜单可清空座位';
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
        case GameStatus.Day:
          return null;
        case GameStatus.Ended:
          return '天亮了 →「昨夜信息」查看结果，「本局复盘」查看/分享战报';
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
      case GameStatus.Day:
        return null;
      case GameStatus.Ended: {
        let hostSeat: number | null = null;
        for (const [seat, p] of players) {
          if (p?.userId === gameState.hostUserId) {
            hostSeat = seat;
            break;
          }
        }
        const hostLabel = hostSeat !== null ? `${hostSeat + 1}号玩家` : '房主';
        return `天亮了 → 昨夜信息/本局复盘由${hostLabel}操作`;
      }
      default:
        return null;
    }
  }, [isHost, gameState, roomStatus]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Choose card handler (treasureMaster / thief bottom card selection)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleChooseCard = useCallback(
    async (cardIndex: number) => {
      closeChooseCardModal();
      await submitAction({ kind: 'card', cardIndex });
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

  const seatConfirmation = useMemo(
    () =>
      seatController.pendingAction === null
        ? null
        : {
            action: seatController.pendingAction,
            isSubmitting: seatController.isSubmitting,
            onConfirm: seatController.confirm,
            onCancel: seatController.cancel,
          },
    [
      seatController.cancel,
      seatController.confirm,
      seatController.isSubmitting,
      seatController.pendingAction,
    ],
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Return bag
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // ── Route params ──
    roomCode,

    // ── Game state (from useWerewolfRoom) ──
    gameState,
    stateRevision,
    isHost,
    mySeat,
    roomStatus,
    currentActionRole,
    currentSchema,
    isAudioPlaying,
    resolvedRoleRevealAnimation,
    effectiveSeat,
    effectiveRole,
    isDebugMode,
    controlledSeat,
    hasBots,
    markAllBotsViewed,
    markAllBotsGroupConfirmed,
    clearAllSeats,
    releaseBot,
    capabilities,
    roomConnection: roomConnection.connection,
    roomShare: shareController,

    // ── Board nomination ──
    boardNominate,
    boardUpvote,
    boardWithdraw,

    // ── First-day sheriff election ──
    sheriffElectionPanel,

    // ── BGM manual control ──
    isBgmPlaying,
    playBgm,
    stopBgm,

    // ── Derived view models (from useRoomDerived) ──
    ...derived,
    nightProgress,
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
    profileSelection: profileController.selection,
    closeProfile: profileController.close,

    // ── Local UI state ──
    isStartingGame,
    isHostActionSubmitting,
    isActionSubmitting,

    // ── Seat modal ──
    seatConfirmation,

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
