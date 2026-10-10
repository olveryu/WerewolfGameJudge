/** Composes shared room controllers; Story Relay owns only phase and bot-control availability. */

import {
  getStoryRelayBotSeats,
  getStoryRelayOccupiedSeatCount,
  getStoryRelayUserSeat,
  isStoryRelayBotSeat,
  type StoryRelayCommand,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { useCallback, useEffect, useRef } from 'react';

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
import { type StoryRelayRoomSession } from '@/games/storyrelay/model/StoryRelayRoomSession';
import { showConfirmAlert, showErrorAlert } from '@/utils/alertPresets';

import {
  createStoryRelaySeatDataSource,
  createStoryRelayStatusRibbon,
  getStoryRelayProfileTarget,
} from '../storyRelayRoomAdapter';
import { getStoryRelayRoomCommandFailureMessage } from '../storyRelayRoomCommandFailureMessage';
import { useStoryRelaySeatCommands } from './useStoryRelaySeatCommands';

/**
 * 故事接龙房间 Screen 的显式契约（P-2b，对齐狼人杀 WerewolfRoomScreenState 形态）：
 * Screen 无本地推导（仅透传字段给 StoryRelayStage），本接口把 hook 返回钉死防回潮。
 * 阶段组件 StoryRelayStage 的内部交互状态属组件自身，不在此列。
 */
export interface StoryRelayRoomScreenState {
  readonly state: StoryRelayState;
  readonly shellModel: RoomShellModel;
  readonly userId: string;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly releaseBot: RoomBotControl['release'];
  readonly isHost: boolean;
  readonly canControlBots: boolean;
  readonly openRules: () => void;
}

/** Binds the current ready session to the room-shell controllers and commands. */
export function useStoryRelayRoomState(
  props: GameRoomScreenProps<'storyrelay'> & {
    readonly session: StoryRelayRoomSession;
    readonly entryController: RoomEntryController;
  },
): StoryRelayRoomScreenState {
  const { session, room, navigation, entryController } = props;
  const { user } = useAuthContext();
  const snapshot = useRoomSessionSnapshot(session);
  if (user === null || snapshot.phase !== 'ready')
    throw new Error('Story Relay requires an authenticated ready session');
  const state = snapshot.snapshot.state;
  const isHost = state.hostUserId === user.id;
  const mySeat = getStoryRelayUserSeat(state, user.id);
  const isLobby = state.phase === 'lobby';
  const botControl = useRoomBotControl();
  const { controlledSeat, release: releaseBot } = botControl;
  const seats = useStoryRelaySeatCommands(session, user);
  const seatController = useRoomSeatController({ currentSeat: mySeat, takeSeat: seats.takeSeat });
  const profile = useRoomProfileController({
    myUserId: user.id,
    kickSeat: seats.kickSeat,
    leaveSeat: seats.leaveSeat,
  });
  const host = useRoomHostOperations({ clearSeats: seats.clearSeats, fillBots: seats.fillBots });
  const share = useRoomShareController({ roomCode: room.roomCode, gameDisplayName: '故事接龙' });
  const titleActions = useRoomTitleActions();
  const { data: gachaStatus } = useGachaStatusQuery();
  const submission = useRoomCommandSubmission(getStoryRelayRoomCommandFailureMessage);
  const submit = (label: string, command: StoryRelayCommand) =>
    submission.submit(label, () => session.dispatch(command, { controlledSeat: null, label }));
  const canControlBots = isHost;
  useBotTakeoverGuard({
    controlledSeat,
    canControlBots,
    seatStillBot: controlledSeat === null || isStoryRelayBotSeat(state, controlledSeat),
    release: releaseBot,
  });
  const capabilities: RoomCapabilities = {
    ...createRoomSetupCapabilities({
      isSetup: isLobby,
      isHost,
      mySeat,
      supportsBots: true,
      hasOccupiedSeats: getStoryRelayOccupiedSeatCount(state) > 0,
      isRoomFull: getStoryRelayOccupiedSeatCount(state) === state.config.numberOfPlayers,
      requestTakeSeat: seatController.requestTakeSeat,
      requestMoveSeat: seatController.requestMoveSeat,
      leaveSeat: profile.leaveSelf,
      kickSeat: profile.kick,
      clearSeats: host.requestClearSeats,
      fillBots: host.requestFillBots,
      configureGame: () =>
        navigation.navigate('GameConfig', {
          gameType: 'storyrelay',
          mode: 'edit',
          roomCode: room.roomCode,
        }),
      shareRoom: share.open,
    }),
    canViewProfiles: isLobby
      ? { isAllowed: true, execute: profile.open }
      : { isAllowed: false, reason: '游戏进行中不能查看玩家资料' },
    canTakeOverBots: canControlBots
      ? { isAllowed: true, execute: botControl.takeOver }
      : { isAllowed: false, reason: '只有房主可以接管机器人' },
  };
  const isBotSeat = useCallback((seat: number) => isStoryRelayBotSeat(state, seat), [state]);
  const onBotSeatLongPress = useBotTakeoverLongPress({
    controlledSeat,
    takeOver: botControl.takeOver,
    release: releaseBot,
    canTakeOver: capabilities.canTakeOverBots.isAllowed,
    deniedReason: capabilities.canTakeOverBots.isAllowed
      ? undefined
      : (capabilities.canTakeOverBots.reason ?? undefined),
    isBotSeat,
    gameName: 'StoryRelay',
  });
  const onSeatPress = (seat: number) => {
    if (!isLobby) return showErrorAlert('不可选择', '游戏进行中不能调整座位');
    const target = getStoryRelayProfileTarget(state, seat);
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
  const canAbort =
    ['answering', 'settling', 'transition'].includes(state.phase) && state.completedAt === null;
  const isTerminal = state.phase === 'ended' || state.phase === 'aborted';
  const terminalHostManagement: RoomHostManagementModel | null = !isTerminal
    ? null
    : {
        preview: state.phase === 'ended' ? '故事已揭晓' : '未完成的故事',
        status: null,
        sections: [
          {
            key: 'current-flow',
            title: '当前流程',
            actions: [
              ...(state.phase === 'ended'
                ? [
                    {
                      key: 'next-round',
                      label: '再来一局',
                      icon: 'play-forward-outline' as const,
                      variant: 'primary' as const,
                      isEnabled: true as const,
                      testID: 'storyrelay-next-round',
                      onPress: () =>
                        showConfirmAlert(
                          '再来一局',
                          '重新分配写作顺序并开始新一局。当前故事将被替换，请先保存需要保留的故事图片。',
                          async () => {
                            await submit('再来一局', { type: 'storyrelay.round.next' });
                          },
                        ),
                    },
                  ]
                : []),
              {
                key: 'return-lobby',
                label: '返回大厅',
                icon: 'return-down-back-outline' as const,
                variant: 'secondary' as const,
                isEnabled: true as const,
                testID: 'storyrelay-return-lobby',
                onPress: () =>
                  showConfirmAlert(
                    '返回大厅',
                    '保留座位和设置，清除当前故事。请先保存需要保留的故事图片。',
                    async () => {
                      await submit('返回大厅', { type: 'storyrelay.game.returnToLobby' });
                    },
                  ),
              },
            ],
          },
        ],
      };
  const activeHostManagement: RoomHostManagementModel | null =
    terminalHostManagement ??
    (!canAbort
      ? null
      : {
          preview: '管理本局',
          status: null,
          sections: [
            ...(state.phase === 'answering'
              ? [
                  {
                    key: 'current-flow',
                    title: '当前流程',
                    actions: [
                      {
                        key: 'finish-phase',
                        label: '结束本棒',
                        icon: 'stop-circle-outline' as const,
                        variant: 'secondary' as const,
                        isEnabled: true as const,
                        testID: 'storyrelay-finish-step',
                        onPress: () =>
                          showConfirmAlert(
                            '结束本棒',
                            '将自动收取当前文字，没有内容时自动交空白。',
                            async () => {
                              await submit('结束本棒', {
                                type: 'storyrelay.phase.finish',
                                phaseRevision: state.phaseRevision,
                              });
                            },
                          ),
                      },
                    ],
                  },
                ]
              : []),
            {
              key: 'danger',
              title: '危险操作',
              actions: [
                {
                  key: 'abort-round',
                  label: '中止本局',
                  icon: 'close-circle-outline',
                  variant: 'danger',
                  isEnabled: true,
                  onPress: () =>
                    showConfirmAlert(
                      '中止本局',
                      '将公开已收录的故事片段，本局不结算奖励。',
                      async () => {
                        await submit('中止本局', {
                          type: 'storyrelay.round.abort',
                          phaseRevision: state.phaseRevision,
                        });
                      },
                    ),
                },
              ],
            },
          ],
        });
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
    statusRibbon: createStoryRelayStatusRibbon(state),
    seats: {
      source: createStoryRelaySeatDataSource(
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
            status: `等待入座 · ${getStoryRelayOccupiedSeatCount(state)}/${state.config.numberOfPlayers}`,
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
                    testID: 'storyrelay-start',
                    ...(submission.isSubmitting
                      ? { isEnabled: false as const, disabledReason: null, onDisabledPress: null }
                      : getStoryRelayOccupiedSeatCount(state) === state.config.numberOfPlayers
                        ? {
                            isEnabled: true as const,
                            onPress: () =>
                              void submit('开始游戏', { type: 'storyrelay.round.start' }),
                          }
                        : {
                            isEnabled: false as const,
                            disabledReason: '座位尚未坐满',
                            onDisabledPress: () =>
                              showErrorAlert('暂时不能开始', '请先坐满所有座位，或填充机器人。'),
                          }),
                  },
                ],
              },
              { key: 'room', title: '房间管理', actions },
            ],
          }
        : activeHostManagement,
    controlledSeat: createControlledSeatModel({
      canControlBots,
      hasBots: getStoryRelayBotSeats(state).length > 0,
      controlledSeat,
      controlledBotName: controlledSeat !== null ? getBotDisplayName(controlledSeat) : null,
      release: releaseBot,
      gameName: 'StoryRelay',
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
    userId: user.id,
    effectiveSeat: controlledSeat ?? mySeat,
    controlledSeat,
    releaseBot,
    isHost,
    canControlBots,
    openRules: () =>
      navigation.navigate('GameGuide', { gameType: 'storyrelay', roomCode: room.roomCode }),
  };
}
