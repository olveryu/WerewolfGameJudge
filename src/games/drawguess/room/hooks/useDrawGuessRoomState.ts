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
import { useCallback } from 'react';

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
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { RoomViewer } from '@/features/room/model/RoomViewer';
import { type DrawGuessRoomSession } from '@/games/drawguess/model/DrawGuessRoomSession';

import {
  createDrawGuessHostManagement,
  createDrawGuessRoomShellModel,
  getDrawGuessSeatTapIntent,
} from '../drawGuessRoomAdapter';
import { getDrawGuessRoomCommandFailureMessage } from '../drawGuessRoomCommandFailureMessage';

/**
 * 你画我猜房间 Screen 的显式契约（P-2b，对齐狼人杀 WerewolfRoomScreenState 形态）：
 * 领域推导（视图模型、阶段截止）全部在本 hook 内组装，Screen 只消费本接口渲染。
 */
export interface DrawGuessRoomScreenState {
  readonly state: DrawGuessState;
  readonly shellModel: RoomShellModel;
  /** 当前视角的视图模型（按有效席位裁剪，随 1 秒 tick 更新提示揭示）。 */
  readonly viewModel: DrawGuessViewModel;
  /** 当前阶段剩余秒数；无截止阶段为 null。到期由本 hook 统一派发阶段推进（原在 Screen 内）。 */
  readonly remainingSeconds: number | null;
  readonly roomCode: string;
  readonly userId: string;
  readonly mySeat: number | null;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly isHost: boolean;
  readonly canControlBots: boolean;
  readonly releaseBot: () => void;
  /** 平台单飞提交：座位动作由调用点显式传 `{ controlledSeat }`，房主命令不传。 */
  readonly submit: ReadyRoomSession<DrawGuessState, DrawGuessCommand>['submit'];
  readonly session: DrawGuessRoomSession;
  readonly openRules: () => void;
}

/** 把当前就绪 session 绑定到房间壳控制器与命令上。 */
export function useDrawGuessRoomState(
  props: GameRoomScreenProps<'drawguess'> & {
    readonly session: DrawGuessRoomSession;
    readonly entryController: RoomEntryController;
  },
): DrawGuessRoomScreenState {
  const { session, room, navigation, entryController } = props;
  const { user, state, revision, submit, isSubmitting } = useReadyRoomSession(
    session,
    getDrawGuessRoomCommandFailureMessage,
  );
  const isHost = state.hostUserId === user.id;
  const mySeat = getDrawGuessUserSeat(state, user.id);
  const viewer: RoomViewer = { userId: user.id, isHost, seat: mySeat };
  const isLobby = state.phase.kind === 'lobby';
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
    hasOccupiedSeats: getDrawGuessOccupiedSeatCount(state) > 0,
    isRoomFull: getDrawGuessOccupiedSeatCount(state) === state.config.numberOfPlayers,
    configureGame: () =>
      navigation.navigate('GameConfig', {
        gameType: 'drawguess',
        mode: 'edit',
        roomCode: room.roomCode,
      }),
    shareRoom: share.open,
  });
  // 阶段截止：剩余秒数与到期推进（原在 Screen 的 DrawGuessStage 内组装，P-2b 下沉）。
  const deadlineAt =
    state.phase.kind === 'wordSelect' ||
    state.phase.kind === 'drawing' ||
    state.phase.kind === 'roundEnd'
      ? state.phase.deadlineAt
      : null;
  const shouldExpire = useCallback(() => {
    const current = session.getSnapshot();
    return (
      current.phase === 'ready' &&
      current.status.kind === 'live' &&
      current.pendingDurableCount === 0 &&
      current.room.state.phaseRevision === state.phaseRevision
    );
  }, [session, state.phaseRevision]);
  const onExpire = useCallback(
    () =>
      session.dispatch(
        {
          type: 'drawguess.phase.expire',
          phaseRevision: state.phaseRevision,
          turnIndex: state.turnIndex,
        },
        { controlledSeat: null, label: '推进作画阶段', durable: true },
      ),
    [session, state.phaseRevision, state.turnIndex],
  );
  // 拼音首字母揭示按秒推进：时钟来自截止 hook（有截止的阶段才每秒重渲染）。
  const { remainingSeconds, nowMs } = useStageDeadline({
    deadlineAt,
    shouldExpire,
    onExpire,
    label: '推进作画阶段',
    silentExpire: true,
  });
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
    onUserActionPress: () => navigation.navigate('Settings', { roomCode: room.roomCode }),
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
  });
  return {
    state,
    shellModel,
    viewModel,
    remainingSeconds,
    roomCode: room.roomCode,
    userId: user.id,
    mySeat,
    effectiveSeat,
    controlledSeat,
    isHost,
    canControlBots: bots.capability.isAllowed,
    releaseBot: bots.release,
    submit,
    session,
    openRules: () =>
      navigation.navigate('GameGuide', { gameType: 'drawguess', roomCode: room.roomCode }),
  };
}
