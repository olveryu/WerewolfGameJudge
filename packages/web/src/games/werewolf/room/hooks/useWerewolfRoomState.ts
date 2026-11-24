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
  getWerewolfUserSeat,
  getWerewolfViewModel,
  readArmedDeadline,
  type RoleId,
  type WerewolfViewModel,
} from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { getBotDisplayName } from '@game-judge/game-engine/platform/room/getBotDisplayName';
import { isBotOccupant, isBotSeat } from '@game-judge/game-engine/platform/room/seating/roster';
import {
  parseResolvedRoleRevealAnimation,
  type ResolvedRoleRevealAnimation,
} from '@game-judge/game-engine/product/rewards';
import { type ReactNode, useMemo, useState } from 'react';

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
import { useRoomImagePreload } from '@/features/room/hooks/useRoomImagePreload';
import { useStageDeadline } from '@/features/room/hooks/useStageDeadline';
import { createRoomProfileCardModel } from '@/features/room/model/createRoomProfileCardModel';
import { createRoomSeatConfirmationModel } from '@/features/room/model/createRoomSeatConfirmationModel';
import { getRoomProfileTarget } from '@/features/room/model/getRoomProfileTarget';
import { createRoomSeatTapIntentResolver } from '@/features/room/model/RoomSeatTap';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { RoomViewer } from '@/features/room/model/RoomViewer';
import type { RoomReviewContribution } from '@/features/room/review/types';
import { useRoomReview } from '@/features/room/review/useRoomReview';
import type { StepInteraction } from '@/features/room/steps/useStepInteraction';
import { useGameProfileDetails } from '@/games/model/useGameProfileDetails';
import { getBoardRolePortraits } from '@/games/werewolf/assets/roleAvatars';
import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import type {
  WerewolfRoomSession,
  WerewolfSubmit,
} from '@/games/werewolf/model/WerewolfRoomSession';

import { type SheriffElectionPanelModel, useSheriffElection } from '../day/useSheriffElection';
import { buildWerewolfGuideMessage } from '../werewolfGuideMessage';
import {
  createWerewolfPlayerActions,
  createWerewolfRoomCapabilities,
  createWerewolfRoomShellModel,
  createWerewolfStepActionList,
  isWerewolfSetup,
  WEREWOLF_DISPLAY_NAME,
} from '../werewolfRoomAdapter';
import { getWerewolfRoomCommandFailureMessage } from '../werewolfRoomCommandFailureMessage';
import { useRoomModals } from './useRoomModals';
import { useWerewolfAudioOrchestration } from './useWerewolfAudioOrchestration';
import { useWerewolfBgmControl, type WerewolfBgmControlState } from './useWerewolfBgmControl';
import { type MvpSelection, useWerewolfHostFlow } from './useWerewolfHostFlow';
import { useWerewolfNightInteraction } from './useWerewolfNightInteraction';

/** Passive toasts for non-hosts, keyed by the host command that produced the revision. */
const LAST_ACTION_TOASTS = {
  'werewolf.roles.assign': {
    level: 'info',
    text: '角色已分配，点击下方「查看身份」查看你的身份',
  },
  'werewolf.game.begin': { level: 'info', text: '夜幕降临，请等待指示' },
  'werewolf.game.restart': { level: 'info', text: '房主已重新开始游戏' },
} as const;

interface WerewolfRoleCard {
  readonly viewing: RoleViewing;
  /** The effective seat's role; null before the deal or for spectators. */
  readonly roleId: RoleId | null;
  /** The viewer's seated reveal effect ('random' already resolved at seat time). */
  readonly resolvedAnimation: ResolvedRoleRevealAnimation;
}

/** The shared review's overlay plus the host's seat-grant picker. */
interface WerewolfReviewAccess {
  readonly overlay: ReactNode;
  readonly isGrantVisible: boolean;
  readonly grantSeats: readonly { readonly seat: number; readonly displayName: string }[];
  readonly closeGrant: () => void;
  readonly grantSeatsAccess: (allowedSeats: readonly number[]) => Promise<void>;
}

interface WerewolfBoardNominations {
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
  readonly roomId: string;
  readonly userId: string;
  readonly isHost: boolean;
  /** Armed night-step / sheriff-vote countdown remaining seconds; null without a deadline. */
  readonly remainingSeconds: number | null;
  /** The armed settle is overdue: deadline passed and the grace elapsed. */
  readonly isOverdue: boolean;
  readonly submit: WerewolfSubmit;
  readonly bgm: WerewolfBgmControlState;
  readonly roleCard: WerewolfRoleCard;
  readonly audioResume: RoomAudioResume;
  readonly night: StepInteraction;
  readonly sheriffElectionPanel: SheriffElectionPanelModel | null;
  readonly isSheriffDetailsVisible: boolean;
  readonly openSheriffDetails: () => void;
  readonly closeSheriffDetails: () => void;
  readonly mvpSelection: MvpSelection | null;
  readonly closeMvpSelection: () => void;
  readonly isHostActionSubmitting: boolean;
  readonly reviewAccess: WerewolfReviewAccess;
  readonly boardNominations: WerewolfBoardNominations;
}

const resolveWerewolfSeatTapIntent = createRoomSeatTapIntentResolver<GameState>((state, seat) =>
  getRoomProfileTarget(state.roster, seat),
);

function buildLastNightInfo(state: GameState): string {
  const parts: string[] = [];
  const deaths = state.lastNightDeaths ?? [];
  parts.push(
    deaths.length === 0
      ? '昨夜平安夜'
      : `昨夜死亡: ${deaths.map((seat) => formatSeat(seat)).join(', ')}`,
  );
  const results = state.currentNightResults ?? {};
  const selections = state.nightState?.facts.selections;
  const silencedSeat =
    selections?.find((selection) => selection.roleId === 'silenceElder')?.landingSeat ??
    results.silencedSeat;
  const votebannedSeat =
    selections?.find((selection) => selection.roleId === 'votebanElder')?.landingSeat ??
    results.votebannedSeat;
  if (silencedSeat != null) parts.push(`${formatSeat(silencedSeat)}被禁言`);
  if (votebannedSeat != null) parts.push(`${formatSeat(votebannedSeat)}被禁票`);
  return parts.join('\n');
}

function buildCurseInfo(state: GameState): string | null {
  if (!state.templateRoles.includes('crow')) return null;
  const cursedSeat =
    state.nightState?.facts.selections.find((selection) => selection.roleId === 'crow')
      ?.landingSeat ?? state.currentNightResults?.cursedSeat;
  if (cursedSeat == null) return '乌鸦未诅咒任何人';
  return `${formatSeat(cursedSeat)}被诅咒（放逐+1票）`;
}

export function useWerewolfRoomState(
  props: GameRoomScreenProps<'werewolf'> & {
    readonly session: WerewolfRoomSession;
    readonly review: RoomReviewContribution<GameState>;
    readonly entryController: RoomEntryController;
    readonly audio: WerewolfAudioRuntime;
  },
  isReadingRoomInformation: boolean,
): WerewolfRoomScreenState {
  const { session, room, entryController, audio } = props;
  const roomCode = room.roomCode;
  const ready = useReadyRoomSession(session, getWerewolfRoomCommandFailureMessage);
  const { user, state, revision, submit } = ready;
  useRoomImagePreload(getBoardRolePortraits(state.templateRoles));
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
  const bgm = useWerewolfBgmControl(audio, isHost, status, state.isAudioPlaying);
  const orchestration = useWerewolfAudioOrchestration({ session, isHost, audio });
  const audioResume = useRoomAudioResume({
    isResumeRequired: orchestration.isResumeRequired,
    resume: orchestration.resumeAfterRejoin,
    onResumed: bgm.startBgmIfEnabled,
  });

  useLastActionToast({
    lastCommand: ready.lastCommand,
    isHost,
    mySeat,
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
    submitOperation: ready.submitOperation,
  });
  const gameDetails = useGameProfileDetails(profile.selection, '狼人杀战绩', '本游戏局数');
  const capabilities = createWerewolfRoomCapabilities({
    status,
    isHost,
    mySeat,
    hasOccupiedSeats: Object.values(state.roster).some((occupant) => occupant != null),
    ...actions,
    configureGame: props.onOpenRoomSettings,
    takeOverBots: bots.capability,
    shareRoom: share.open,
  });

  // ── Deadline: the armed night step / sheriff vote. Countdown only:
  // the server settles the deadline (werewolf.settle.due); no client
  // sends expiry. isOverdue is the host self-rescue's shared decision:
  // deadline passed and the grace elapsed.
  const armedDeadline = readArmedDeadline(state);
  const { remainingSeconds, nowMs, isOverdue } = useStageDeadline({
    deadlineAt: armedDeadline?.deadlineAt ?? null,
  });

  // ── Night ──
  const nightState = useWerewolfNightInteraction({
    state,
    viewModel,
    userId: user.id,
    roomId: room.roomId,
    effectiveSeat,
    controlledSeat,
    submit,
    isSuspended: state.isAudioPlaying || audioResume.isDue || isReadingRoomInformation,
    hasPendingCommand: ready.isSubmitting || entryController.connection.pendingDurableCount > 0,
    nowMs,
  });
  const night = nightState.interaction;

  // ── Identity viewing ──
  const myRole = viewModel.myRole;
  const roleViewing = useRoleViewing({
    effectiveSeat,
    identityKey: myRole === null ? null : state.gameSequence,
    hasViewed: effectiveSeat !== null && viewModel.viewedSeats.includes(effectiveSeat),
    occupiedSeatCount: viewModel.seats.length,
    viewedSeatCount: viewModel.viewedSeats.length,
    isSubmitting: ready.isSubmitting,
    submitViewed: () =>
      submit('查看身份', { type: 'werewolf.role.viewed' }, { controlledSeat, actionKey: null }),
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
    remainingSeconds,
    submit: (label, command, options) => submit(label, command, { ...options, controlledSeat }),
  });
  const [isSheriffDetailsVisible, setIsSheriffDetailsVisible] = useState(false);
  if (isSheriffDetailsVisible && sheriffElectionPanel === null) {
    setIsSheriffDetailsVisible(false);
  }

  // ── Review: the shared 本局复盘, plus the host's seat grants ──
  const hasPendingReview =
    status === GameStatus.Ended &&
    (isHost || mySeat !== null) &&
    !(state.reviewCompletedUserIds ?? []).includes(user.id);
  const panelFlow = {
    lastNightInfoConfirmed: state.lastNightInfoConfirmed === true,
    reviewCompleted: status === GameStatus.Ended && !hasPendingReview,
  };
  const review = useRoomReview({
    contribution: props.review,
    state,
    viewer,
    roomId: room.roomId,
    roomCode,
    onOpened: null,
    isPending: hasPendingReview,
    onClosed: hasPendingReview
      ? () =>
          submit(
            '确认复盘',
            { type: 'werewolf.review.complete', gameSequence: state.gameSequence },
            { actionKey: null },
          )
      : null,
  });
  const modals = useRoomModals({
    gameSequence: state.gameSequence,
    getLastNightInfo: () => buildLastNightInfo(state),
    getCurseInfo: () => buildCurseInfo(state),
    grantReviewAccess: (allowedSeats) =>
      submit('授权查看复盘', { type: 'werewolf.review.share', allowedSeats }, { actionKey: null }),
    isGameEnded: status === GameStatus.Ended,
    onLastNightInfoConfirmed: () =>
      state.lastNightInfoConfirmed === true
        ? Promise.resolve(true)
        : submit(
            '确认昨夜信息',
            { type: 'werewolf.lastNightInfo.confirm', gameSequence: state.gameSequence },
            { actionKey: null },
          ),
  });

  // ── Host flow ──
  const hostFlow = useWerewolfHostFlow({
    state,
    submit,
    audio,
  });

  // ── Board nominations (lobby) ──
  const boardNominations: WerewolfBoardNominations = {
    upvote: (targetUserId) =>
      void submit('投票板子', { type: 'werewolf.board.upvote', targetUserId }, { actionKey: null }),
    withdraw: () =>
      void submit('撤回建议', { type: 'werewolf.board.withdraw' }, { actionKey: null }),
    adopt: async (roles) => {
      if (getPlayerCount(roles) !== getPlayerCount(state.templateRoles)) {
        const cleared = await submit('清空座位', { type: 'room.seat.clear' }, { actionKey: null });
        if (!cleared) return;
      }
      await submit(
        '采纳板子',
        { type: 'werewolf.config.update', templateRoles: roles },
        { actionKey: null },
      );
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
  const openSheriffDetails = () => setIsSheriffDetailsVisible(true);
  const playerActionList = createWerewolfStepActionList({
    viewModel,
    step: night,
    isHost,
    effectiveSeat,
    isAudioPlaying: state.isAudioPlaying,
    review: review.entry,
    onViewRole: roleViewing.open,
  });
  const playerActions = createWerewolfPlayerActions({
    state,
    viewModel,
    isHost,
    isAudioPlaying: state.isAudioPlaying,
    actions: playerActionList,
    actionMessage: nightState.actionMessage,
    nightStatusLine: nightState.nightStatusLine,
    isStepActor: nightState.isStepActor,
    guideMessage: buildWerewolfGuideMessage({ isHost, roomStatus: status, mySeat, viewModel }),
    sheriffElectionPanel,
    openSheriffDetails,
  });

  const shellModel = createWerewolfRoomShellModel({
    isSubmitting: ready.isSubmitting,
    pendingActionKey: ready.pendingActionKey,
    state,
    viewModel,
    seatSelection: night.seatSelection,
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
    onUserActionPress: props.onOpenUserSettings,
    seatConfirmation: createRoomSeatConfirmationModel(seatController),
    profile: createRoomProfileCardModel({
      selection: profile.selection,
      capabilities,
      onClose: profile.close,
      onLeaveSeat: profile.leaveSelf,
      gameDetails,
    }),
    share,
    onSeatPress,
    controlledSeat,
    onReleaseBot: bots.release,
    onBotSeatLongPress: bots.capability.isAllowed ? bots.onBotSeatLongPress : null,
    isActionSubmitting,
    isHostActionSubmitting: isActionSubmitting,
    playerActions,
    sheriffElectionPanel,
    panelFlow,
    onHostControl: hostFlow.onHostControl,
    onMarkAllBotsViewed: hostFlow.markAllBotsViewed,
    onMarkAllBotsGroupConfirmed: hostFlow.markAllBotsGroupConfirmed,
    onMusicSettings: () => {
      bgm.stopBgm();
      props.onOpenMusicSettings();
    },
    review: review.entry,
    onGrantReviewAccess: modals.openGrant,
    onLastNightInfo: modals.showLastNightInfo,
    onSelectMvp: hostFlow.openMvpSelection,
  });

  return {
    state,
    viewModel,
    shellModel,
    roomCode,
    userId: user.id,
    roomId: room.roomId,
    isHost,
    remainingSeconds,
    isOverdue,
    submit,
    bgm,
    roleCard: { viewing: roleViewing, roleId: myRole, resolvedAnimation },
    audioResume,
    night,
    sheriffElectionPanel,
    isSheriffDetailsVisible,
    openSheriffDetails,
    closeSheriffDetails: () => setIsSheriffDetailsVisible(false),
    mvpSelection: hostFlow.mvpSelection,
    closeMvpSelection: hostFlow.closeMvpSelection,
    isHostActionSubmitting: isActionSubmitting,
    reviewAccess: {
      overlay: review.overlay,
      isGrantVisible: modals.isGrantVisible,
      grantSeats: viewModel.seats
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
      closeGrant: modals.closeGrant,
      grantSeatsAccess: modals.grantSeatsAccess,
    },
    boardNominations,
  };
}
