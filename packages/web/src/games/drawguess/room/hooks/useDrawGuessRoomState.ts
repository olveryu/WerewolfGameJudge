/**
 * 组装共享房间控制器；你画我猜只负责阶段、机器人接管与开始游戏。
 */

import {
  type DrawGuessCommand,
  type DrawGuessState,
  type DrawGuessViewModel,
  getDrawGuessOccupiedSeatCount,
  getDrawGuessUserSeat,
  getDrawGuessViewModel,
  isBotSeat,
} from '@game-judge/game-engine/games/drawguess/public';
import { type ReactNode, useCallback, useMemo } from 'react';
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
import { useRoomReview } from '@/features/room/review/useRoomReview';
import type { DrawGuessRoomSession } from '@/games/drawguess/model/DrawGuessRoomSession';

import {
  createDrawGuessHostManagement,
  createDrawGuessRoomShellModel,
  getDrawGuessSeatTapIntent,
} from '../drawGuessRoomAdapter';
import { getDrawGuessRoomCommandFailureMessage } from '../drawGuessRoomCommandFailureMessage';
import { createDrawGuessStageHud } from '../drawGuessStageHud';

interface UseDrawGuessRoomStateParams {
  readonly room: GameRoomScreenProps<'drawguess'>['room'];
  readonly entryReason: GameRoomScreenProps<'drawguess'>['entryReason'];
  readonly entryController: RoomEntryController;
  readonly session: DrawGuessRoomSession;
  readonly review: RoomReviewContribution<DrawGuessState>;
}

/**
 * 你画我猜房间 Screen 的显式契约：领域推导（视图模型、阶段截止）全部在本 hook 内组装，
 * Screen 只消费本接口渲染。
 */
export interface DrawGuessRoomScreenState {
  readonly state: DrawGuessState;
  readonly shellModel: RoomShellModel;
  /** 进行中阶段（选词 / 作画 / 结算）的信息条；大厅与终局不是舞台内容，为 null。 */
  readonly stageHud: RoomStageHudModel | null;
  /** 当前视角的视图模型（按有效席位裁剪，随 1 秒 tick 更新提示揭示）。 */
  readonly viewModel: DrawGuessViewModel;
  /** 当前阶段剩余秒数；无截止阶段为 null。到期推进由服务端定时结算完成，任何手机都不发 expire。 */
  readonly remainingSeconds: number | null;
  /** 截止已过且宽限期已过：结算逾期，房主可见自救重试。 */
  readonly isOverdue: boolean;
  /** 房间单飞提交进行中：自救按钮的加载态。 */
  readonly isSubmitting: boolean;
  readonly roomCode: string;
  readonly userId: string;
  readonly mySeat: number | null;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly isHost: boolean;
  /** 平台单飞提交：座位动作由调用点显式传 `{ controlledSeat }`，房主命令不传。 */
  readonly submit: ReadyRoomSession<DrawGuessState, DrawGuessCommand>['submit'];
  readonly session: DrawGuessRoomSession;
  readonly openRules: () => void;
  /** 本局复盘的对话框、导出舞台与分享进度，挂在房间的 gameOverlays。 */
  readonly reviewOverlay: ReactNode;
}

/** 把当前就绪 session 绑定到房间壳控制器与命令上。 */
export function useDrawGuessRoomState({
  room,
  entryReason,
  entryController,
  session,
  review: reviewContribution,
}: UseDrawGuessRoomStateParams): DrawGuessRoomScreenState {
  const { user, state, revision, submit, isSubmitting } = useReadyRoomSession(
    session,
    getDrawGuessRoomCommandFailureMessage,
  );
  const navigate = useNavigate();
  const isHost = state.hostUserId === user.id;
  const mySeat = getDrawGuessUserSeat(state, user.id);
  const viewer = useMemo(
    (): RoomViewer => ({ userId: user.id, isHost, seat: mySeat }),
    [isHost, mySeat, user.id],
  );
  const isLobby = state.phase.kind === 'lobby';
  const review = useRoomReview({
    contribution: reviewContribution,
    state,
    viewer,
    roomId: room.roomId,
    roomCode: room.roomCode,
    onOpened: null,
  });
  // 机器人接管：房主随时可接管；失去房主身份或座位不再是机器人时由共享守卫释放。
  const bots = useBotTakeover({
    viewer,
    isBotSeat: (seat) => isBotSeat(state.roster, seat),
    gameName: 'DrawGuess',
  });
  const { controlledSeat, effectiveSeat } = bots;
  const { share, titleActions, gachaStatus } = useRoomPresentationController({
    roomCode: room.roomCode,
    gameDisplayName: '你画我猜',
    isHost,
    entryReason,
  });
  const configureGame = useCallback(() => {
    void navigate(gameConfigEditPath('drawguess', room.roomCode));
  }, [navigate, room.roomCode]);
  const openRules = useCallback(() => {
    void navigate(gameGuidePath('drawguess', room.roomCode));
  }, [navigate, room.roomCode]);
  const occupiedSeatCount = getDrawGuessOccupiedSeatCount(state);
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
    hasOccupiedSeats: occupiedSeatCount > 0,
    isRoomFull: occupiedSeatCount === state.config.numberOfPlayers,
    configureGame,
    shareRoom: share.open,
  });
  // 阶段截止只做剩余秒数展示；到期推进由服务端定时结算完成，任何手机都不发 expire。
  // isOverdue 是房主自救的共享判定：截止后宽限期已过、结算仍未到达。
  const deadlineAt =
    state.phase.kind === 'wordSelect' ||
    state.phase.kind === 'drawing' ||
    state.phase.kind === 'roundEnd'
      ? state.phase.deadlineAt
      : null;
  // 拼音首字母揭示按秒推进：时钟来自截止 hook（有截止的阶段才每秒重渲染）。
  const { remainingSeconds, nowMs, isOverdue } = useStageDeadline({ deadlineAt });
  const viewModel = getDrawGuessViewModel(state, effectiveSeat, nowMs);
  const capabilities: RoomCapabilities = {
    ...setupCapabilities,
    canTakeOverBots: bots.capability,
  };
  const onSeatPress = createRoomSeatPressHandler({
    isSetup: isLobby,
    state,
    currentSeat: mySeat,
    resolveIntent: getDrawGuessSeatTapIntent,
    profile,
    seatController,
  });
  const buildHostManagement = () =>
    createDrawGuessHostManagement({
      state,
      capabilities,
      isSubmitting,
      submit,
      review: review.entry,
    });

  const shellModel: RoomShellModel = createDrawGuessRoomShellModel({
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
    onProfileClose: profile.close,
    onProfileLeaveSeat: profile.leaveSelf,
    share,
    isLobby,
    buildHostManagement,
    releaseBot: bots.release,
    review: review.entry,
  });
  return {
    state,
    shellModel,
    stageHud: createDrawGuessStageHud({
      state,
      viewModel,
      effectiveSeat,
      remainingSeconds,
      seats: shellModel.seats.source,
      canTakeOverBots: bots.capability.isAllowed,
      controlledSeat,
    }),
    viewModel,
    remainingSeconds,
    isOverdue,
    isSubmitting,
    roomCode: room.roomCode,
    userId: user.id,
    mySeat,
    effectiveSeat,
    controlledSeat,
    isHost,
    submit,
    session,
    openRules,
    reviewOverlay: review.overlay,
  };
}
