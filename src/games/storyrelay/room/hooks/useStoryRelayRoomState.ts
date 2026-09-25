/** Composes shared room controllers; Story Relay owns only phase and bot-control availability. */

import {
  getStoryRelayOccupiedSeatCount,
  type StoryRelayCommand,
} from '@game-judge/game-engine/games/storyrelay/public';
import { useEffect, useRef } from 'react';

import { useAuthContext } from '@/contexts/AuthContext';
import { useGachaStatusQuery } from '@/features/gacha/queries/useGachaQuery';
import { useRoomBotControl } from '@/features/room/controllers/useRoomBotControl';
import { useRoomCommandSubmission } from '@/features/room/controllers/useRoomCommandSubmission';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useRoomHostOperations } from '@/features/room/controllers/useRoomHostOperations';
import { useRoomProfileController } from '@/features/room/controllers/useRoomProfileController';
import { useRoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import { useRoomSessionSnapshot } from '@/features/room/controllers/useRoomSessionSnapshot';
import { useRoomShareController } from '@/features/room/controllers/useRoomShareController';
import { useRoomTitleActions } from '@/features/room/controllers/useRoomTitleActions';
import {
  createRoomSetupCapabilities,
  type RoomCapabilities,
} from '@/features/room/model/RoomCapabilities';
import type { RoomHostManagementAction } from '@/features/room/model/RoomHostManagement';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import {
  getStoryRelayUserSeat,
  type StoryRelayRoomSession,
} from '@/games/storyrelay/model/StoryRelayRoomSession';
import { showAlert } from '@/utils/alert';
import { showErrorAlert } from '@/utils/alertPresets';

import {
  createStoryRelaySeatDataSource,
  createStoryRelayStatusRibbon,
  getStoryRelayProfileTarget,
} from '../storyRelayRoomAdapter';
import { getStoryRelayRoomCommandFailureMessage } from '../storyRelayRoomCommandFailureMessage';
import { useStoryRelaySeatCommands } from './useStoryRelaySeatCommands';

/** Binds the current ready session to the room-shell controllers and commands. */
export function useStoryRelayRoomState(
  props: GameRoomScreenProps<'storyrelay'> & {
    readonly session: StoryRelayRoomSession;
    readonly entryController: RoomEntryController;
  },
) {
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
  const canControlBots = isHost && (state.phase === 'answering' || state.phase === 'settling');
  useEffect(() => {
    if (controlledSeat !== null && (!canControlBots || !state.botSeats.includes(controlledSeat)))
      releaseBot();
  }, [canControlBots, controlledSeat, releaseBot, state.botSeats]);
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
      : { isAllowed: false, reason: '游戏中不能查看资料' },
    canTakeOverBots: canControlBots
      ? { isAllowed: true, execute: botControl.takeOver }
      : { isAllowed: false, reason: '当前不能接管机器人' },
  };
  const onSeatPress = (seat: number) => {
    if (!isLobby) return showErrorAlert('不可选择', '游戏进行中不能调整座位');
    const target = getStoryRelayProfileTarget(state, seat);
    if (target?.occupantKind === 'bot')
      return showAlert(target.rosterName, '选择座位操作', [
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
  for (const [key, label, icon, capability] of [
    ['configure', '房间设置', 'options-outline', capabilities.canConfigureGame],
    ['fill', '填充机器人', 'people-outline', capabilities.canFillBots],
    ['clear', '清空座位', 'trash-outline', capabilities.canClearSeats],
  ] as const)
    if (capability.isAllowed)
      actions.push({
        key,
        label,
        icon,
        variant: 'secondary',
        isEnabled: true,
        onPress: capability.execute,
      });
  if (state.botSeats.length > 0)
    actions.push({
      key: 'clear-bots',
      label: '移出所有机器人',
      icon: 'remove-circle-outline',
      variant: 'secondary',
      isEnabled: true,
      onPress: () =>
        showAlert('移出机器人', '保留真人座位，移出全部机器人？', [
          { text: '取消', style: 'cancel' },
          {
            text: '移出',
            onPress: () => void submit('移出机器人', { type: 'storyrelay.bots.clear' }),
          },
        ]),
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
      onBotSeatLongPress: canControlBots
        ? (seat) => (controlledSeat === seat ? releaseBot() : botControl.takeOver(seat))
        : null,
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
              isHost && isLobby && !selection.isSelf
                ? () => profile.kick(selection.target.seat)
                : null,
            onLeaveSeat: isLobby && selection.isSelf ? profile.leaveSelf : null,
          },
    share,
    bottomActions: {
      kind: 'info',
      message: isLobby && !isHost ? (mySeat === null ? '选择一个座位入座' : '等待房主开始') : null,
      actions: [],
    },
    hostManagement:
      isHost && isLobby
        ? {
            preview: '开始故事接龙',
            status: null,
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
                    isEnabled: true,
                    isLoading: submission.isSubmitting,
                    testID: 'storyrelay-start',
                    onPress: () => void submit('开始游戏', { type: 'storyrelay.round.start' }),
                  },
                ],
              },
              { key: 'room', title: '房间管理', actions },
            ],
          }
        : null,
    controlledSeat:
      controlledSeat === null
        ? canControlBots && state.botSeats.length > 0
          ? { kind: 'hint', showBulkViewHint: false }
          : null
        : {
            kind: 'controlled',
            seat: controlledSeat,
            displayName: `机器人${controlledSeat + 1}号`,
            onRelease: releaseBot,
          },
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
    isHost,
    openRules: () =>
      navigation.navigate('GameGuide', { gameType: 'storyrelay', roomCode: room.roomCode }),
  };
}
