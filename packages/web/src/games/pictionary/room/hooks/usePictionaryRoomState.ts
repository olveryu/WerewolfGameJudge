/** Compose shared room controllers with Pictionary lobby and phase semantics. */

import {
  createPictionaryCommand,
  getPictionaryOccupiedSeatCount,
  getPictionaryUserSeat,
  isBotSeat,
  isPictionaryRoomFull,
  type PictionaryPublicCommand,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
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
import { createControlledSeatModel } from '@/features/room/model/createControlledSeatModel';
import { createRoomProfileCardModel } from '@/features/room/model/createRoomProfileCardModel';
import { createRoomSeatConfirmationModel } from '@/features/room/model/createRoomSeatConfirmationModel';
import { HOST_FLOW_CONFIRM } from '@/features/room/model/hostManagementActions';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { RoomStageHudModel } from '@/features/room/model/RoomStage';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { RoomViewer } from '@/features/room/model/RoomViewer';
import type { RoomReviewContribution } from '@/features/room/review/types';
import { type RoomReviewController, useRoomReview } from '@/features/room/review/useRoomReview';
import { useGameProfileDetails } from '@/games/model/useGameProfileDetails';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import { showConfirmAlert } from '@/utils/alertPresets';

import {
  createPictionaryHostManagement,
  createPictionaryRoomShellModel,
  createPictionarySeatDataSource,
  getPictionarySeatTapIntent,
  PICTIONARY_DISPLAY_NAME,
} from '../pictionaryRoomAdapter';
import { getPictionaryRoomCommandFailureMessage } from '../pictionaryRoomCommandFailureMessage';
import { createPictionaryStageHud } from '../pictionaryStageHud';

interface UsePictionaryRoomScreenStateParams {
  readonly room: GameRoomScreenProps<'pictionary'>['room'];
  readonly entryReason: GameRoomScreenProps<'pictionary'>['entryReason'];
  readonly entryController: RoomEntryController;
  readonly session: PictionaryRoomSession;
  readonly review: RoomReviewContribution<PictionaryState>;
}

/**
 * 你画我猜（接龙）房间 Screen 的显式契约：Screen 需要的状态推导（含阶段截止 tick 与信息条）全部在本 hook 内组装。
 * 阶段组件 PictionaryStage 的内部交互状态（任务输入、自动提交）属组件自身。
 */
export interface PictionaryRoomScreenState {
  readonly shellModel: RoomShellModel;
  readonly state: PictionaryState;
  /** 作答 / 换棒 / 收尾阶段的信息条；大厅、画廊与终局不是舞台内容，为 null。 */
  readonly stageHud: RoomStageHudModel | null;
  /** 当前阶段剩余秒数；无截止阶段为 null。到期推进由服务端定时结算完成，任何手机都不发 expire。 */
  readonly remainingSeconds: number | null;
  /** 截止已过且宽限期已过：结算逾期，房主可见自救重试。 */
  readonly isOverdue: boolean;
  /** 已占座位数（引擎口径）。 */
  readonly occupiedSeatCount: number;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly userId: string;
  readonly isHost: boolean;
  readonly openRules: () => void;
  readonly session: PictionaryRoomSession;
  /** 平台单飞漏斗：阶段组件的玩家 / 房主命令都经此发出。 */
  readonly submit: ReadyRoomSession<PictionaryState, PictionaryPublicCommand>['submit'];
  readonly isSubmitting: boolean;
  /** 本局复盘的对话框 / 导出舞台，挂在房间的 gameOverlays。 */
  readonly reviewOverlay: ReactNode;
  /** 在某一册所在页打开本局复盘（画廊「分享本篇画册」）。 */
  readonly openReview: RoomReviewController['open'];
}

export function usePictionaryRoomState({
  room,
  entryReason,
  entryController,
  session,
  review: reviewContribution,
}: UsePictionaryRoomScreenStateParams): PictionaryRoomScreenState {
  const { user, state, revision, submit, isSubmitting } = useReadyRoomSession(
    session,
    getPictionaryRoomCommandFailureMessage,
  );
  const navigate = useNavigate();
  const isHost = state.hostUserId === user.id;
  const mySeat = getPictionaryUserSeat(state, user.id);
  const viewer = useMemo(
    (): RoomViewer => ({ userId: user.id, isHost, seat: mySeat }),
    [isHost, mySeat, user.id],
  );
  const isLobby = state.phase === 'lobby';
  const bots = useBotTakeover({
    viewer,
    isBotSeat: (seat) => isBotSeat(state.roster, seat),
    gameName: 'Pictionary',
  });
  const { controlledSeat, effectiveSeat } = bots;
  const { share, titleActions, gachaStatus } = useRoomPresentationController({
    roomCode: room.roomCode,
    gameDisplayName: PICTIONARY_DISPLAY_NAME,
    isHost,
    entryReason,
  });
  const configureGame = useCallback(() => {
    void navigate(gameConfigEditPath('pictionary', room.roomCode));
  }, [navigate, room.roomCode]);
  const openRules = useCallback(() => {
    void navigate(gameGuidePath('pictionary', room.roomCode));
  }, [navigate, room.roomCode]);
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
    hasOccupiedSeats: getPictionaryOccupiedSeatCount(state) > 0,
    isRoomFull: isPictionaryRoomFull(state),
    configureGame,
    shareRoom: share.open,
  });
  const capabilities: RoomCapabilities = {
    ...setupCapabilities,
    canTakeOverBots: bots.capability,
  };
  // 倒计时只做展示：到期推进由服务端定时结算完成，任何手机都不发 expire。
  // isOverdue 是房主自救的共享判定：截止后宽限期已过、结算仍未到达。
  const { remainingSeconds, isOverdue } = useStageDeadline({
    deadlineAt: state.deadlineAt,
    refreshIntervalMs: 250,
  });
  const review = useRoomReview({
    contribution: reviewContribution,
    state,
    viewer,
    roomId: room.roomId,
    roomCode: room.roomCode,
    onOpened: null,
  });
  const gameDetails = useGameProfileDetails(profile.selection, '你画我猜接龙战绩', '本游戏局数');

  // 房主流程命令：不带接管座位（房主门只认未接管身份）。
  const startRound = () => void submit('开始游戏', { type: 'pictionary.game.begin' });
  const nextRound = () =>
    void submit('再来一局', createPictionaryCommand(state, { type: 'pictionary.game.next' }, null));
  const returnToLobby = () =>
    void submit(
      '返回大厅',
      createPictionaryCommand(state, { type: 'pictionary.game.returnToLobby' }, null),
    );
  const abortRound = () =>
    showConfirmAlert(
      HOST_FLOW_CONFIRM.abortTitle,
      '保留已提交作品供回看；本局不结算完成奖励。',
      async () => {
        await submit(
          '中止本局',
          createPictionaryCommand(state, { type: 'pictionary.game.abort' }, null),
        );
      },
    );

  const onSeatPress = createRoomSeatPressHandler({
    isSetup: isLobby,
    state,
    currentSeat: mySeat,
    resolveIntent: getPictionarySeatTapIntent,
    profile,
    seatController,
  });
  const seatSource = useMemo(
    () => createPictionarySeatDataSource({ state, revision, myUserId: user.id, controlledSeat }),
    [controlledSeat, revision, state, user.id],
  );
  const shellModel: RoomShellModel = createPictionaryRoomShellModel({
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
    seatSource,
    seatsVisuallyDisabled: isSubmitting || seatController.isSubmitting,
    onSeatPress,
    onBotSeatLongPress: bots.capability.isAllowed ? bots.onBotSeatLongPress : null,
    seatConfirmation: createRoomSeatConfirmationModel(seatController),
    profile: createRoomProfileCardModel({
      selection: profile.selection,
      capabilities,
      onClose: profile.close,
      onLeaveSeat: profile.leaveSelf,
      gameDetails,
    }),
    share,
    review: review.entry,
    buildHostManagement: () =>
      createPictionaryHostManagement({
        state,
        isCommandSubmitting: isSubmitting,
        capabilities,
        review: review.entry,
        startRound,
        nextRound,
        returnToLobby,
        abortRound,
      }),
    controlledSeat: createControlledSeatModel({
      controlledSeat,
      controlledBotName:
        controlledSeat !== null
          ? (seatSource.getSeat(controlledSeat).player?.displayName ?? null)
          : null,
      release: bots.release,
      gameName: 'Pictionary',
    }),
  });

  return {
    shellModel,
    state,
    stageHud: createPictionaryStageHud({
      state,
      remainingSeconds,
      seats: shellModel.seats.source,
    }),
    remainingSeconds,
    isOverdue,
    occupiedSeatCount: getPictionaryOccupiedSeatCount(state),
    effectiveSeat,
    controlledSeat,
    userId: user.id,
    isHost,
    openRules,
    session,
    submit,
    isSubmitting,
    reviewOverlay: review.overlay,
    openReview: review.open,
  };
}
