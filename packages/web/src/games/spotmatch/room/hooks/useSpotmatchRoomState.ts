/**
 * 组装共享房间控制器与一眼成对的私有牌面投影。
 */

import {
  getSpotmatchOccupiedSeatCount,
  getSpotmatchUserSeat,
  getSpotmatchViewModel,
  isBotSeat,
  type SpotmatchCommand,
  type SpotmatchState,
  type SpotmatchViewModel,
} from '@game-judge/game-engine/games/spotmatch/public';
import type { ReactNode } from 'react';

import { createRoomSeatPressHandler } from '@/features/room/controllers/createRoomSeatPressHandler';
import { useBotTakeover } from '@/features/room/controllers/useBotTakeover';
import {
  type ReadyRoomSession,
  useReadyRoomSession,
} from '@/features/room/controllers/useReadyRoomSession';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useRoomPresentationController } from '@/features/room/controllers/useRoomPresentationController';
import { useRoomSetupController } from '@/features/room/controllers/useRoomSetupController';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { RoomViewer } from '@/features/room/model/RoomViewer';
import type { RoomReviewContribution } from '@/features/room/review/types';
import { useRoomReview } from '@/features/room/review/useRoomReview';
import { useGameProfileDetails } from '@/games/model/useGameProfileDetails';
import type { SpotmatchRoomSession } from '@/games/spotmatch/model/SpotmatchRoomSession';

import {
  createSpotmatchHostManagement,
  createSpotmatchRoomShellModel,
  getSpotmatchSeatTapIntent,
} from '../spotmatchRoomAdapter';
import { getSpotmatchRoomCommandFailureMessage } from '../spotmatchRoomCommandFailureMessage';
import { useSpotmatchCooldown } from './useSpotmatchCooldown';

/**
 * 一眼成对房间 Screen 的显式契约：领域推导（视图模型、有效座位）
 * 全部在本 hook 内组装，Screen 只消费本接口渲染。末尾 return 不许 spread。
 */
export interface SpotmatchRoomScreenState {
  readonly state: SpotmatchState;
  readonly shellModel: RoomShellModel;
  /** 当前视角的视图模型（按有效席位裁剪）。 */
  readonly viewModel: SpotmatchViewModel;
  readonly roomCode: string;
  readonly userId: string;
  readonly mySeat: number | null;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly isHost: boolean;
  /** 平台单飞提交：座位动作由调用点显式传 `{ controlledSeat }`，房主命令不传。 */
  readonly submit: ReadyRoomSession<SpotmatchState, SpotmatchCommand>['submit'];
  readonly isSubmitting: boolean;
  readonly isShowingFinalSuccess: boolean;
  readonly session: SpotmatchRoomSession;
  /** 本局复盘弹窗、导出舞台与分享进度（平台 useRoomReview），放进房间 gameOverlays。 */
  readonly reviewOverlay: ReactNode;
}

/** 把当前就绪 session 绑定到房间壳控制器与命令上。 */
export function useSpotmatchRoomState(
  props: GameRoomScreenProps<'spotmatch'> & {
    readonly session: SpotmatchRoomSession;
    readonly review: RoomReviewContribution<SpotmatchState>;
    readonly entryController: RoomEntryController;
  },
): SpotmatchRoomScreenState {
  const { session, room, entryController } = props;
  const { user, state, revision, submit, isSubmitting, pendingActionKey, submitOperation } =
    useReadyRoomSession(session, getSpotmatchRoomCommandFailureMessage);
  const isHost = state.hostUserId === user.id;
  const mySeat = getSpotmatchUserSeat(state, user.id);
  const viewer: RoomViewer = { userId: user.id, isHost, seat: mySeat };
  const isLobby = state.phase.kind === 'lobby';
  const successPaused = useSpotmatchCooldown(state.round?.success?.until ?? 0);
  const isShowingFinalSuccess = state.phase.kind === 'ended' && successPaused;
  // Authority has already settled; only the shell waits for the final success frame.
  const presentationState: SpotmatchState = isShowingFinalSuccess
    ? { ...state, phase: { kind: 'playing' } }
    : state;
  // 机器人接管：房主随时可接管；失去房主身份或座位不再是机器人时由共享守卫释放。
  const bots = useBotTakeover({
    viewer,
    isBotSeat: (seat) => isBotSeat(state.roster, seat),
    gameName: 'Spotmatch',
  });
  const { controlledSeat, effectiveSeat } = bots;
  const { share, titleActions, gachaStatus } = useRoomPresentationController({
    roomCode: room.roomCode,
    gameDisplayName: '一眼成对',
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
    submitOperation,
    isSetup: isLobby,
    isHost,
    mySeat,
    supportsBots: true,
    hasOccupiedSeats: getSpotmatchOccupiedSeatCount(state) > 0,
    isRoomFull: getSpotmatchOccupiedSeatCount(state) === state.config.numberOfPlayers,
    configureGame: props.onOpenRoomSettings,
    shareRoom: share.open,
  });
  const gameDetails = useGameProfileDetails(profile.selection, '一眼成对战绩', '本游戏局数');
  const viewModel = getSpotmatchViewModel(state, effectiveSeat);
  // 本局复盘：入口、弹窗与图片分享归平台，复盘文档由模块声明的 review 给出。
  const review = useRoomReview({
    contribution: props.review,
    state,
    viewer,
    roomId: room.roomId,
    roomCode: room.roomCode,
    onOpened: null,
  });
  const capabilities: RoomCapabilities = {
    ...setupCapabilities,
    canTakeOverBots: bots.capability,
  };
  const onSeatPress = createRoomSeatPressHandler({
    isSetup: isLobby,
    state,
    currentSeat: mySeat,
    resolveIntent: getSpotmatchSeatTapIntent,
    profile,
    seatController,
  });
  const buildHostManagement = () =>
    createSpotmatchHostManagement({
      state: presentationState,
      capabilities,
      isSubmitting,
      isScorePause: successPaused,
      submit,
      review: isShowingFinalSuccess ? null : review.entry,
    });

  const shellModel: RoomShellModel = createSpotmatchRoomShellModel({
    isSubmitting,
    pendingActionKey,
    roomCode: room.roomCode,
    viewer,
    capabilities,
    onBack: () => entryController.requestExit(capabilities.shouldConfirmExit),
    onTitlePress: titleActions.handleTitlePress,
    onTitleLongPress: titleActions.handleTitleLongPress,
    user,
    gachaStatus,
    onUserActionPress: props.onOpenUserSettings,
    connection: entryController.connection,
    state: presentationState,
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
    buildHostManagement,
    releaseBot: bots.release,
    review: isShowingFinalSuccess ? null : review.entry,
  });
  return {
    state,
    shellModel,
    viewModel,
    roomCode: room.roomCode,
    userId: user.id,
    mySeat,
    effectiveSeat,
    controlledSeat,
    isHost,
    submit,
    isSubmitting,
    isShowingFinalSuccess,
    session,
    reviewOverlay: review.overlay,
  };
}
