/** Composes shared room controllers; Story Relay owns only phase and bot-control availability. */

import {
  getStoryRelayOccupiedSeatCount,
  getStoryRelayUserSeat,
  isStoryRelayBotSeat,
  type StoryRelayCommand,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { useCallback } from 'react';

import { useAuthContext } from '@/contexts/AuthContext';
import { useGachaStatusQuery } from '@/features/gacha/queries/useGachaQuery';
import { useAutoShowRoomShareQr } from '@/features/room/controllers/useAutoShowRoomShareQr';
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
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
  type RoomCapabilities,
} from '@/features/room/model/RoomCapabilities';
import { ROOM_SEAT_TAP_BLOCKED_TITLE } from '@/features/room/model/RoomSeatTap';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { type StoryRelayRoomSession } from '@/games/storyrelay/model/StoryRelayRoomSession';
import { showErrorAlert } from '@/utils/alertPresets';

import {
  createStoryRelayHostManagement,
  createStoryRelayRoomShellModel,
  getStoryRelaySeatTapIntent,
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
    canTakeOverBots: createBotTakeoverCapability(canControlBots, botControl.takeOver),
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
  const onSeatPress = (seat: number, disabledReason?: string) => {
    // 局内点座对齐狼人杀 SeatTapPolicy：静默 NOOP，不弹锁定提示。
    if (!isLobby) return;
    const intent = getStoryRelaySeatTapIntent({
      state,
      seat,
      currentSeat: mySeat,
      disabledReason,
    });
    switch (intent.kind) {
      case 'blocked':
        return showErrorAlert(ROOM_SEAT_TAP_BLOCKED_TITLE, intent.reason);
      case 'profile':
        return profile.open(intent.target);
      case 'take':
        return seatController.requestTakeSeat(intent.seat);
      case 'move':
        return seatController.requestMoveSeat(intent.seat);
    }
  };
  const hostManagement = createStoryRelayHostManagement({
    state,
    isHost,
    capabilities,
    isSubmitting: submission.isSubmitting,
    submit,
  });

  const selection = profile.selection;
  const shellModel: RoomShellModel = createStoryRelayRoomShellModel({
    roomCode: room.roomCode,
    capabilities,
    onBack: () => entryController.requestExit(capabilities.shouldConfirmExit),
    onTitlePress: titleActions.handleTitlePress,
    onTitleLongPress: titleActions.handleTitleLongPress,
    user,
    gachaStatus,
    onUserActionPress: () => navigation.navigate('Settings', { roomCode: room.roomCode }),
    connection: entryController.connection,
    state,
    revision: snapshot.snapshot.revision,
    userId: user.id,
    controlledSeat,
    seatsVisuallyDisabled: submission.isSubmitting || seatController.isSubmitting,
    onSeatPress,
    onBotSeatLongPress: canControlBots ? onBotSeatLongPress : null,
    seatController,
    profileSelection: selection,
    onProfileClose: profile.close,
    onProfileLeaveSeat: profile.leaveSelf,
    share,
    isLobby,
    isHost,
    mySeat,
    hostManagement,
    canControlBots,
    releaseBot,
  });
  const openShare = share.open;
  useAutoShowRoomShareQr({ isHost, entryReason: props.entryReason, openShare });
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
