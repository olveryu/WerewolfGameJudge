/** Compose shared room controllers with Pictionary lobby and phase semantics. */

import {
  createPictionaryCommand,
  getPictionaryOccupiedSeatCount,
  getPictionaryUserSeat,
  isBotSeat,
  type PictionaryPublicCommand,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';

import { useAuthContext } from '@/contexts/AuthContext';
import { useBotTakeoverGuard } from '@/features/room/controllers/useBotTakeoverGuard';
import { useBotTakeoverLongPress } from '@/features/room/controllers/useBotTakeoverLongPress';
import {
  type RoomBotControl,
  useRoomBotControl,
} from '@/features/room/controllers/useRoomBotControl';
import { useRoomCommandSubmission } from '@/features/room/controllers/useRoomCommandSubmission';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useRoomPresentationController } from '@/features/room/controllers/useRoomPresentationController';
import type { RoomProfileController } from '@/features/room/controllers/useRoomProfileController';
import { useRoomRosterController } from '@/features/room/controllers/useRoomRosterController';
import { useRoomSessionSnapshot } from '@/features/room/controllers/useRoomSessionSnapshot';
import { createControlledSeatModel } from '@/features/room/model/createControlledSeatModel';
import { createRoomProfileCardModel } from '@/features/room/model/createRoomProfileCardModel';
import { createRoomSeatConfirmationModel } from '@/features/room/model/createRoomSeatConfirmationModel';
import { HOST_FLOW_CONFIRM } from '@/features/room/model/hostManagementActions';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type { RoomProfileCardModel } from '@/features/room/model/RoomProfile';
import { ROOM_SEAT_TAP_BLOCKED_TITLE } from '@/features/room/model/RoomSeatTap';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { resolveEffectiveSeat, type RoomViewer } from '@/features/room/model/RoomViewer';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import type { RootStackParamList } from '@/navigation/types';
import { showConfirmAlert, showErrorAlert } from '@/utils/alertPresets';

import {
  createPictionaryHostManagement,
  createPictionaryRoomCapabilities,
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

function usePictionaryProfileModel(
  capabilities: RoomCapabilities,
  profileController: RoomProfileController,
): RoomProfileCardModel | null {
  const selection = profileController.selection;
  return useMemo(
    () =>
      createRoomProfileCardModel({
        selection,
        capabilities,
        onClose: profileController.close,
        onLeaveSeat: () => {
          if (capabilities.canLeaveSeat.isAllowed) capabilities.canLeaveSeat.execute();
        },
      }),
    [capabilities, profileController.close, selection],
  );
}

/**
 * 你画我猜（接龙）房间 Screen 的显式契约（P-2b，对齐狼人杀 WerewolfRoomScreenState
 * 形态）：Screen 需要的状态推导全部在本 hook 内组装，Screen 只消费本接口渲染。
 * 阶段组件 PictionaryStage 的内部交互状态（截止 tick、任务输入）属组件自身，不在此列。
 */
export interface PictionaryRoomScreenState {
  readonly shellModel: RoomShellModel;
  readonly state: PictionaryState;
  /** 已占座位数（引擎口径）；原在 Screen 内调用引擎计数，P-2b 下沉。 */
  readonly occupiedSeatCount: number;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly releaseBot: RoomBotControl['release'];
  readonly userId: string;
  readonly isHost: boolean;
  readonly canControlBots: boolean;
  readonly openRules: () => void;
  readonly session: PictionaryRoomSession;
}

export function usePictionaryRoomScreenState({
  room,
  entryReason,
  navigation,
  entryController,
  session,
}: UsePictionaryRoomScreenStateParams): PictionaryRoomScreenState {
  const { user } = useAuthContext();
  if (user === null) throw new Error('[FAIL-FAST] Ready Pictionary room requires a user');
  const snapshot = useRoomSessionSnapshot(session);
  if (snapshot.phase !== 'ready') {
    throw new Error('[FAIL-FAST] Pictionary room content requires a ready session');
  }
  const state = snapshot.snapshot.state;
  const revision = snapshot.snapshot.revision;
  const isHost = state.hostUserId === user.id;
  const mySeat = getPictionaryUserSeat(state, user.id);
  const viewer = useMemo(
    (): RoomViewer => ({ userId: user.id, isHost, seat: mySeat }),
    [isHost, mySeat, user.id],
  );
  const { controlledSeat, takeOver: takeOverBot, release: releaseBot } = useRoomBotControl();
  const {
    seatController,
    profile: profileController,
    actions,
  } = useRoomRosterController({
    session,
    user,
    mySeat,
  });
  const {
    share,
    titleActions: { handleTitlePress, handleTitleLongPress },
    gachaStatus,
  } = useRoomPresentationController({
    roomCode: room.roomCode,
    gameDisplayName: PICTIONARY_DISPLAY_NAME,
    isHost,
    entryReason,
  });
  const commandSubmission = useRoomCommandSubmission(getPictionaryRoomCommandFailureMessage);
  const effectiveSeat = resolveEffectiveSeat(viewer, controlledSeat);

  // 接管是房主权限，无阶段条件（与入口 capability 同源，见 pictionaryRoomAdapter）。
  useBotTakeoverGuard({
    controlledSeat,
    canControlBots: isHost,
    seatStillBot: controlledSeat === null || isBotSeat(state.roster, controlledSeat),
    release: releaseBot,
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
  const submitCommand = useCallback(
    (label: string, command: PictionaryPublicCommand) =>
      commandSubmission.submit(label, () =>
        session.dispatch(command, { controlledSeat: null, label }),
      ),
    [commandSubmission, session],
  );
  const startRound = useCallback(
    () => void submitCommand('开始游戏', { type: 'pictionary.game.begin' }),
    [submitCommand],
  );
  const nextRound = useCallback(
    () =>
      void submitCommand(
        '再来一局',
        createPictionaryCommand(state, { type: 'pictionary.game.next' }, null),
      ),
    [state, submitCommand],
  );
  const returnToLobby = useCallback(
    () =>
      void submitCommand(
        '返回大厅',
        createPictionaryCommand(state, { type: 'pictionary.game.returnToLobby' }, null),
      ),
    [state, submitCommand],
  );
  const capabilities = createPictionaryRoomCapabilities({
    ...actions,
    state,
    isHost,
    mySeat,
    configureGame,
    takeOverBot,
    shareRoom: share.open,
  });
  const onSeatPress = useCallback(
    (seat: number, disabledReason?: string) => {
      const intent = getPictionarySeatTapIntent({
        state,
        seat,
        currentSeat: mySeat,
        disabledReason,
      });
      if (intent.kind === 'blocked')
        return showErrorAlert(ROOM_SEAT_TAP_BLOCKED_TITLE, intent.reason);
      if (intent.kind === 'profile')
        return capabilities.canViewProfiles.isAllowed
          ? capabilities.canViewProfiles.execute(intent.target)
          : showErrorAlert(
              '无法查看资料',
              capabilities.canViewProfiles.reason ?? '游戏进行中不能查看玩家资料',
            );
      const capability =
        intent.kind === 'take' ? capabilities.canTakeSeat : capabilities.canMoveSeat;
      return capability.isAllowed
        ? capability.execute(intent.seat)
        : showErrorAlert('无法操作座位', capability.reason ?? '当前阶段不可操作');
    },
    [capabilities, mySeat, state],
  );
  const onSeatLongPress = useBotTakeoverLongPress({
    controlledSeat,
    takeOver: takeOverBot,
    release: releaseBot,
    canTakeOver: capabilities.canTakeOverBots.isAllowed,
    deniedReason: capabilities.canTakeOverBots.isAllowed
      ? undefined
      : (capabilities.canTakeOverBots.reason ?? undefined),
    isBotSeat: useCallback((seat: number) => isBotSeat(state.roster, seat), [state]),
    gameName: 'Pictionary',
  });
  const profile = usePictionaryProfileModel(capabilities, profileController);
  const seatConfirmation = useMemo(
    () =>
      createRoomSeatConfirmationModel({
        pendingAction: seatController.pendingAction,
        isSubmitting: seatController.isSubmitting,
        confirm: seatController.confirm,
        cancel: seatController.cancel,
      }),
    [
      seatController.pendingAction,
      seatController.isSubmitting,
      seatController.confirm,
      seatController.cancel,
    ],
  );
  const seatSource = useMemo(
    () =>
      createPictionarySeatDataSource({
        state,
        revision,
        myUserId: user.id,
        controlledSeat,
      }),
    [controlledSeat, revision, state, user.id],
  );
  const buildHostManagement = useCallback(
    () =>
      createPictionaryHostManagement({
        state,
        isCommandSubmitting: commandSubmission.isSubmitting,
        capabilities,
        startRound,
        nextRound,
        returnToLobby,
        finishPhase: () =>
          showConfirmAlert(
            '结束编辑并收稿？',
            '将自动收取当前文字和画作，没有内容时自动交空白。全部送达后进入下一棒。',
            async () => {
              await submitCommand(
                '结束本棒',
                createPictionaryCommand(state, { type: 'pictionary.phase.finish' }, null),
              );
            },
            { confirmText: '结束本棒' },
          ),
        abortRound: () =>
          showConfirmAlert(
            HOST_FLOW_CONFIRM.abortTitle,
            '保留已提交作品供回看；本局不结算完成奖励。',
            async () => {
              await submitCommand(
                '中止本局',
                createPictionaryCommand(state, { type: 'pictionary.game.abort' }, null),
              );
            },
          ),
      }),
    [
      capabilities,
      commandSubmission.isSubmitting,
      nextRound,
      returnToLobby,
      startRound,
      state,
      submitCommand,
    ],
  );
  const controlledSeatModel = createControlledSeatModel({
    controlledSeat,
    controlledBotName:
      controlledSeat !== null
        ? (seatSource.getSeat(controlledSeat).player?.displayName ?? null)
        : null,
    release: releaseBot,
    gameName: 'Pictionary',
  });
  const shellModel = useMemo(
    (): RoomShellModel =>
      createPictionaryRoomShellModel({
        roomCode: room.roomCode,
        viewer,
        capabilities,
        onBack: () => entryController.requestExit(capabilities.shouldConfirmExit),
        onTitlePress: handleTitlePress,
        onTitleLongPress: handleTitleLongPress,
        user,
        gachaStatus,
        onUserActionPress: () => navigation.navigate('Settings', { roomCode: room.roomCode }),
        connection: entryController.connection,
        state,
        seatSource,
        seatsVisuallyDisabled: commandSubmission.isSubmitting || seatController.isSubmitting,
        onSeatPress,
        onBotSeatLongPress: capabilities.canTakeOverBots.isAllowed ? onSeatLongPress : null,
        seatConfirmation,
        profile,
        share,
        buildHostManagement,
        controlledSeat: controlledSeatModel,
      }),
    [
      buildHostManagement,
      capabilities,
      commandSubmission.isSubmitting,
      controlledSeatModel,
      entryController,
      gachaStatus,
      handleTitlePress,
      handleTitleLongPress,
      navigation,
      onSeatLongPress,
      onSeatPress,
      profile,
      room.roomCode,
      seatConfirmation,
      seatController.isSubmitting,
      seatSource,
      share,
      state,
      user,
      viewer,
    ],
  );

  return {
    shellModel,
    state,
    occupiedSeatCount: getPictionaryOccupiedSeatCount(state),
    effectiveSeat,
    controlledSeat,
    releaseBot,
    userId: user.id,
    isHost,
    canControlBots: capabilities.canTakeOverBots.isAllowed,
    openRules,
    session,
  };
}
