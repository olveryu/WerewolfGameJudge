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
  isDrawGuessBotSeat,
} from '@game-judge/game-engine/games/drawguess/public';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuthContext } from '@/contexts/AuthContext';
import { useGachaStatusQuery } from '@/features/gacha/queries/useGachaQuery';
import { useBotTakeoverGuard } from '@/features/room/controllers/useBotTakeoverGuard';
import { useBotTakeoverLongPress } from '@/features/room/controllers/useBotTakeoverLongPress';
import {
  type RoomBotControl,
  useRoomBotControl,
} from '@/features/room/controllers/useRoomBotControl';
import { useRoomCommandSubmission } from '@/features/room/controllers/useRoomCommandSubmission';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useRoomHostOperations } from '@/features/room/controllers/useRoomHostOperations';
import { useRoomProfileController } from '@/features/room/controllers/useRoomProfileController';
import { useRoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import { useRoomSessionSnapshot } from '@/features/room/controllers/useRoomSessionSnapshot';
import { useRoomShareController } from '@/features/room/controllers/useRoomShareController';
import { useRoomTitleActions } from '@/features/room/controllers/useRoomTitleActions';
import { useStageDeadline } from '@/features/room/hooks/useStageDeadline';
import { createControlledSeatModel } from '@/features/room/model/createControlledSeatModel';
import { executeProfileKick } from '@/features/room/model/executeProfileKick';
import { getBotDisplayName } from '@/features/room/model/getBotDisplayName';
import {
  buildClearSeatsAction,
  buildFillBotsAction,
  buildRoomConfigAction,
} from '@/features/room/model/hostManagementActions';
import {
  createRoomSetupCapabilities,
  type RoomCapabilities,
} from '@/features/room/model/RoomCapabilities';
import type {
  RoomHostManagementAction,
  RoomHostManagementModel,
} from '@/features/room/model/RoomHostManagement';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { type DrawGuessRoomSession } from '@/games/drawguess/model/DrawGuessRoomSession';
import { showAlert } from '@/utils/alert';
import { showConfirmAlert, showErrorAlert } from '@/utils/alertPresets';

import {
  createDrawGuessSeatDataSource,
  createDrawGuessStatusRibbon,
  getDrawGuessProfileTarget,
} from '../drawGuessRoomAdapter';
import { getDrawGuessRoomCommandFailureMessage } from '../drawGuessRoomCommandFailureMessage';
import { useDrawGuessSeatCommands } from './useDrawGuessSeatCommands';

/**
 * 每秒更新的本地时钟：驱动拼音首字母揭示的显示 tick（effect 内更新，render 保持纯）。
 * 仅在非大厅阶段激活——大厅不挂载阶段视图，也不应有每秒重渲染（原在 Screen 的
 * DrawGuessStage 内，随阶段视图挂载/卸载；P-2b 下沉后以 active 门保持同一节奏）。
 */
function useDrawGuessNowMs(active: boolean): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return nowMs;
}

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
  readonly takeOver: RoomBotControl['takeOver'];
  readonly releaseBot: RoomBotControl['release'];
  readonly submit: (label: string, command: DrawGuessCommand) => Promise<boolean>;
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
  const { user } = useAuthContext();
  const snapshot = useRoomSessionSnapshot(session);
  if (user === null || snapshot.phase !== 'ready')
    throw new Error('DrawGuess requires an authenticated ready session');
  const state = snapshot.snapshot.state;
  const isHost = state.hostUserId === user.id;
  const mySeat = getDrawGuessUserSeat(state, user.id);
  const isLobby = state.phase.kind === 'lobby';
  const botControl = useRoomBotControl();
  const { controlledSeat, release: releaseBot, takeOver } = botControl;
  const effectiveSeat = controlledSeat ?? mySeat;
  const seats = useDrawGuessSeatCommands(session, user);
  const seatController = useRoomSeatController({ currentSeat: mySeat, takeSeat: seats.takeSeat });
  const profile = useRoomProfileController({
    myUserId: user.id,
    kickSeat: seats.kickSeat,
    leaveSeat: seats.leaveSeat,
  });
  const host = useRoomHostOperations({ clearSeats: seats.clearSeats, fillBots: seats.fillBots });
  const share = useRoomShareController({ roomCode: room.roomCode, gameDisplayName: '你画我猜' });
  const titleActions = useRoomTitleActions();
  const { data: gachaStatus } = useGachaStatusQuery();
  const submission = useRoomCommandSubmission(getDrawGuessRoomCommandFailureMessage);
  const submit = (label: string, command: DrawGuessCommand) =>
    submission.submit(label, () => session.dispatch(command, { controlledSeat, label }));
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
      current.connection === 'live' &&
      current.pendingCommandCount === 0 &&
      current.snapshot.state.phaseRevision === state.phaseRevision
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
        { controlledSeat: null, label: '推进作画阶段', isRecoverable: true },
      ),
    [session, state.phaseRevision, state.turnIndex],
  );
  const remainingSeconds = useStageDeadline({
    deadlineAt,
    shouldExpire,
    onExpire,
    label: '推进作画阶段',
  });
  const nowMs = useDrawGuessNowMs(!isLobby);
  const viewModel = getDrawGuessViewModel(state, effectiveSeat, nowMs);
  // 机器人接管：房主随时可接管（无阶段条件）；失去房主身份或座位不再是机器人时自动释放。
  const canControlBots = isHost;
  useBotTakeoverGuard({
    controlledSeat,
    canControlBots,
    seatStillBot: controlledSeat === null || isDrawGuessBotSeat(state, controlledSeat),
    release: releaseBot,
  });
  const capabilities: RoomCapabilities = {
    ...createRoomSetupCapabilities({
      isSetup: isLobby,
      isHost,
      mySeat,
      supportsBots: true,
      hasOccupiedSeats: getDrawGuessOccupiedSeatCount(state) > 0,
      isRoomFull: getDrawGuessOccupiedSeatCount(state) === state.config.numberOfPlayers,
      requestTakeSeat: seatController.requestTakeSeat,
      requestMoveSeat: seatController.requestMoveSeat,
      leaveSeat: profile.leaveSelf,
      kickSeat: profile.kick,
      clearSeats: host.requestClearSeats,
      fillBots: host.requestFillBots,
      configureGame: () =>
        navigation.navigate('GameConfig', {
          gameType: 'drawguess',
          mode: 'edit',
          roomCode: room.roomCode,
        }),
      shareRoom: share.open,
    }),
    canViewProfiles: isLobby
      ? { isAllowed: true, execute: profile.open }
      : { isAllowed: false, reason: '游戏进行中不能查看玩家资料' },
    canTakeOverBots: canControlBots
      ? { isAllowed: true, execute: takeOver }
      : { isAllowed: false, reason: '只有房主可以接管机器人' },
  };
  const isBotSeat = useCallback(
    (seat: number) => getDrawGuessProfileTarget(state, seat)?.occupantKind === 'bot',
    [state],
  );
  const onBotSeatLongPress = useBotTakeoverLongPress({
    controlledSeat,
    takeOver,
    release: releaseBot,
    canTakeOver: capabilities.canTakeOverBots.isAllowed,
    deniedReason: capabilities.canTakeOverBots.isAllowed
      ? undefined
      : (capabilities.canTakeOverBots.reason ?? undefined),
    isBotSeat,
    gameName: 'DrawGuess',
  });
  const onSeatPress = (seat: number) => {
    if (!isLobby) return showErrorAlert('不可选择', '游戏进行中不能调整座位');
    const target = getDrawGuessProfileTarget(state, seat);
    if (target?.occupantKind === 'bot')
      return showAlert(target.rosterName, '请选择对该机器人座位的操作', [
        { text: '取消', style: 'cancel' },
        { text: '查看资料', onPress: () => profile.open(target) },
        {
          text: '替换机器人入座',
          onPress: () =>
            mySeat === null
              ? seatController.requestTakeSeat(seat)
              : seatController.requestMoveSeat(seat),
        },
      ]);
    if (target !== null) return profile.open(target);
    return mySeat === null
      ? seatController.requestTakeSeat(seat)
      : seatController.requestMoveSeat(seat);
  };
  const actions: RoomHostManagementAction[] = [];
  if (capabilities.canConfigureGame.isAllowed)
    actions.push(buildRoomConfigAction({ onPress: capabilities.canConfigureGame.execute }));
  if (capabilities.canFillBots.isAllowed)
    actions.push(buildFillBotsAction({ onPress: capabilities.canFillBots.execute }));
  if (capabilities.canClearSeats.isAllowed)
    actions.push(buildClearSeatsAction({ onPress: capabilities.canClearSeats.execute }));
  const occupiedSeatCount = getDrawGuessOccupiedSeatCount(state);
  const canStart = occupiedSeatCount === state.config.numberOfPlayers;
  const startDisabledReason = canStart ? null : '座位尚未坐满';
  const isTerminal = state.phase.kind === 'ended';
  const terminalHostManagement: RoomHostManagementModel | null = !isTerminal
    ? null
    : {
        preview: '本局已结束',
        status: null,
        sections: [
          {
            key: 'current-flow',
            title: '当前流程',
            actions: [
              {
                key: 'next-round',
                label: '再来一局',
                icon: 'play-forward-outline' as const,
                variant: 'primary' as const,
                isEnabled: true as const,
                testID: 'drawguess-next-round',
                onPress: () =>
                  showConfirmAlert(
                    '再来一局',
                    '重新生成画手队列并清零比分，开始新的一局。',
                    async () => {
                      await submit('再来一局', { type: 'drawguess.round.start' });
                    },
                  ),
              },
              {
                key: 'return-lobby',
                label: '返回大厅',
                icon: 'return-down-back-outline' as const,
                variant: 'secondary' as const,
                isEnabled: true as const,
                testID: 'drawguess-return-lobby',
                onPress: () =>
                  showConfirmAlert('返回大厅', '保留座位和设置，清除当前对局。', async () => {
                    await submit('返回大厅', { type: 'drawguess.game.returnToLobby' });
                  }),
              },
            ],
          },
        ],
      };
  const selection = profile.selection;
  const shellModel: RoomShellModel = {
    roomCode: room.roomCode,
    capabilities,
    header: {
      onBack: () => entryController.requestExit(capabilities.shouldConfirmExit),
      onTitlePress: titleActions.handleTitlePress,
      onTitleLongPress: titleActions.handleTitleLongPress,
      userAction: {
        user,
        ticketCount: gachaStatus ? gachaStatus.normalDraws + gachaStatus.goldenDraws : null,
        onPress: () => navigation.navigate('Settings', { roomCode: room.roomCode }),
      },
    },
    connection: entryController.connection,
    statusRibbon: createDrawGuessStatusRibbon(state),
    seats: {
      source: createDrawGuessSeatDataSource(
        state,
        snapshot.snapshot.revision,
        user.id,
        controlledSeat,
      ),
      visuallyDisabled: submission.isSubmitting || seatController.isSubmitting,
      onSeatPress,
      onBotSeatLongPress: canControlBots ? onBotSeatLongPress : null,
    },
    seatConfirmation:
      seatController.pendingAction === null
        ? null
        : {
            action: seatController.pendingAction,
            isSubmitting: seatController.isSubmitting,
            onConfirm: seatController.confirm,
            onCancel: seatController.cancel,
          },
    profile:
      selection === null
        ? null
        : {
            target: selection.target,
            isSelf: selection.isSelf,
            onClose: profile.close,
            gameDetails: null,
            onKick:
              !selection.isSelf && capabilities.canKickSeat.isAllowed
                ? () => executeProfileKick(capabilities, selection)
                : null,
            onLeaveSeat: isLobby && selection.isSelf ? profile.leaveSelf : null,
          },
    share,
    bottomActions: {
      kind: 'info',
      message: isLobby && !isHost && mySeat !== null ? '等待房主开始游戏' : null,
      actions: [],
    },
    hostManagement: !isHost
      ? null
      : isLobby
        ? {
            preview: '开始游戏',
            status: `等待入座 · ${occupiedSeatCount}/${state.config.numberOfPlayers}`,
            sections: [
              {
                key: 'game',
                title: '游戏',
                actions: [
                  {
                    key: 'start',
                    label: '开始游戏',
                    icon: 'play-outline',
                    variant: 'primary',
                    isLoading: submission.isSubmitting,
                    testID: 'drawguess-start',
                    ...(submission.isSubmitting || !canStart
                      ? {
                          isEnabled: false as const,
                          disabledReason: startDisabledReason,
                          onDisabledPress: () =>
                            showErrorAlert('暂时不能开始', startDisabledReason ?? '请稍后重试'),
                        }
                      : {
                          isEnabled: true as const,
                          onPress: () => void submit('开始游戏', { type: 'drawguess.round.start' }),
                        }),
                  },
                ],
              },
              { key: 'room', title: '房间管理', actions },
            ],
          }
        : terminalHostManagement,
    controlledSeat: createControlledSeatModel({
      isVisible: controlledSeat !== null,
      controlledSeat,
      controlledBotName: controlledSeat !== null ? getBotDisplayName(controlledSeat) : null,
      release: releaseBot,
      gameName: 'DrawGuess',
    }),
  };
  const hasAutoShownQR = useRef(false);
  const openShare = share.open;
  useEffect(() => {
    if (isHost && props.entryReason === 'created' && !hasAutoShownQR.current) {
      hasAutoShownQR.current = true;
      openShare();
    }
  }, [isHost, openShare, props.entryReason]);
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
    canControlBots,
    takeOver,
    releaseBot,
    submit,
    session,
    openRules: () =>
      navigation.navigate('GameGuide', { gameType: 'drawguess', roomCode: room.roomCode }),
  };
}
