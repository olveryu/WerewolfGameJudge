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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';

import { createRoomSeatPressHandler } from '@/features/room/controllers/createRoomSeatPressHandler';
import { useBotTakeover } from '@/features/room/controllers/useBotTakeover';
import {
  type ReadyRoomSession,
  useReadyRoomSession,
} from '@/features/room/controllers/useReadyRoomSession';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useRoomPresentationController } from '@/features/room/controllers/useRoomPresentationController';
import { useRoomSetupController } from '@/features/room/controllers/useRoomSetupController';
import { createControlledSeatModel } from '@/features/room/model/createControlledSeatModel';
import { createRoomProfileCardModel } from '@/features/room/model/createRoomProfileCardModel';
import { createRoomSeatConfirmationModel } from '@/features/room/model/createRoomSeatConfirmationModel';
import { HOST_FLOW_CONFIRM } from '@/features/room/model/hostManagementActions';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { RoomViewer } from '@/features/room/model/RoomViewer';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import type { RootStackParamList } from '@/navigation/types';
import { showConfirmAlert } from '@/utils/alertPresets';

import {
  createPictionaryHostManagement,
  createPictionaryRoomShellModel,
  createPictionarySeatDataSource,
  getPictionarySeatTapIntent,
  PICTIONARY_DISPLAY_NAME,
} from '../pictionaryRoomAdapter';
import { getPictionaryRoomCommandFailureMessage } from '../pictionaryRoomCommandFailureMessage';

interface UsePictionaryRoomScreenStateParams {
  readonly room: GameRoomScreenProps<'pictionary'>['room'];
  readonly entryReason: GameRoomScreenProps<'pictionary'>['entryReason'];
  readonly navigation: NativeStackNavigationProp<RootStackParamList, 'Room'>;
  readonly entryController: RoomEntryController;
  readonly session: PictionaryRoomSession;
}

/**
 * 你画我猜（接龙）房间 Screen 的显式契约：Screen 需要的状态推导全部在本 hook 内组装。
 * 阶段组件 PictionaryStage 的内部交互状态（截止 tick、任务输入、自动提交）属组件自身。
 */
export interface PictionaryRoomScreenState {
  readonly shellModel: RoomShellModel;
  readonly state: PictionaryState;
  /** 已占座位数（引擎口径）。 */
  readonly occupiedSeatCount: number;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly releaseBot: () => void;
  readonly userId: string;
  readonly isHost: boolean;
  readonly canControlBots: boolean;
  readonly openRules: () => void;
  readonly session: PictionaryRoomSession;
  /** 平台单飞漏斗：阶段组件的玩家 / 房主命令都经此发出。 */
  readonly submit: ReadyRoomSession<PictionaryState, PictionaryPublicCommand>['submit'];
  readonly isSubmitting: boolean;
}

export function usePictionaryRoomState({
  room,
  entryReason,
  navigation,
  entryController,
  session,
}: UsePictionaryRoomScreenStateParams): PictionaryRoomScreenState {
  const { user, state, revision, submit, isSubmitting } = useReadyRoomSession(
    session,
    getPictionaryRoomCommandFailureMessage,
  );
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
    navigation.navigate('GameConfig', {
      gameType: 'pictionary',
      mode: 'edit',
      roomCode: room.roomCode,
    });
  }, [navigation, room.roomCode]);
  const openRules = useCallback(() => {
    navigation.navigate('GameGuide', { gameType: 'pictionary', roomCode: room.roomCode });
  }, [navigation, room.roomCode]);
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
    onUserActionPress: () => navigation.navigate('Settings', { roomCode: room.roomCode }),
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
    }),
    share,
    buildHostManagement: () =>
      createPictionaryHostManagement({
        state,
        isCommandSubmitting: isSubmitting,
        capabilities,
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
    occupiedSeatCount: getPictionaryOccupiedSeatCount(state),
    effectiveSeat,
    controlledSeat,
    releaseBot: bots.release,
    userId: user.id,
    isHost,
    canControlBots: bots.capability.isAllowed,
    openRules,
    session,
    submit,
    isSubmitting,
  };
}
