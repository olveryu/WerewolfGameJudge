/** Compose shared room controllers with Pictionary lobby and phase semantics. */

import {
  createPictionaryCommand,
  getPictionaryBotDisplayName,
  isPictionaryImplicitBotSeat,
  type PictionaryPublicCommand,
} from '@game-judge/game-engine/games/pictionary/public';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef } from 'react';

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
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type { RoomProfileCardModel } from '@/features/room/model/RoomProfile';
import type { RoomSeatConfirmationModel } from '@/features/room/model/RoomSeatConfirmation';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import { getPictionaryUserSeat } from '@/games/pictionary/model/pictionarySelectors';
import type { RootStackParamList } from '@/navigation/types';
import { showConfirmAlert, showErrorAlert } from '@/utils/alertPresets';

import {
  createPictionaryBottomActions,
  createPictionaryHostManagement,
  createPictionaryRoomCapabilities,
  createPictionarySeatDataSource,
  createPictionaryStatusRibbon,
  getPictionaryProfileTarget,
  getPictionarySeatTapIntent,
  PICTIONARY_DISPLAY_NAME,
} from '../pictionaryRoomAdapter';
import { getPictionaryRoomCommandFailureMessage } from '../pictionaryRoomCommandFailureMessage';
import { usePictionarySeatCommands } from './usePictionarySeatCommands';

interface UsePictionaryRoomScreenStateParams {
  readonly room: GameRoomScreenProps<'pictionary'>['room'];
  readonly entryReason: GameRoomScreenProps<'pictionary'>['entryReason'];
  readonly navigation: NativeStackNavigationProp<RootStackParamList, 'Room'>;
  readonly entryController: RoomEntryController;
  readonly session: PictionaryRoomSession;
}

function usePictionaryProfileModel(
  capabilities: RoomCapabilities,
  profileController: ReturnType<typeof useRoomProfileController>,
): RoomProfileCardModel | null {
  const selection = profileController.selection;
  return useMemo(() => {
    if (selection === null) return null;
    return {
      target: selection.target,
      isSelf: selection.isSelf,
      onClose: profileController.close,
      onKick:
        !selection.isSelf && capabilities.canKickSeat.isAllowed
          ? () =>
              capabilities.canKickSeat.isAllowed &&
              capabilities.canKickSeat.execute(selection.target.seat)
          : null,
      onLeaveSeat:
        selection.isSelf && capabilities.canLeaveSeat.isAllowed
          ? () => capabilities.canLeaveSeat.isAllowed && capabilities.canLeaveSeat.execute()
          : null,
      gameDetails: null,
    };
  }, [capabilities.canKickSeat, capabilities.canLeaveSeat, profileController.close, selection]);
}

export function usePictionaryRoomScreenState({
  room,
  entryReason,
  navigation,
  entryController,
  session,
}: UsePictionaryRoomScreenStateParams) {
  const { handleTitlePress, handleTitleLongPress } = useRoomTitleActions();
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
  const seatCommands = usePictionarySeatCommands({ session, user });
  const { controlledSeat, takeOver: takeOverBot, release: releaseBot } = useRoomBotControl();
  const seatController = useRoomSeatController({
    currentSeat: mySeat,
    takeSeat: seatCommands.takeSeat,
  });
  const profileController = useRoomProfileController({
    myUserId: user.id,
    kickSeat: seatCommands.kickSeat,
    leaveSeat: seatCommands.leaveSeat,
  });
  const share = useRoomShareController({
    roomCode: room.roomCode,
    gameDisplayName: PICTIONARY_DISPLAY_NAME,
  });
  const openShare = share.open;
  const commandSubmission = useRoomCommandSubmission(getPictionaryRoomCommandFailureMessage);
  const { requestClearSeats, requestFillBots } = useRoomHostOperations({
    clearSeats: seatCommands.clearSeats,
    fillBots: seatCommands.fillBots,
  });
  const { data: gachaStatus } = useGachaStatusQuery();
  const ticketCount = gachaStatus ? gachaStatus.normalDraws + gachaStatus.goldenDraws : null;
  const hasAutoShownQR = useRef(false);
  const effectiveSeat = controlledSeat ?? mySeat;

  useEffect(() => {
    if (controlledSeat === null) return;
    const canKeepControl = state.phase === 'answering' || state.phase === 'settling';
    if (!canKeepControl || !isPictionaryImplicitBotSeat(state, controlledSeat)) releaseBot();
  }, [controlledSeat, releaseBot, state]);

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
    () => void submitCommand('开始游戏', { type: 'pictionary.round.start' }),
    [submitCommand],
  );
  const nextRound = useCallback(
    () =>
      void submitCommand(
        '再来一轮',
        createPictionaryCommand(state, { type: 'pictionary.round.next' }, null),
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
  const capabilities = useMemo(
    () =>
      createPictionaryRoomCapabilities({
        state,
        isHost,
        mySeat,
        requestTakeSeat: seatController.requestTakeSeat,
        requestMoveSeat: seatController.requestMoveSeat,
        leaveSeat: profileController.leaveSelf,
        kickSeat: profileController.kick,
        clearSeats: requestClearSeats,
        fillBots: requestFillBots,
        configureGame,
        openProfile: profileController.open,
        takeOverBot,
        shareRoom: share.open,
      }),
    [
      configureGame,
      isHost,
      mySeat,
      profileController.kick,
      profileController.leaveSelf,
      profileController.open,
      requestClearSeats,
      requestFillBots,
      seatController.requestMoveSeat,
      seatController.requestTakeSeat,
      share.open,
      state,
      takeOverBot,
    ],
  );
  const onSeatPress = useCallback(
    (seat: number, disabledReason?: string) => {
      const intent = getPictionarySeatTapIntent({
        state,
        seat,
        currentSeat: mySeat,
        disabledReason,
      });
      if (intent.kind === 'blocked') return showErrorAlert('不可选择', intent.reason);
      if (intent.kind === 'profile')
        return capabilities.canViewProfiles.isAllowed
          ? capabilities.canViewProfiles.execute(intent.target)
          : showErrorAlert(
              '无法查看资料',
              capabilities.canViewProfiles.reason ?? '当前阶段不可查看',
            );
      const capability =
        intent.kind === 'take' ? capabilities.canTakeSeat : capabilities.canMoveSeat;
      return capability.isAllowed
        ? capability.execute(intent.seat)
        : showErrorAlert('无法操作座位', capability.reason ?? '当前阶段不可操作');
    },
    [capabilities, mySeat, state],
  );
  const onSeatLongPress = useCallback(
    (seat: number) => {
      const target = getPictionaryProfileTarget(state, seat);
      if (target?.occupantKind !== 'bot') {
        throw new Error(`[FAIL-FAST] Pictionary bot takeover received non-bot seat ${seat}`);
      }
      if (controlledSeat === seat) {
        releaseBot();
        return;
      }
      const capability = capabilities.canTakeOverBots;
      if (!capability.isAllowed) {
        throw new Error(
          `[FAIL-FAST] Pictionary bot takeover was wired while denied: ${capability.reason}`,
        );
      }
      capability.execute(seat);
    },
    [capabilities.canTakeOverBots, controlledSeat, releaseBot, state],
  );
  const profile = usePictionaryProfileModel(capabilities, profileController);
  const seatConfirmation = useMemo(
    (): RoomSeatConfirmationModel | null =>
      seatController.pendingAction === null
        ? null
        : {
            action: seatController.pendingAction,
            isSubmitting: seatController.isSubmitting,
            onConfirm: seatController.confirm,
            onCancel: seatController.cancel,
          },
    [
      seatController.cancel,
      seatController.confirm,
      seatController.isSubmitting,
      seatController.pendingAction,
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
  const hostManagement = useMemo(
    () =>
      createPictionaryHostManagement({
        state,
        isHost,
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
          showConfirmAlert('中止本局？', '保留已提交作品供回看；本局不结算完成奖励。', async () => {
            await submitCommand(
              '中止本局',
              createPictionaryCommand(state, { type: 'pictionary.round.abort' }, null),
            );
          }),
        onStartDisabled: () => showErrorAlert('暂时不能开始', '请先坐满所有座位，或填充机器人。'),
      }),
    [
      capabilities,
      commandSubmission.isSubmitting,
      isHost,
      nextRound,
      returnToLobby,
      startRound,
      state,
      submitCommand,
    ],
  );
  const controlledSeatModel = useMemo<RoomShellModel['controlledSeat']>(() => {
    if (controlledSeat !== null) {
      return {
        kind: 'controlled',
        seat: controlledSeat,
        displayName: getPictionaryBotDisplayName(controlledSeat),
        onRelease: releaseBot,
      };
    }
    const hasControllableBots =
      capabilities.canTakeOverBots.isAllowed &&
      Array.from({ length: state.config.numberOfPlayers }, (_, seat) => seat).some((seat) =>
        isPictionaryImplicitBotSeat(state, seat),
      );
    return hasControllableBots ? { kind: 'hint', showBulkViewHint: false } : null;
  }, [capabilities.canTakeOverBots, controlledSeat, releaseBot, state]);
  const shellModel = useMemo(
    (): RoomShellModel => ({
      roomCode: room.roomCode,
      capabilities,
      header: {
        onBack: () => entryController.requestExit(capabilities.shouldConfirmExit),
        onTitlePress: handleTitlePress,
        onTitleLongPress: handleTitleLongPress,
        userAction: {
          user,
          ticketCount,
          onPress: () => navigation.navigate('Settings', { roomCode: room.roomCode }),
        },
      },
      connection: entryController.connection,
      statusRibbon: createPictionaryStatusRibbon(state),
      seats: {
        source: seatSource,
        visuallyDisabled: commandSubmission.isSubmitting || seatController.isSubmitting,
        onSeatPress,
        onBotSeatLongPress: capabilities.canTakeOverBots.isAllowed ? onSeatLongPress : null,
      },
      seatConfirmation,
      profile,
      share,
      bottomActions: createPictionaryBottomActions(state, isHost, effectiveSeat),
      hostManagement,
      controlledSeat: controlledSeatModel,
    }),
    [
      capabilities,
      commandSubmission.isSubmitting,
      controlledSeatModel,
      effectiveSeat,
      entryController,
      handleTitlePress,
      handleTitleLongPress,
      hostManagement,
      isHost,
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
      ticketCount,
      user,
    ],
  );

  useEffect(() => {
    if (isHost && entryReason === 'created' && !hasAutoShownQR.current) {
      hasAutoShownQR.current = true;
      openShare();
    }
  }, [entryReason, isHost, openShare]);

  return {
    shellModel,
    state,
    effectiveSeat,
    controlledSeat,
    userId: user.id,
    isHost,
    openRules,
    session,
  };
}
