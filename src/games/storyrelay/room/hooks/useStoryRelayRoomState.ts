/** Composes shared room controllers; Story Relay owns only phase and bot-control availability. */

import {
  getStoryRelayOccupiedSeatCount,
  getStoryRelayUserSeat,
  isBotSeat,
  type StoryRelayCommand,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { useCallback } from 'react';

import { useAuthContext } from '@/contexts/AuthContext';
import { createRoomSeatPressHandler } from '@/features/room/controllers/createRoomSeatPressHandler';
import { useBotTakeoverGuard } from '@/features/room/controllers/useBotTakeoverGuard';
import { useBotTakeoverLongPress } from '@/features/room/controllers/useBotTakeoverLongPress';
import {
  type RoomBotControl,
  useRoomBotControl,
} from '@/features/room/controllers/useRoomBotControl';
import { useRoomCommandSubmission } from '@/features/room/controllers/useRoomCommandSubmission';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useRoomPresentationController } from '@/features/room/controllers/useRoomPresentationController';
import { useRoomSessionSnapshot } from '@/features/room/controllers/useRoomSessionSnapshot';
import { useRoomSetupController } from '@/features/room/controllers/useRoomSetupController';
import {
  createBotTakeoverCapability,
  type RoomCapabilities,
} from '@/features/room/model/RoomCapabilities';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { resolveEffectiveSeat, type RoomViewer } from '@/features/room/model/RoomViewer';
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
  const viewer: RoomViewer = { userId: user.id, isHost, seat: mySeat };
  const isLobby = state.phase === 'lobby';
  const botControl = useRoomBotControl();
  const { controlledSeat, release: releaseBot } = botControl;
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
  const submission = useRoomCommandSubmission(getStoryRelayRoomCommandFailureMessage);
  const submit = (label: string, command: StoryRelayCommand) =>
    submission.submit(label, () => session.dispatch(command, { controlledSeat: null, label }));
  const canControlBots = isHost;
  useBotTakeoverGuard({
    controlledSeat,
    canControlBots,
    seatStillBot: controlledSeat === null || isBotSeat(state.roster, controlledSeat),
    release: releaseBot,
  });
  const capabilities: RoomCapabilities = {
    ...setupCapabilities,
    canTakeOverBots: createBotTakeoverCapability(canControlBots, botControl.takeOver),
  };
  const isSeatBot = useCallback((seat: number) => isBotSeat(state.roster, seat), [state]);
  const onBotSeatLongPress = useBotTakeoverLongPress({
    controlledSeat,
    takeOver: botControl.takeOver,
    release: releaseBot,
    canTakeOver: capabilities.canTakeOverBots.isAllowed,
    deniedReason: capabilities.canTakeOverBots.isAllowed
      ? undefined
      : (capabilities.canTakeOverBots.reason ?? undefined),
    isBotSeat: isSeatBot,
    gameName: 'StoryRelay',
  });
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
      isSubmitting: submission.isSubmitting,
      submit,
    });

  const selection = profile.selection;
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
    revision: snapshot.snapshot.revision,
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
    buildHostManagement,
    releaseBot,
  });
  return {
    state,
    shellModel,
    userId: user.id,
    effectiveSeat: resolveEffectiveSeat(viewer, controlledSeat),
    controlledSeat,
    releaseBot,
    isHost,
    canControlBots,
    openRules: () =>
      navigation.navigate('GameGuide', { gameType: 'storyrelay', roomCode: room.roomCode }),
  };
}
