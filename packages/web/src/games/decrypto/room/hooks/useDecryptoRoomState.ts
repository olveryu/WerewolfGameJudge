/**
 * 组装共享房间控制器；解码战只负责舞台阶段与截止推进。
 */

import {
  type DecryptoCommand,
  type DecryptoState,
  type DecryptoViewModel,
  getDecryptoOccupiedSeatCount,
  getDecryptoUserSeat,
  getDecryptoViewModel,
  isBotSeat,
} from '@game-judge/game-engine/games/decrypto/public';
import { type ReactNode } from 'react';

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
import type { DecryptoRoomSession } from '@/games/decrypto/model/DecryptoRoomSession';
import { useGameProfileDetails } from '@/games/model/useGameProfileDetails';

import {
  createDecryptoHostManagement,
  createDecryptoRoomShellModel,
  getDecryptoSeatTapIntent,
} from '../decryptoRoomAdapter';
import { getDecryptoRoomCommandFailureMessage } from '../decryptoRoomCommandFailureMessage';
import { useDecryptoTakeoverView } from './useDecryptoTakeoverView';

/**
 * 解码战房间 Screen 的显式契约：领域推导（视图模型、阶段截止）
 * 全部在本 hook 内组装，Screen 只消费本接口渲染。末尾 return 不许 spread。
 */
export interface DecryptoRoomScreenState {
  readonly state: DecryptoState;
  readonly shellModel: RoomShellModel;
  /** 当前视角的视图模型（按有效席位裁剪）。 */
  readonly viewModel: DecryptoViewModel;
  readonly roomCode: string;
  readonly userId: string;
  readonly mySeat: number | null;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly isHost: boolean;
  /** 平台单飞提交：座位动作由调用点显式传 `{ controlledSeat }`，房主命令不传。 */
  readonly submit: ReadyRoomSession<DecryptoState, DecryptoCommand>['submit'];
  readonly isSubmitting: boolean;
  readonly isTakeoverLoading: boolean;
  readonly hasTakeoverError: boolean;
  readonly retryTakeover: () => void;
  readonly session: DecryptoRoomSession;
  /** 本局复盘弹窗、导出舞台与分享进度（平台 useRoomReview），放进房间 gameOverlays。 */
  readonly reviewOverlay: ReactNode;
}

/** 把当前就绪 session 绑定到房间壳控制器与命令上。 */
export function useDecryptoRoomState(
  props: GameRoomScreenProps<'decrypto'> & {
    readonly session: DecryptoRoomSession;
    readonly review: RoomReviewContribution<DecryptoState>;
    readonly entryController: RoomEntryController;
  },
): DecryptoRoomScreenState {
  const { session, room, entryController } = props;
  const { user, state, revision, submit, submitOperation, isSubmitting, pendingActionKey } =
    useReadyRoomSession(session, getDecryptoRoomCommandFailureMessage);
  const isHost = state.hostUserId === user.id;
  const mySeat = getDecryptoUserSeat(state, user.id);
  const viewer: RoomViewer = { userId: user.id, isHost, seat: mySeat };
  const isLobby = state.phase.kind === 'lobby';
  // 机器人接管：房主随时可接管；失去房主身份或座位不再是机器人时由共享守卫释放。
  const bots = useBotTakeover({
    viewer,
    isBotSeat: (seat) => isBotSeat(state.roster, seat),
    gameName: 'Decrypto',
  });
  const { controlledSeat, effectiveSeat } = bots;
  const takeover = useDecryptoTakeoverView({
    state,
    revision,
    roomCode: room.roomCode,
    controlledSeat,
  });
  const { share, titleActions, gachaStatus } = useRoomPresentationController({
    roomCode: room.roomCode,
    gameDisplayName: '解码战',
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
    hasOccupiedSeats: getDecryptoOccupiedSeatCount(state) > 0,
    isRoomFull: getDecryptoOccupiedSeatCount(state) === state.config.numberOfPlayers,
    configureGame: props.onOpenRoomSettings,
    shareRoom: share.open,
  });
  const gameDetails = useGameProfileDetails(profile.selection, '解码战战绩', '本游戏局数');
  const viewState = takeover.view ?? state;
  const viewModel = getDecryptoViewModel(
    viewState,
    effectiveSeat,
    isHost && controlledSeat === null,
  );
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
  const defaultSeatPress = createRoomSeatPressHandler({
    isSetup: isLobby,
    state,
    currentSeat: mySeat,
    resolveIntent: getDecryptoSeatTapIntent,
    profile,
    seatController,
  });
  const onSeatPress = (seat: number, disabledReason?: string) => {
    defaultSeatPress(seat, disabledReason);
  };
  const buildHostManagement = () =>
    createDecryptoHostManagement({
      state,
      capabilities,
      isSubmitting,
      submit,
      review: review.entry,
    });

  const shellModel: RoomShellModel = createDecryptoRoomShellModel({
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
    isSubmitting,
    pendingActionKey,
    buildHostManagement,
    releaseBot: bots.release,
    review: review.entry,
  });
  return {
    state: viewState,
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
    isTakeoverLoading: takeover.isLoading,
    hasTakeoverError: takeover.hasError,
    retryTakeover: takeover.retry,
    session,
    reviewOverlay: review.overlay,
  };
}
