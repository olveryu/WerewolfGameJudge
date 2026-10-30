/** Composes shared room controllers; Story Relay owns only phase and bot-control availability. */

import {
  getStoryRelayOccupiedSeatCount,
  getStoryRelayUserSeat,
  isBotSeat,
  type StoryRelayCommand,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';

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
import { type StoryRelayRoomSession } from '@/games/storyrelay/model/StoryRelayRoomSession';

import {
  createStoryRelayHostManagement,
  createStoryRelayRoomShellModel,
  getStoryRelaySeatTapIntent,
} from '../storyRelayRoomAdapter';
import { getStoryRelayRoomCommandFailureMessage } from '../storyRelayRoomCommandFailureMessage';

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
  readonly releaseBot: () => void;
  readonly isHost: boolean;
  readonly canControlBots: boolean;
  /** 平台单飞提交：座位动作由调用点显式传 `{ controlledSeat }`，房主命令不传。 */
  readonly submit: ReadyRoomSession<StoryRelayState, StoryRelayCommand>['submit'];
  readonly isSubmitting: boolean;
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
    configureGame: () =>
      navigation.navigate('GameConfig', {
        gameType: 'storyrelay',
        mode: 'edit',
        roomCode: room.roomCode,
      }),
    shareRoom: share.open,
  });
  const capabilities: RoomCapabilities = {
    ...setupCapabilities,
    canTakeOverBots: bots.capability,
  };
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
    userId: user.id,
    effectiveSeat,
    controlledSeat,
    releaseBot: bots.release,
    isHost,
    canControlBots: bots.capability.isAllowed,
    submit,
    isSubmitting,
    openRules: () =>
      navigation.navigate('GameGuide', { gameType: 'storyrelay', roomCode: room.roomCode }),
  };
}
