/** Composes shared room controllers; Story Relay owns only phase and bot-control availability. */

import {
  getStoryRelayOccupiedSeatCount,
  getStoryRelayUserSeat,
  isBotSeat,
  type StoryRelayCommand,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';

import {
  gameConfigEditPath,
  gameGuidePath,
  settingsPath,
} from '@/features/navigation/model/gamePaths';
import { createRoomSeatPressHandler } from '@/features/room/controllers/createRoomSeatPressHandler';
import { useBotTakeover } from '@/features/room/controllers/useBotTakeover';
import {
  type ReadyRoomSession,
  useReadyRoomSession,
} from '@/features/room/controllers/useReadyRoomSession';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useRoomPresentationController } from '@/features/room/controllers/useRoomPresentationController';
import { useRoomSetupController } from '@/features/room/controllers/useRoomSetupController';
import { useStageDeadline } from '@/features/room/hooks/useStageDeadline';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { RoomStageHudModel } from '@/features/room/model/RoomStage';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { RoomViewer } from '@/features/room/model/RoomViewer';
import type { RoomReviewContribution } from '@/features/room/review/types';
import { type RoomReviewController, useRoomReview } from '@/features/room/review/useRoomReview';
import { useGameProfileDetails } from '@/games/model/useGameProfileDetails';
import { type StoryRelayRoomSession } from '@/games/storyrelay/model/StoryRelayRoomSession';

import {
  createStoryRelayHostManagement,
  createStoryRelayRoomShellModel,
  getStoryRelaySeatTapIntent,
} from '../storyRelayRoomAdapter';
import { getStoryRelayRoomCommandFailureMessage } from '../storyRelayRoomCommandFailureMessage';
import { createStoryRelayStageHud } from '../storyRelayStageHud';

/**
 * 故事接龙房间 Screen 的显式契约（P-2b，对齐狼人杀 WerewolfRoomScreenState 形态）：
 * Screen 无本地推导（仅透传字段给 StoryRelayStage），阶段截止 tick 与信息条也在本 hook 内组装，
 * 本接口把 hook 返回钉死防回潮。阶段组件 StoryRelayStage 的内部交互状态属组件自身，不在此列。
 */
export interface StoryRelayRoomScreenState {
  readonly state: StoryRelayState;
  readonly shellModel: RoomShellModel;
  /** 写作 / 收稿 / 换棒阶段的信息条；大厅、画廊与终局不是舞台内容，为 null。 */
  readonly stageHud: RoomStageHudModel | null;
  /** 当前阶段剩余秒数；无截止阶段为 null。到期推进由服务端定时结算完成，任何手机都不发 expire。 */
  readonly remainingSeconds: number | null;
  /** 截止已过且宽限期已过：结算逾期，房主可见自救重试。 */
  readonly isOverdue: boolean;
  readonly userId: string;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly isHost: boolean;
  /** 平台单飞提交：座位动作由调用点显式传 `{ controlledSeat }`，房主命令不传。 */
  readonly submit: ReadyRoomSession<StoryRelayState, StoryRelayCommand>['submit'];
  readonly isSubmitting: boolean;
  readonly openRules: () => void;
  /** 本局复盘的对话框 / 导出舞台，挂在房间的 gameOverlays。 */
  readonly reviewOverlay: ReactNode;
  /** 在某一篇故事所在页打开本局复盘（回看「分享本篇故事」）。 */
  readonly openReview: RoomReviewController['open'];
}

/** Binds the current ready session to the room-shell controllers and commands. */
export function useStoryRelayRoomState(
  props: GameRoomScreenProps<'storyrelay'> & {
    readonly session: StoryRelayRoomSession;
    readonly review: RoomReviewContribution<StoryRelayState>;
    readonly entryController: RoomEntryController;
  },
): StoryRelayRoomScreenState {
  const { session, room, entryController } = props;
  const navigate = useNavigate();
  const { user, state, revision, submit, isSubmitting } = useReadyRoomSession(
    session,
    getStoryRelayRoomCommandFailureMessage,
  );
  const isHost = state.hostUserId === user.id;
  const mySeat = getStoryRelayUserSeat(state, user.id);
  const viewer: RoomViewer = { userId: user.id, isHost, seat: mySeat };
  const isLobby = state.phase === 'lobby';
  // 机器人接管：房主随时可接管；失去房主身份或座位不再是机器人时由共享守卫释放。
  const bots = useBotTakeover({
    viewer,
    isBotSeat: (seat) => isBotSeat(state.roster, seat),
    gameName: 'StoryRelay',
  });
  const { controlledSeat, effectiveSeat } = bots;
  const { share, titleActions, gachaStatus } = useRoomPresentationController({
    roomCode: room.roomCode,
    gameDisplayName: '故事接龙',
    isHost,
    entryReason: props.entryReason,
  });
  const {
    seatController,
    profile,
    capabilities: setupCapabilities,
  } = useRoomSetupController({
    session,
    user,
    isSetup: isLobby,
    isHost,
    mySeat,
    supportsBots: true,
    hasOccupiedSeats: getStoryRelayOccupiedSeatCount(state) > 0,
    isRoomFull: getStoryRelayOccupiedSeatCount(state) === state.config.numberOfPlayers,
    configureGame: () => void navigate(gameConfigEditPath('storyrelay', room.roomCode)),
    shareRoom: share.open,
  });
  const gameDetails = useGameProfileDetails(profile.selection, '故事接龙战绩', '本游戏局数');
  const capabilities: RoomCapabilities = {
    ...setupCapabilities,
    canTakeOverBots: bots.capability,
  };
  // 倒计时只做展示：到期推进由服务端定时结算完成，任何手机都不发 expire。
  // isOverdue 是房主自救的共享判定：截止后宽限期已过、结算仍未到达。
  const { remainingSeconds, isOverdue } = useStageDeadline({ deadlineAt: state.deadlineAt });
  const review = useRoomReview({
    contribution: props.review,
    state,
    viewer,
    roomId: room.roomId,
    roomCode: room.roomCode,
    onOpened: null,
  });
  const onSeatPress = createRoomSeatPressHandler({
    isSetup: isLobby,
    state,
    currentSeat: mySeat,
    resolveIntent: getStoryRelaySeatTapIntent,
    profile,
    seatController,
  });
  const buildHostManagement = () =>
    createStoryRelayHostManagement({
      state,
      capabilities,
      isSubmitting,
      submit,
      review: review.entry,
    });

  const shellModel: RoomShellModel = createStoryRelayRoomShellModel({
    roomCode: room.roomCode,
    viewer,
    capabilities,
    onBack: () => entryController.requestExit(capabilities.shouldConfirmExit),
    onTitlePress: titleActions.handleTitlePress,
    onTitleLongPress: titleActions.handleTitleLongPress,
    user,
    gachaStatus,
    onUserActionPress: () => void navigate(settingsPath(room.roomCode)),
    connection: entryController.connection,
    state,
    revision,
    controlledSeat,
    seatsVisuallyDisabled: isSubmitting || seatController.isSubmitting,
    onSeatPress,
    onBotSeatLongPress: bots.capability.isAllowed ? bots.onBotSeatLongPress : null,
    seatController,
    profileSelection: profile.selection,
    gameDetails,
    onProfileClose: profile.close,
    onProfileLeaveSeat: profile.leaveSelf,
    share,
    isLobby,
    review: review.entry,
    buildHostManagement,
    releaseBot: bots.release,
  });
  return {
    state,
    shellModel,
    stageHud: createStoryRelayStageHud({
      state,
      remainingSeconds,
      seats: shellModel.seats.source,
    }),
    remainingSeconds,
    isOverdue,
    userId: user.id,
    effectiveSeat,
    controlledSeat,
    isHost,
    submit,
    isSubmitting,
    openRules: () => void navigate(gameGuidePath('storyrelay', room.roomCode)),
    reviewOverlay: review.overlay,
    openReview: review.open,
  };
}
