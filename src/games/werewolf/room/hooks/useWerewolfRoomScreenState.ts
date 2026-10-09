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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { toast } from 'sonner-native';

import { useAuthContext } from '@/contexts/AuthContext';
import { useGachaStatusQuery } from '@/features/gacha/queries/useGachaQuery';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useRoomHostOperations } from '@/features/room/controllers/useRoomHostOperations';
import { useRoomProfileController } from '@/features/room/controllers/useRoomProfileController';
import { useRoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import { useRoomShareController } from '@/features/room/controllers/useRoomShareController';
import { useRoomTitleActions } from '@/features/room/controllers/useRoomTitleActions';
import { executeProfileKick } from '@/features/room/model/executeProfileKick';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type { RoomRecord } from '@/features/room/model/RoomDirectory';
import type { RoomProfileCardModel } from '@/features/room/model/RoomProfile';
import type { RoomShareModel } from '@/features/room/model/RoomShare';
import { usesRoomSideInspector } from '@/features/room/model/roomShellLayout';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import { useWerewolfRoom } from '@/games/werewolf/hooks/useWerewolfRoom';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import { createWerewolfRoomShellModel } from '@/games/werewolf/werewolfRoomAdapter';
import {
  createWerewolfRoomCapabilities,
  WEREWOLF_DISPLAY_NAME,
} from '@/games/werewolf/werewolfRoomAdapter';
import type { RootStackParamList } from '@/navigation/types';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import type { ActionIntent, HostControlEvent } from '../policy/types';
import { useRoomActionDialogs } from '../useRoomActionDialogs';
import { useRoomHostDialogs } from '../useRoomHostDialogs';
import { getWolfVoteSummary, toGameRoomLike } from '../werewolfRoom.helpers';
import type { LayoutContext, StaticButtonAction } from './bottomLayoutConfig';
import { STATIC_BUTTONS } from './bottomLayoutConfig';
import { useActionerState } from './useActionerState';
import { useActionOrchestrator } from './useActionOrchestrator';
import { useBottomLayout } from './useBottomLayout';
import { useInteractionDispatcher } from './useInteractionDispatcher';
import { useNightProgress } from './useNightProgress';
import { useNightReviewShare } from './useNightReviewShare';
import { useRoomActions } from './useRoomActions';
import { useRoomDerived } from './useRoomDerived';
import { useRoomIdentity } from './useRoomIdentity';
import { useRoomModals } from './useRoomModals';
import type { SheriffElectionPanelModel } from './useSheriffElection';
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

type CoreRoomState = ReturnType<typeof useWerewolfRoom>;
type DerivedState = ReturnType<typeof useRoomDerived>;
type HostDialogsState = ReturnType<typeof useRoomHostDialogs>;
type NightReviewShareState = ReturnType<typeof useNightReviewShare>;

/**
 * Explicit contract between this hook and WerewolfRoomScreen.
 *
 * The room shell model is assembled here (including the profile card,
 * whose gameDetails is a data description rendered by the Screen through
 * RoomShell's profileDetailsRenderer); the remaining fields are exactly
 * what the Screen's content sections render.
 */
export interface WerewolfRoomScreenState {
  readonly roomShellModel: RoomShellModel;
  readonly roomShare: RoomShareModel;
  readonly gameState: CoreRoomState['gameState'];
  readonly isHost: boolean;
  readonly roomStatus: GameStatus;
  readonly isAudioPlaying: boolean;
  readonly resolvedRoleRevealAnimation: ResolvedRoleRevealAnimation;
  readonly effectiveSeat: number | null;
  readonly effectiveRole: CoreRoomState['effectiveRole'];
  readonly currentSchema: CoreRoomState['currentSchema'];
  readonly clearAllSeats: CoreRoomState['clearAllSeats'];
  readonly boardUpvote: CoreRoomState['boardUpvote'];
  readonly boardWithdraw: CoreRoomState['boardWithdraw'];
  readonly sheriffElectionPanel: SheriffElectionPanelModel | null;
  readonly isSheriffInspectorVisible: boolean;
  readonly isSheriffDetailsVisible: boolean;
  readonly openSheriffDetails: () => void;
  readonly closeSheriffDetails: () => void;
  readonly isBgmPlaying: boolean;
  readonly playBgm: CoreRoomState['playBgm'];
  readonly stopBgm: CoreRoomState['stopBgm'];
  readonly villagerCount: DerivedState['villagerCount'];
  readonly wolfRoleItems: DerivedState['wolfRoleItems'];
  readonly godRoleItems: DerivedState['godRoleItems'];
  readonly specialRoleItems: DerivedState['specialRoleItems'];
  readonly villagerRoleItems: DerivedState['villagerRoleItems'];
  readonly mvpSelection: HostDialogsState['mvpSelection'];
  readonly closeMvpSelection: HostDialogsState['closeMvpSelection'];
  readonly isHostActionSubmitting: boolean;
  readonly roleCardVisible: boolean;
  readonly shouldPlayRevealAnimation: boolean;
  readonly isLoadingRole: boolean;
  readonly handleRoleCardClose: () => void;
  readonly skillPreviewRoleId: RoleId | null;
  readonly handleSkillPreviewOpen: (roleId: string) => void;
  readonly handleSkillPreviewClose: () => void;
  readonly resumeAfterRejoin: () => void;
  readonly needsContinueOverlay: boolean;
  readonly nightReviewData: NightReviewShareState['nightReviewData'];
  readonly nightReviewShareCardRef: NightReviewShareState['nightReviewShareCardRef'];
  readonly isCapturingShareCard: boolean;
  readonly nightReviewVisible: boolean;
  readonly closeNightReview: () => void;
  readonly shareReviewVisible: boolean;
  readonly closeShareReview: () => void;
  readonly shareNightReview: (allowedSeats: number[]) => Promise<void>;
  readonly chooseCardModalVisible: boolean;
  readonly closeChooseCardModal: () => void;
  readonly handleChooseCard: (index: number) => Promise<void>;
  readonly bottomCardDisabledIndices: number[];
  readonly bottomCardDisabledHint: string | undefined;
  readonly bottomCardSubtitle: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useWerewolfRoomScreenState(
  room: RoomRecord,
  navigation: RoomScreenNavigation,
  entryController: RoomEntryController,
  client: WerewolfGameClient,
): WerewolfRoomScreenState {
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
    selectMvp,
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
    boardUpvote,
    boardWithdraw,
    registerSheriffCandidate,
    cancelSheriffRegistration,
    withdrawSheriffCandidate,
    castSheriffVote,
    advanceSheriffElection,
    endSheriffElectionBySelfDestruct,
    // BGM manual control
    isBgmPlaying,
    playBgm,
    stopBgm,
    // Rejoin recovery
    resumeAfterRejoin,
    needsContinueOverlay,
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
    registerSheriffCandidate,
    cancelSheriffRegistration,
    withdrawSheriffCandidate,
    castSheriffVote,
    advanceSheriffElection,
    endSheriffElectionBySelfDestruct,
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

  const { handleTitlePress, handleTitleLongPress } = useRoomTitleActions();

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
  }, [
    currentStepId,
    gameState?.currentStepIndex,
    gameState?.roleRevealRandomNonce,
    myUserId,
    room.roomId,
    actorSeatForUi,
  ]);

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

  useEffect(() => {
    setChooseCardModalVisible(false);
  }, [
    room.roomId,
    myUserId,
    currentStepId,
    gameState?.currentStepIndex,
    gameState?.roleRevealRandomNonce,
    actorSeatForUi,
    imActioner,
  ]);

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

  const {
    nightReviewData,
    reportScopeKey,
    nightReviewShareCardRef,
    isCapturingShareCard,
    beginReportCapture,
    shareNightReviewReportDirectly,
  } = useNightReviewShare(room.roomId, roomCode, myUserId, gameState);

  const {
    showPrepareToFlipDialog,
    showStartGameDialog,
    showRestartDialog,
    handleSettingsPress,
    isHostActionSubmitting,
    mvpSelection,
    closeMvpSelection,
    showMvpSelection,
  } = useRoomHostDialogs({
    gameState,
    assignRoles,
    startGame,
    restartGame,
    selectMvp,
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
    reportScopeKey,
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
          return '全员已就位，等待房主分配角色';
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
          return '全员就绪，等待房主开始游戏 🔊';
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
          return `请点击下方「${STATIC_BUTTONS.viewRole.label}」查看你的身份`;
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

  // ─── Profile card assembly ──────────────────────────────────────────────

  const handleProfileKick = useCallback(() => {
    executeProfileKick(capabilities, profileController.selection);
  }, [capabilities, profileController.selection]);

  const handleProfileLeave = useCallback(() => {
    const capability = capabilities.canLeaveSeat;
    if (!capability.isAllowed) {
      throw new Error(`Cannot leave from profile: ${capability.reason}`);
    }
    capability.execute();
  }, [capabilities.canLeaveSeat]);

  const profile = useMemo((): RoomProfileCardModel | null => {
    const profileSelection = profileController.selection;
    if (profileSelection === null) return null;
    return {
      target: profileSelection.target,
      isSelf: profileSelection.isSelf,
      onClose: profileController.close,
      onKick:
        !profileSelection.isSelf && capabilities.canKickSeat.isAllowed ? handleProfileKick : null,
      onLeaveSeat:
        profileSelection.isSelf && capabilities.canLeaveSeat.isAllowed ? handleProfileLeave : null,
      gameDetails: {
        title: '阵营分布',
        statsUserId: profileSelection.target.userId,
      },
    };
  }, [
    capabilities.canKickSeat.isAllowed,
    capabilities.canLeaveSeat.isAllowed,
    handleProfileKick,
    handleProfileLeave,
    profileController.close,
    profileController.selection,
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Shell assembly (the Screen renders the model; it no longer assembles it)
  // ═══════════════════════════════════════════════════════════════════════════

  const { user } = useAuthContext();
  const { data: gachaStatus } = useGachaStatusQuery();
  const ticketCount = gachaStatus ? gachaStatus.normalDraws + gachaStatus.goldenDraws : null;

  const handleAvatarPress = useCallback(() => {
    navigation.navigate('Settings', { roomCode });
  }, [navigation, roomCode]);

  const handleMusicSettings = useCallback(() => {
    navigation.navigate('MusicSettings', { roomCode });
  }, [navigation, roomCode]);

  const { width: viewportWidth } = useWindowDimensions();
  const isSheriffInspectorVisible =
    sheriffElectionPanel !== null && usesRoomSideInspector(viewportWidth);
  const [isSheriffDetailsVisible, setIsSheriffDetailsVisible] = useState(false);
  const openSheriffDetails = useCallback(() => {
    setIsSheriffDetailsVisible(true);
  }, []);
  const closeSheriffDetails = useCallback(() => {
    setIsSheriffDetailsVisible(false);
  }, []);

  useEffect(() => {
    if (sheriffElectionPanel === null || isSheriffInspectorVisible) {
      setIsSheriffDetailsVisible(false);
    }
  }, [isSheriffInspectorVisible, sheriffElectionPanel]);

  const layoutCtx: LayoutContext = useMemo(
    () => ({
      roomStatus,
      isHost,
      effectiveSeat,
      imActioner,
      isAudioPlaying,
      nightReviewAllowedSeats: gameState.nightReviewAllowedSeats ?? [],
    }),
    [
      roomStatus,
      isHost,
      effectiveSeat,
      imActioner,
      isAudioPlaying,
      gameState.nightReviewAllowedSeats,
    ],
  );
  const bottomLayout = useBottomLayout({ ctx: layoutCtx, schemaVM: getBottomAction() });

  const handleSchemaButtonPress = useCallback(
    (intent: ActionIntent) => {
      dispatchInteraction({ kind: 'BOTTOM_ACTION', intent });
    },
    [dispatchInteraction],
  );

  const handleStaticButtonPress = useCallback(
    (action: StaticButtonAction) => {
      switch (action) {
        case 'viewRole':
          dispatchInteraction({ kind: 'VIEW_ROLE' });
          break;
        case 'waitForHost':
          toast.info('等待房主开始分配角色');
          break;
        case 'nightReview':
          openNightReview();
          break;
        default: {
          const exhaustiveAction: never = action;
          throw new Error(`Unhandled Werewolf static button action: ${exhaustiveAction}`);
        }
      }
    },
    [dispatchInteraction, openNightReview],
  );

  const handleHostControl = useCallback(
    (action: HostControlEvent['action']) => {
      dispatchInteraction({ kind: 'HOST_CONTROL', action });
    },
    [dispatchInteraction],
  );

  const executeMarkAllBotsViewed = useCallback(() => {
    void markAllBotsViewed().catch((err) => {
      handleError(err, {
        label: 'markAllBotsViewed',
        logger: roomScreenLog,
        feedback: false,
      });
    });
  }, [markAllBotsViewed]);

  const executeMarkAllBotsGroupConfirmed = useCallback(() => {
    void markAllBotsGroupConfirmed().catch((err) => {
      handleError(err, {
        label: 'markAllBotsGroupConfirmed',
        logger: roomScreenLog,
        feedback: false,
      });
    });
  }, [markAllBotsGroupConfirmed]);

  const roomShellModel = useMemo(
    (): RoomShellModel =>
      createWerewolfRoomShellModel({
        roomCode,
        capabilities,
        connection: roomConnection.connection,
        seatConfirmation,
        profile,
        share: shareController,
        user,
        ticketCount,
        onBack: () => dispatchInteraction({ kind: 'LEAVE_ROOM' }),
        onTitlePress: handleTitlePress,
        onTitleLongPress: handleTitleLongPress,
        onAvatarPress: handleAvatarPress,
        roomStatus,
        isHost,
        isDebugMode,
        isAudioPlaying,
        isActionSubmitting,
        isStartingGame,
        isHostActionSubmitting,
        imActioner,
        isPlagueMode: gameState.rules?.isPlagueMode ?? false,
        actionMessage: derived.actionMessage,
        guideMessage,
        nightProgress,
        seatViewModels: derived.seatViewModels,
        controlledSeat,
        sheriffElectionPanel,
        stateRevision,
        onSeatPress: onSeatTapped,
        onSeatLongPressed: onSeatLongPressed,
        hasBots,
        controlledBotName:
          controlledSeat === null
            ? null
            : (gameState.players.get(controlledSeat)?.displayName ?? null),
        onReleaseBot: releaseBot,
        mvpSeat:
          gameState.startingParticipants?.find(
            (participant) => participant.userId === gameState.mvpUserId,
          )?.seat ?? null,
        onSelectMvp: showMvpSelection,
        currentSchemaKind: currentSchema?.kind ?? null,
        onHostControl: handleHostControl,
        onMusicSettings: handleMusicSettings,
        onMarkAllBotsViewed: executeMarkAllBotsViewed,
        onMarkAllBotsGroupConfirmed: executeMarkAllBotsGroupConfirmed,
        onNightReview: openNightReview,
        onLastNightInfo: () => {
          void showLastNightInfo();
        },
        bottomLayout,
        onSchemaButtonPress: handleSchemaButtonPress,
        onStaticButtonPress: handleStaticButtonPress,
        isSheriffInspectorVisible,
        openSheriffDetails,
      }),
    [
      roomCode,
      capabilities,
      roomConnection,
      seatConfirmation,
      profile,
      shareController,
      user,
      ticketCount,
      handleTitlePress,
      handleTitleLongPress,
      handleAvatarPress,
      dispatchInteraction,
      roomStatus,
      isHost,
      isDebugMode,
      isAudioPlaying,
      isActionSubmitting,
      isStartingGame,
      isHostActionSubmitting,
      imActioner,
      gameState,
      derived,
      guideMessage,
      nightProgress,
      controlledSeat,
      sheriffElectionPanel,
      stateRevision,
      onSeatTapped,
      onSeatLongPressed,
      hasBots,
      releaseBot,
      showMvpSelection,
      currentSchema,
      handleHostControl,
      handleMusicSettings,
      executeMarkAllBotsViewed,
      executeMarkAllBotsGroupConfirmed,
      openNightReview,
      showLastNightInfo,
      bottomLayout,
      handleSchemaButtonPress,
      handleStaticButtonPress,
      isSheriffInspectorVisible,
      openSheriffDetails,
    ],
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Return bag
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    roomShellModel,
    roomShare: shareController,
    gameState,
    isHost,
    roomStatus,
    isAudioPlaying,
    resolvedRoleRevealAnimation,
    effectiveSeat,
    effectiveRole,
    currentSchema,
    clearAllSeats,
    boardUpvote,
    boardWithdraw,
    sheriffElectionPanel,
    isSheriffInspectorVisible,
    isSheriffDetailsVisible,
    openSheriffDetails,
    closeSheriffDetails,
    isBgmPlaying,
    playBgm,
    stopBgm,
    villagerCount: derived.villagerCount,
    wolfRoleItems: derived.wolfRoleItems,
    godRoleItems: derived.godRoleItems,
    specialRoleItems: derived.specialRoleItems,
    villagerRoleItems: derived.villagerRoleItems,
    mvpSelection,
    closeMvpSelection,
    isHostActionSubmitting,
    roleCardVisible,
    shouldPlayRevealAnimation,
    isLoadingRole,
    handleRoleCardClose,
    skillPreviewRoleId,
    handleSkillPreviewOpen,
    handleSkillPreviewClose,
    resumeAfterRejoin,
    needsContinueOverlay,
    nightReviewData,
    nightReviewShareCardRef,
    isCapturingShareCard,
    nightReviewVisible,
    closeNightReview,
    shareReviewVisible,
    closeShareReview,
    shareNightReview: handleShareNightReview,
    chooseCardModalVisible,
    closeChooseCardModal,
    handleChooseCard,
    bottomCardDisabledIndices,
    bottomCardDisabledHint,
    bottomCardSubtitle,
  };
}
