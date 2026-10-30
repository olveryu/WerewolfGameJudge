/**
 * useWerewolfRoomState — the Werewolf room, composed from the shared room
 * controllers plus the game's own night / day / host hooks.
 *
 * Order of truth: the ready session's `GameState` → the engine's
 * viewer-cropped `WerewolfViewModel` → the night interaction model →
 * the shell model. The screen renders what this hook returns and owns
 * nothing but screen-local toggles (skill preview, strategy sheet).
 */

import {
  type GameState,
  GameStatus,
  getPlayerCount,
  getWerewolfNightReview,
  getWerewolfUserSeat,
  getWerewolfViewModel,
  readArmedDeadline,
  type RoleId,
  type WerewolfNightReview,
  type WerewolfViewModel,
} from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { getBotDisplayName } from '@game-judge/game-engine/platform/room/getBotDisplayName';
import { isBotOccupant, isBotSeat } from '@game-judge/game-engine/platform/room/seating/roster';
import {
  parseResolvedRoleRevealAnimation,
  type ResolvedRoleRevealAnimation,
} from '@game-judge/game-engine/product/rewards';
import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { createRoomSeatPressHandler } from '@/features/room/controllers/createRoomSeatPressHandler';
import { useBotTakeover } from '@/features/room/controllers/useBotTakeover';
import { useLastActionToast } from '@/features/room/controllers/useLastActionToast';
import { useReadyRoomSession } from '@/features/room/controllers/useReadyRoomSession';
import { type RoleViewing, useRoleViewing } from '@/features/room/controllers/useRoleViewing';
import {
  type RoomAudioResume,
  useRoomAudioResume,
} from '@/features/room/controllers/useRoomAudioResume';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useRoomPresentationController } from '@/features/room/controllers/useRoomPresentationController';
import { useRoomRosterController } from '@/features/room/controllers/useRoomRosterController';
import { useScopedDraft } from '@/features/room/hooks/useScopedDraft';
import { useStageDeadline } from '@/features/room/hooks/useStageDeadline';
import { createRoomProfileCardModel } from '@/features/room/model/createRoomProfileCardModel';
import { createRoomSeatConfirmationModel } from '@/features/room/model/createRoomSeatConfirmationModel';
import { getRoomProfileTarget } from '@/features/room/model/getRoomProfileTarget';
import { getRoomOccupantUserId } from '@/features/room/model/RoomOccupant';
import { createRoomSeatTapIntentResolver } from '@/features/room/model/RoomSeatTap';
import { usesRoomSideInspector } from '@/features/room/model/roomShellLayout';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { RoomViewer } from '@/features/room/model/RoomViewer';
import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import type {
  WerewolfRoomSession,
  WerewolfSubmit,
} from '@/games/werewolf/model/WerewolfRoomSession';

import { EMPTY_PANEL_FLOW_PROGRESS, type PanelFlowProgress } from '../day/panelFlow';
import { type SheriffElectionPanelModel, useSheriffElection } from '../day/useSheriffElection';
import { buildWerewolfGuideMessage } from '../werewolfGuideMessage';
import {
  createWerewolfBottomActionLayout,
  createWerewolfBottomActions,
  createWerewolfRoomCapabilities,
  createWerewolfRoomShellModel,
  isWerewolfSetup,
  WEREWOLF_DISPLAY_NAME,
} from '../werewolfRoomAdapter';
import { getWerewolfRoomCommandFailureMessage } from '../werewolfRoomCommandFailureMessage';
import { type NightInteraction, useNightInteraction } from './useNightInteraction';
import { useNightReviewShare } from './useNightReviewShare';
import { useRoomModals } from './useRoomModals';
import { useWerewolfAudioOrchestration } from './useWerewolfAudioOrchestration';
import { useWerewolfBgmControl, type WerewolfBgmControlState } from './useWerewolfBgmControl';
import { type MvpSelection, useWerewolfHostFlow } from './useWerewolfHostFlow';

const PANEL_FLOW_NAMESPACE = 'werewolf:panel-flow';

/** Passive toasts for non-hosts, keyed by the host command that produced the revision. */
const LAST_ACTION_TOASTS = {
  'werewolf.roles.assign': {
    level: 'info',
    text: '角色已分配，点击下方「查看身份」查看你的身份',
  },
  'werewolf.game.begin': { level: 'info', text: '夜幕降临，请等待指示' },
  'werewolf.game.redeal': { level: 'info', text: '房主已重新开始游戏' },
} as const;

export interface WerewolfRoleCard {
  readonly viewing: RoleViewing;
  /** The effective seat's role; null before the deal or for spectators. */
  readonly roleId: RoleId | null;
  readonly resolvedAnimation: ResolvedRoleRevealAnimation;
}

export interface WerewolfNightReviewPresentation {
  readonly data: WerewolfNightReview | null;
  readonly isVisible: boolean;
  readonly close: () => void;
  readonly shareCardRef: ReturnType<typeof useNightReviewShare>['nightReviewShareCardRef'];
  readonly isCapturingShareCard: boolean;
  readonly shareRun: ReturnType<typeof useNightReviewShare>['shareRun'];
  readonly cancelShare: () => void;
  readonly isShareSeatsVisible: boolean;
  readonly shareSeats: readonly { readonly seat: number; readonly displayName: string }[];
  readonly closeShareSeats: () => void;
  readonly shareToSeats: (allowedSeats: readonly number[]) => Promise<void>;
}

export interface WerewolfBoardNominations {
  readonly upvote: (targetUserId: string) => void;
  readonly withdraw: () => void;
  /** Adopt a nominated board: clears seats first when the player count changes. */
  readonly adopt: (roles: readonly RoleId[]) => Promise<void>;
}

export interface WerewolfRoomScreenState {
  readonly state: GameState;
  readonly viewModel: WerewolfViewModel;
  readonly shellModel: RoomShellModel;
  readonly roomCode: string;
  readonly userId: string;
  readonly isHost: boolean;
  readonly effectiveSeat: number | null;
  readonly submit: WerewolfSubmit;
  readonly bgm: WerewolfBgmControlState;
  readonly roleCard: WerewolfRoleCard;
  readonly audioResume: RoomAudioResume;
  readonly night: NightInteraction;
  readonly sheriffElectionPanel: SheriffElectionPanelModel | null;
  readonly isSheriffInspectorVisible: boolean;
  readonly isSheriffDetailsVisible: boolean;
  readonly openSheriffDetails: () => void;
  readonly closeSheriffDetails: () => void;
  readonly mvpSelection: MvpSelection | null;
  readonly closeMvpSelection: () => void;
  readonly isHostActionSubmitting: boolean;
  readonly nightReview: WerewolfNightReviewPresentation;
  readonly boardNominations: WerewolfBoardNominations;
}

const resolveWerewolfSeatTapIntent = createRoomSeatTapIntentResolver<GameState>((state, seat) =>
  getRoomProfileTarget(state.roster, seat),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parsePanelFlowProgress(value: unknown): PanelFlowProgress {
  if (!isRecord(value)) throw new Error('Panel flow progress must be an object');
  const { lastNightInfoConfirmed, nightReviewOpened } = value;
  if (typeof lastNightInfoConfirmed !== 'boolean' || typeof nightReviewOpened !== 'boolean') {
    throw new Error('Panel flow progress flags must be booleans');
  }
  return { lastNightInfoConfirmed, nightReviewOpened };
}

function buildLastNightInfo(state: GameState): string {
  const parts: string[] = [];
  const deaths = state.lastNightDeaths ?? [];
  parts.push(
    deaths.length === 0
      ? '昨夜平安夜'
      : `昨夜死亡: ${deaths.map((seat) => formatSeat(seat)).join(', ')}`,
  );
  const results = state.currentNightResults ?? {};
  if (results.silencedSeat != null) parts.push(`${formatSeat(results.silencedSeat)}被禁言`);
  if (results.votebannedSeat != null) parts.push(`${formatSeat(results.votebannedSeat)}被禁票`);
  return parts.join('\n');
}

function buildCurseInfo(state: GameState): string | null {
  if (!state.templateRoles.includes('crow')) return null;
  const cursedSeat = state.currentNightResults?.cursedSeat;
  if (cursedSeat == null) return '乌鸦未诅咒任何人';
  return `${formatSeat(cursedSeat)}被诅咒（放逐+1票）`;
}

export function useWerewolfRoomState(
  props: GameRoomScreenProps<'werewolf'> & {
    readonly session: WerewolfRoomSession;
    readonly entryController: RoomEntryController;
    readonly audio: WerewolfAudioRuntime;
  },
): WerewolfRoomScreenState {
  const { session, room, navigation, entryController, audio } = props;
  const roomCode = room.roomCode;
  const isFocused = useIsFocused();
  const ready = useReadyRoomSession(session, getWerewolfRoomCommandFailureMessage);
  const { user, state, revision, submit } = ready;
  const isHost = state.hostUserId === user.id;
  const mySeat = getWerewolfUserSeat(state, user.id);
  const viewer: RoomViewer = { userId: user.id, isHost, seat: mySeat };
  const status = state.status;

  // ── Bots, viewer, projection ──
  const bots = useBotTakeover({
    viewer,
    isBotSeat: (seat) => isBotSeat(state.roster, seat),
    gameName: 'Werewolf',
  });
  const { controlledSeat, effectiveSeat } = bots;
  const viewModel = useMemo(
    () => getWerewolfViewModel(state, { seat: effectiveSeat, isHost }),
    [effectiveSeat, isHost, state],
  );

  // ── Audio: narration orchestration, host resume gate, BGM ──
  const bgm = useWerewolfBgmControl(isHost, status, state.isAudioPlaying);
  const orchestration = useWerewolfAudioOrchestration({ session, isHost, audio });
  const audioResume = useRoomAudioResume({
    isHost,
    isNarratedPhase: status === GameStatus.Ongoing,
    isFocused,
    revision,
    readWasAudioInterrupted: orchestration.readWasAudioInterrupted,
    resume: orchestration.resumeAfterRejoin,
    onResumed: bgm.startBgmIfEnabled,
  });

  useLastActionToast({
    lastCommand: ready.lastCommand,
    isHost,
    mySeat,
    isFocused,
    messages: LAST_ACTION_TOASTS,
  });

  // ── Shared room controllers ──
  const { share, titleActions, gachaStatus } = useRoomPresentationController({
    roomCode,
    gameDisplayName: WEREWOLF_DISPLAY_NAME,
    isHost,
    entryReason: props.entryReason,
  });
  const { seatController, profile, actions } = useRoomRosterController({
    session,
    user,
    mySeat,
  });
  const configureGame = useCallback(
    () => navigation.navigate('GameConfig', { gameType: 'werewolf', mode: 'edit', roomCode }),
    [navigation, roomCode],
  );
  const capabilities = createWerewolfRoomCapabilities({
    status,
    isHost,
    mySeat,
    hasOccupiedSeats: Object.values(state.roster).some((occupant) => occupant != null),
    ...actions,
    configureGame,
    takeOverBots: bots.capability,
    shareRoom: share.open,
  });

  // ── Deadline: the armed night step / sheriff vote; expiry is a race every client may win ──
  const armedDeadline = readArmedDeadline(state);
  const expirePhase = useCallback(
    () =>
      session.dispatch(
        { type: 'werewolf.phase.expire' },
        { controlledSeat: null, label: '阶段超时结算', durable: true },
      ),
    [session],
  );
  const shouldExpirePhase = useCallback(() => {
    if (armedDeadline === null || controlledSeat !== null) return false;
    const current = session.getSnapshot();
    if (current.phase !== 'ready' || current.status.kind !== 'live') return false;
    if (current.pendingDurableCount > 0) return false;
    const live = readArmedDeadline(current.room.state);
    return (
      live !== null &&
      live.phase === armedDeadline.phase &&
      live.deadlineAt === armedDeadline.deadlineAt &&
      current.room.state.gameSequence === state.gameSequence
    );
  }, [armedDeadline, controlledSeat, session, state.gameSequence]);
  const { nowMs } = useStageDeadline({
    deadlineAt: armedDeadline?.deadlineAt ?? null,
    shouldExpire: shouldExpirePhase,
    onExpire: expirePhase,
    label: '阶段超时结算',
    silentExpire: true,
  });

  // ── Night ──
  const night = useNightInteraction({
    state,
    viewModel,
    userId: user.id,
    roomId: room.roomId,
    controlledSeat,
    effectiveSeat,
    isAudioResumeDue: audioResume.isDue,
    hasPendingCommand: entryController.connection.pendingDurableCount > 0,
    nowMs,
    submit,
  });

  // ── Identity viewing ──
  const myRole = viewModel.myRole;
  const roleViewing = useRoleViewing({
    effectiveSeat,
    identityKey: myRole === null ? null : state.gameSequence,
    hasViewed: effectiveSeat !== null && viewModel.viewedSeats.includes(effectiveSeat),
    occupiedSeatCount: viewModel.seats.length,
    viewedSeatCount: viewModel.viewedSeats.length,
    submitViewed: () => submit('查看身份', { type: 'werewolf.role.viewed' }, { controlledSeat }),
  });
  const ownOccupant = mySeat === null ? null : state.roster[mySeat];
  // A bot card opened through takeover never animates (no equipped effect).
  const resolvedAnimation: ResolvedRoleRevealAnimation =
    controlledSeat !== null ||
    ownOccupant == null ||
    isBotOccupant(ownOccupant) ||
    ownOccupant.profile.revealEffect === undefined
      ? 'none'
      : parseResolvedRoleRevealAnimation(ownOccupant.profile.revealEffect);

  // ── Day: sheriff election ──
  const sheriffElectionPanel = useSheriffElection({
    gameState: state,
    effectiveSeat,
    isHost,
    submit: (label, command) => submit(label, command, { controlledSeat }),
  });
  const { width: viewportWidth } = useWindowDimensions();
  const isSheriffInspectorVisible =
    sheriffElectionPanel !== null && usesRoomSideInspector(viewportWidth);
  const [isSheriffDetailsVisible, setIsSheriffDetailsVisible] = useState(false);
  const openSheriffDetails = useCallback(() => setIsSheriffDetailsVisible(true), []);
  const closeSheriffDetails = useCallback(() => setIsSheriffDetailsVisible(false), []);
  useEffect(() => {
    if (sheriffElectionPanel === null || isSheriffInspectorVisible) {
      setIsSheriffDetailsVisible(false);
    }
  }, [isSheriffInspectorVisible, sheriffElectionPanel]);

  // ── Night review: data, share capture, entry alerts ──
  const nightReviewData = useMemo(
    () =>
      status === GameStatus.Day || status === GameStatus.Ended
        ? getWerewolfNightReview(state)
        : null,
    [state, status],
  );
  const roleRevealRandomNonce = state.roleRevealRandomNonce ?? null;
  const reviewShare = useNightReviewShare(
    room.roomId,
    roomCode,
    user.id,
    nightReviewData,
    roleRevealRandomNonce,
  );
  const panelFlow = useScopedDraft<PanelFlowProgress>({
    namespace: PANEL_FLOW_NAMESPACE,
    userId: user.id,
    roomId: room.roomId,
    scope: { roleRevealRandomNonce },
    initial: EMPTY_PANEL_FLOW_PROGRESS,
    parse: parsePanelFlowProgress,
  });
  const modals = useRoomModals({
    reportScopeKey: reviewShare.reportScopeKey,
    isHost,
    canShareReport:
      isHost ||
      (effectiveSeat !== null && (state.nightReviewAllowedSeats ?? []).includes(effectiveSeat)),
    getLastNightInfo: () => buildLastNightInfo(state),
    getCurseInfo: () => buildCurseInfo(state),
    shareNightReview: (allowedSeats) =>
      submit('授权查看复盘', { type: 'werewolf.review.share', allowedSeats }),
    beginReportCapture: reviewShare.beginReportCapture,
    reportCaptureProgress: reviewShare.reportCaptureProgress,
    shareNightReviewReport: reviewShare.shareNightReviewReportDirectly,
    isGameEnded: status === GameStatus.Ended,
    onLastNightInfoConfirmed: () =>
      panelFlow.updateDraft((current) => ({ ...current, lastNightInfoConfirmed: true })),
  });
  const openNightReview = useCallback(() => {
    panelFlow.updateDraft((current) => ({ ...current, nightReviewOpened: true }));
    modals.openNightReview();
  }, [modals, panelFlow]);

  // ── Host flow ──
  const hostFlow = useWerewolfHostFlow({
    state,
    submit,
    audio,
    shareNightReviewReport: reviewShare.shareNightReviewReportDirectly,
  });

  // ── Board nominations (lobby) ──
  const boardNominations: WerewolfBoardNominations = {
    upvote: (targetUserId) =>
      void submit('投票板子', { type: 'werewolf.board.upvote', targetUserId }),
    withdraw: () => void submit('撤回建议', { type: 'werewolf.board.withdraw' }),
    adopt: async (roles) => {
      if (getPlayerCount(roles) !== getPlayerCount(state.templateRoles)) {
        const cleared = await submit('清空座位', { type: 'room.seat.clear' });
        if (!cleared) return;
      }
      await submit('采纳板子', { type: 'werewolf.config.update', templateRoles: roles });
    },
  };

  // ── Seat taps ──
  const onSeatPress = createRoomSeatPressHandler({
    isSetup: isWerewolfSetup(status),
    inGameAction: (seat) => {
      if (status === GameStatus.Ongoing) return night.onSeatTap(seat);
      if (status === GameStatus.Day) return true;
      const target = getRoomProfileTarget(state.roster, seat);
      if (target === null) return false;
      profile.open(target);
      return true;
    },
    state,
    currentSeat: mySeat,
    resolveIntent: resolveWerewolfSeatTapIntent,
    profile,
    seatController,
  });

  // ── Bottom actions, guide, shell ──
  const isActionSubmitting = ready.isSubmitting;
  const layout = createWerewolfBottomActionLayout({
    viewModel,
    night: night.model,
    isHost,
    effectiveSeat,
    isAudioPlaying: state.isAudioPlaying,
    isActionSubmitting,
    canOpenNightReview:
      isHost ||
      (effectiveSeat !== null && (state.nightReviewAllowedSeats ?? []).includes(effectiveSeat)),
    onNightButton: night.onNightButton,
    onViewRole: roleViewing.open,
    onNightReview: openNightReview,
  });
  const bottomActions = createWerewolfBottomActions({
    state,
    viewModel,
    night: night.model,
    isHost,
    isAudioPlaying: state.isAudioPlaying,
    layout,
    actionMessage: night.actionMessage,
    guideMessage: buildWerewolfGuideMessage({ isHost, roomStatus: status, mySeat, viewModel }),
    sheriffElectionPanel,
    isSheriffInspectorVisible,
    openSheriffDetails,
  });

  const shellModel = createWerewolfRoomShellModel({
    state,
    viewModel,
    night: night.model,
    revision,
    roomCode,
    viewer,
    capabilities,
    connection: entryController.connection,
    onBack: () => entryController.requestExit(capabilities.shouldConfirmExit),
    onTitlePress: titleActions.handleTitlePress,
    onTitleLongPress: titleActions.handleTitleLongPress,
    user,
    gachaStatus,
    onUserActionPress: () => navigation.navigate('Settings', { roomCode }),
    seatConfirmation: createRoomSeatConfirmationModel(seatController),
    profile: createRoomProfileCardModel({
      selection: profile.selection,
      capabilities,
      onClose: profile.close,
      onLeaveSeat: profile.leaveSelf,
      gameDetails: (() => {
        const selection = profile.selection;
        if (selection === null) return null;
        const statsUserId = getRoomOccupantUserId(selection.target.occupant);
        return statsUserId === null ? null : { title: '阵营分布', statsUserId };
      })(),
    }),
    share,
    onSeatPress,
    controlledSeat,
    onReleaseBot: bots.release,
    onBotSeatLongPress: bots.capability.isAllowed ? bots.onBotSeatLongPress : null,
    isActionSubmitting,
    isStartingGame: hostFlow.isStartingGame,
    isHostActionSubmitting: isActionSubmitting,
    bottomActions,
    sheriffElectionPanel,
    panelFlow: panelFlow.draft,
    onHostControl: hostFlow.onHostControl,
    onMusicSettings: () => {
      bgm.stopBgm();
      navigation.navigate('MusicSettings', { roomCode });
    },
    onMarkAllBotsViewed: hostFlow.markAllBotsViewed,
    onMarkAllBotsGroupConfirmed: hostFlow.markAllBotsGroupConfirmed,
    onNightReview: openNightReview,
    onLastNightInfo: modals.showLastNightInfo,
    onSelectMvp: hostFlow.openMvpSelection,
  });

  return {
    state,
    viewModel,
    shellModel,
    roomCode,
    userId: user.id,
    isHost,
    effectiveSeat,
    submit,
    bgm,
    roleCard: { viewing: roleViewing, roleId: myRole, resolvedAnimation },
    audioResume,
    night,
    sheriffElectionPanel,
    isSheriffInspectorVisible,
    isSheriffDetailsVisible,
    openSheriffDetails,
    closeSheriffDetails,
    mvpSelection: hostFlow.mvpSelection,
    closeMvpSelection: hostFlow.closeMvpSelection,
    isHostActionSubmitting: isActionSubmitting,
    nightReview: {
      data: nightReviewData,
      isVisible: modals.nightReviewVisible,
      close: modals.closeNightReview,
      shareCardRef: reviewShare.nightReviewShareCardRef,
      isCapturingShareCard: reviewShare.isCapturingShareCard,
      shareRun: reviewShare.shareRun,
      cancelShare: reviewShare.cancelReportShare,
      isShareSeatsVisible: modals.shareReviewVisible,
      shareSeats: viewModel.seats
        .filter((seat) => seat.seat !== effectiveSeat)
        .map((seat) => {
          const occupant = state.roster[seat.seat];
          if (occupant == null)
            throw new Error(`[FAIL-FAST] Seat ${seat.seat} projected without roster`);
          return {
            seat: seat.seat,
            displayName: isBotOccupant(occupant)
              ? getBotDisplayName(seat.seat)
              : occupant.profile.displayName,
          };
        }),
      closeShareSeats: modals.closeShareReview,
      shareToSeats: modals.handleShareNightReview,
    },
    boardNominations,
  };
}
