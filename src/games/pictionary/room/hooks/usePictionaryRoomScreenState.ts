/** Compose shared room controllers with Pictionary lobby and phase semantics. */

import type { PictionaryPublicCommand } from '@game-judge/game-engine/games/pictionary/public';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useAuthContext } from '@/contexts/AuthContext';
import { useGachaStatusQuery } from '@/features/gacha/queries/useGachaQuery';
import { useRoomCommandSubmission } from '@/features/room/controllers/useRoomCommandSubmission';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useRoomProfileController } from '@/features/room/controllers/useRoomProfileController';
import { useRoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import { useRoomSessionSnapshot } from '@/features/room/controllers/useRoomSessionSnapshot';
import { useRoomShareController } from '@/features/room/controllers/useRoomShareController';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type { RoomProfileCardModel } from '@/features/room/model/RoomProfile';
import type { RoomSeatConfirmationModel } from '@/features/room/model/RoomSeatConfirmation';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import { getPictionaryUserSeat } from '@/games/pictionary/model/pictionarySelectors';
import type { RootStackParamList } from '@/navigation/types';
import { showDestructiveAlert, showErrorAlert } from '@/utils/alertPresets';

import {
  createPictionaryBottomActions,
  createPictionaryLobbyHostManagement,
  createPictionaryRoomCapabilities,
  createPictionarySeatDataSource,
  createPictionaryStatusRibbon,
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
  const { data: gachaStatus } = useGachaStatusQuery();
  const ticketCount = gachaStatus ? gachaStatus.normalDraws + gachaStatus.goldenDraws : null;
  const hasAutoShownQR = useRef(false);

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
  const clearSeats = useCallback(() => {
    showDestructiveAlert('清空所有座位？', '所有玩家会离开座位。', '清空座位', async () => {
      await commandSubmission.submit('清空座位', seatCommands.clearSeats);
    });
  }, [commandSubmission, seatCommands.clearSeats]);

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
        clearSeats,
        configureGame,
        openProfile: profileController.open,
        shareRoom: share.open,
      }),
    [
      clearSeats,
      configureGame,
      isHost,
      mySeat,
      profileController.kick,
      profileController.leaveSelf,
      profileController.open,
      seatController.requestMoveSeat,
      seatController.requestTakeSeat,
      share.open,
      state,
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
    () => createPictionarySeatDataSource({ state, revision, myUserId: user.id }),
    [revision, state, user.id],
  );
  const hostManagement = useMemo(
    () =>
      createPictionaryLobbyHostManagement({
        state,
        isHost,
        isCommandSubmitting: commandSubmission.isSubmitting,
        capabilities,
        startRound,
        onStartDisabled: () => showErrorAlert('暂时不能开始', '请先坐满所有座位。'),
      }),
    [capabilities, commandSubmission.isSubmitting, isHost, startRound, state],
  );
  const shellModel = useMemo(
    (): RoomShellModel => ({
      roomCode: room.roomCode,
      capabilities,
      header: {
        onBack: () => entryController.requestExit(capabilities.shouldConfirmExit),
        onTitlePress: null,
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
        onBotSeatLongPress: null,
      },
      seatConfirmation,
      profile,
      share,
      bottomActions: createPictionaryBottomActions(state, isHost, mySeat),
      hostManagement,
      controlledSeat: null,
    }),
    [
      capabilities,
      commandSubmission.isSubmitting,
      entryController,
      hostManagement,
      isHost,
      mySeat,
      navigation,
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

  return { shellModel, state, mySeat, userId: user.id, isHost, openRules, session };
}
