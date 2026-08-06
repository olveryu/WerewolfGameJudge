/** Compose shared room controllers with FibKing phase and role semantics. */

import {
  type FibPhase,
  type FibPreparationFailureCode,
  type FibPreparationStage,
  type FibPublicCommand,
  type FibRoundView,
  getFibBotDisplayName,
  getFibOccupiedSeatCount,
  getFibRoundView,
  getFibUserSeat,
  isFibImplicitBotSeat,
} from '@game-judge/game-engine/games/fibking/public';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import type { RoomProfileCardModel } from '@/features/room/model/RoomProfile';
import type { RoomSeatConfirmationModel } from '@/features/room/model/RoomSeatConfirmation';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { FibRoomSession } from '@/games/fibking/model/FibRoomSession';
import type { RootStackParamList } from '@/navigation/types';
import { showConfirmAlert, showErrorAlert } from '@/utils/alertPresets';

import {
  createFibBottomActions,
  createFibRoomCapabilities,
  createFibSeatDataSource,
  createFibStatusRibbon,
  FIB_DISPLAY_NAME,
  getFibProfileTarget,
  getFibSeatTapIntent,
} from '../fibRoomAdapter';
import { getFibRoomCommandFailureMessage } from '../fibRoomCommandFailureMessage';
import { useFibSeatCommands } from './useFibSeatCommands';

interface UseFibRoomScreenStateParams {
  readonly room: GameRoomScreenProps<'fibking'>['room'];
  readonly entryReason: GameRoomScreenProps<'fibking'>['entryReason'];
  readonly navigation: NativeStackNavigationProp<RootStackParamList, 'Room'>;
  readonly entryController: RoomEntryController;
  readonly session: FibRoomSession;
}

export interface FibRoomScreenState {
  readonly shellModel: RoomShellModel;
  readonly roundView: FibRoundView | null;
  readonly isIdentityVisible: boolean;
  readonly closeIdentity: () => void;
  readonly openRules: () => void;
  readonly occupiedSeatCount: number;
  readonly playerCount: number;
  readonly phase: FibPhase;
  readonly preparationStage: FibPreparationStage | null;
  readonly preparationFailureCode: FibPreparationFailureCode | null;
  readonly isHost: boolean;
}

export function useFibRoomScreenState({
  room,
  entryReason,
  navigation,
  entryController,
  session,
}: UseFibRoomScreenStateParams): FibRoomScreenState {
  const { user } = useAuthContext();
  if (user === null) {
    throw new Error('[FAIL-FAST] Ready FibKing room requires an authenticated user');
  }

  const sessionSnapshot = useRoomSessionSnapshot(session);
  if (sessionSnapshot.phase !== 'ready') {
    throw new Error('[FAIL-FAST] FibKing room content requires a ready room session');
  }
  const state = sessionSnapshot.snapshot.state;
  const revision = sessionSnapshot.snapshot.revision;
  const isHost = state.hostUserId === user.id;
  const mySeat = getFibUserSeat(state, user.id);
  const seatCommands = useFibSeatCommands({ session, user });
  const seatController = useRoomSeatController({
    currentSeat: mySeat,
    takeSeat: seatCommands.takeSeat,
  });
  const {
    selection: profileSelection,
    open: openProfile,
    close: closeProfile,
    kick: kickProfile,
    leaveSelf,
  } = useRoomProfileController({
    myUserId: user.id,
    kickSeat: seatCommands.kickSeat,
    leaveSeat: seatCommands.leaveSeat,
  });
  const { controlledSeat, takeOver: takeOverBot, release: releaseBot } = useRoomBotControl();
  const share = useRoomShareController({
    roomCode: room.roomCode,
    gameDisplayName: FIB_DISPLAY_NAME,
  });
  const openShare = share.open;
  const { isSubmitting: isCommandSubmitting, submit: submitRoomCommand } = useRoomCommandSubmission(
    getFibRoomCommandFailureMessage,
  );
  const { requestClearSeats, requestFillBots } = useRoomHostOperations({
    clearSeats: seatCommands.clearSeats,
    fillBots: seatCommands.fillBots,
  });
  const { data: gachaStatus } = useGachaStatusQuery();
  const ticketCount = gachaStatus ? gachaStatus.normalDraws + gachaStatus.goldenDraws : null;
  const hasAutoShownQR = useRef(false);
  const [isIdentityVisible, setIsIdentityVisible] = useState(false);

  const effectiveSeat = controlledSeat ?? mySeat;
  const roundView = useMemo(() => getFibRoundView(state, effectiveSeat), [effectiveSeat, state]);

  useEffect(() => {
    if (controlledSeat === null) return;
    if (state.phase !== 'ongoing' || !isFibImplicitBotSeat(state, controlledSeat)) {
      releaseBot();
    }
  }, [controlledSeat, releaseBot, state]);

  useEffect(() => {
    if (isIdentityVisible && state.phase !== 'ongoing' && state.phase !== 'ended') {
      setIsIdentityVisible(false);
    }
  }, [isIdentityVisible, state.phase]);

  const configureGame = useCallback(() => {
    navigation.navigate('GameConfig', {
      gameType: 'fibking',
      mode: 'edit',
      roomCode: room.roomCode,
    });
  }, [navigation, room.roomCode]);

  const openRules = useCallback(() => {
    navigation.navigate('GameGuide', { gameType: 'fibking', roomCode: room.roomCode });
  }, [navigation, room.roomCode]);

  const submitCommand = useCallback(
    (label: string, command: FibPublicCommand): Promise<boolean> =>
      submitRoomCommand(label, () => session.dispatch(command, { controlledSeat: null, label })),
    [session, submitRoomCommand],
  );

  const startRound = useCallback(() => {
    const label =
      state.phase === 'ended'
        ? '开始下一轮'
        : state.phase === 'preparationFailed'
          ? '重新准备'
          : '开始本轮';
    void submitCommand(label, {
      type: 'fib.round.start',
    });
  }, [state.phase, submitCommand]);

  const cancelPreparing = useCallback(() => {
    const isReturningToLobby = state.phase === 'preparationFailed';
    showConfirmAlert(
      isReturningToLobby ? '返回大厅？' : '取消准备？',
      isReturningToLobby
        ? '返回大厅后可以调整座位和房间设置。'
        : '本次词语准备会终止，座位和历史词语会保留。',
      async () => {
        await submitCommand(isReturningToLobby ? '返回大厅' : '取消准备', {
          type: 'fib.round.cancelPreparing',
        });
      },
    );
  }, [state.phase, submitCommand]);

  const revealRound = useCallback(() => {
    showConfirmAlert('公布答案？', '公布后本轮结束，所有玩家都能看到真实释义和身份。', async () => {
      await submitCommand('公布答案', { type: 'fib.round.reveal' });
    });
  }, [submitCommand]);

  const openIdentity = useCallback(() => {
    if (getFibRoundView(state, effectiveSeat) === null) {
      throw new Error('[FAIL-FAST] FibKing identity requires an active or ended round view');
    }
    if (isIdentityVisible) {
      throw new Error('[FAIL-FAST] FibKing identity modal is already open');
    }
    setIsIdentityVisible(true);
  }, [effectiveSeat, isIdentityVisible, state]);

  const closeIdentity = useCallback(() => {
    if (!isIdentityVisible) {
      throw new Error('[FAIL-FAST] FibKing identity modal is not open');
    }
    setIsIdentityVisible(false);
  }, [isIdentityVisible]);

  const capabilities = useMemo(
    () =>
      createFibRoomCapabilities({
        state,
        isHost,
        mySeat,
        requestTakeSeat: seatController.requestTakeSeat,
        requestMoveSeat: seatController.requestMoveSeat,
        leaveSeat: leaveSelf,
        kickSeat: kickProfile,
        clearSeats: requestClearSeats,
        fillBots: requestFillBots,
        configureGame,
        openProfile,
        takeOverBot,
        shareRoom: openShare,
      }),
    [
      configureGame,
      isHost,
      mySeat,
      kickProfile,
      openProfile,
      openShare,
      requestClearSeats,
      requestFillBots,
      leaveSelf,
      seatController.requestMoveSeat,
      seatController.requestTakeSeat,
      state,
      takeOverBot,
    ],
  );

  const seatSource = useMemo(
    () =>
      createFibSeatDataSource({
        state,
        revision,
        myUserId: user.id,
        controlledSeat,
      }),
    [controlledSeat, revision, state, user.id],
  );

  const onSeatPress = useCallback(
    (seat: number, disabledReason?: string) => {
      const roomIntent = getFibSeatTapIntent({
        state,
        seat,
        currentSeat: mySeat,
        disabledReason,
      });
      switch (roomIntent.kind) {
        case 'blocked':
          showErrorAlert('不可选择', roomIntent.reason);
          return;
        case 'take':
        case 'move': {
          const capability =
            roomIntent.kind === 'take' ? capabilities.canTakeSeat : capabilities.canMoveSeat;
          if (!capability.isAllowed) {
            showErrorAlert('无法操作座位', capability.reason ?? '当前阶段不可操作');
            return;
          }
          capability.execute(roomIntent.seat);
          return;
        }
        case 'profile': {
          const capability = capabilities.canViewProfiles;
          if (!capability.isAllowed) {
            showErrorAlert('无法查看资料', capability.reason ?? '当前阶段不可查看');
            return;
          }
          capability.execute(roomIntent.target);
          return;
        }
      }
    },
    [capabilities, mySeat, state],
  );

  const onSeatLongPress = useCallback(
    (seat: number) => {
      const target = getFibProfileTarget(state, seat);
      if (target?.occupantKind !== 'bot') {
        throw new Error(`[FAIL-FAST] FibKing bot takeover received non-bot seat ${seat}`);
      }
      if (controlledSeat === seat) {
        releaseBot();
        return;
      }
      const capability = capabilities.canTakeOverBots;
      if (!capability.isAllowed) {
        throw new Error(
          `[FAIL-FAST] FibKing bot takeover was wired while denied: ${capability.reason}`,
        );
      }
      capability.execute(seat);
    },
    [capabilities.canTakeOverBots, controlledSeat, releaseBot, state],
  );

  const handleProfileKick = useCallback(() => {
    const selection = profileSelection;
    if (selection === null) throw new Error('[FAIL-FAST] Cannot kick without an open profile');
    const capability = capabilities.canKickSeat;
    if (!capability.isAllowed) {
      throw new Error(`[FAIL-FAST] FibKing profile kick is denied: ${capability.reason}`);
    }
    capability.execute(selection.target.seat);
  }, [capabilities.canKickSeat, profileSelection]);

  const handleProfileLeave = useCallback(() => {
    const capability = capabilities.canLeaveSeat;
    if (!capability.isAllowed) {
      throw new Error(`[FAIL-FAST] FibKing profile leave is denied: ${capability.reason}`);
    }
    capability.execute();
  }, [capabilities.canLeaveSeat]);

  const profile = useMemo((): RoomProfileCardModel | null => {
    const selection = profileSelection;
    if (selection === null) return null;
    return {
      target: selection.target,
      isSelf: selection.isSelf,
      onClose: closeProfile,
      onKick: !selection.isSelf && capabilities.canKickSeat.isAllowed ? handleProfileKick : null,
      onLeaveSeat:
        selection.isSelf && capabilities.canLeaveSeat.isAllowed ? handleProfileLeave : null,
      gameDetails: null,
    };
  }, [
    capabilities.canKickSeat.isAllowed,
    capabilities.canLeaveSeat.isAllowed,
    handleProfileKick,
    handleProfileLeave,
    closeProfile,
    profileSelection,
  ]);

  const seatConfirmation = useMemo((): RoomSeatConfirmationModel | null => {
    if (seatController.pendingAction === null) return null;
    return {
      action: seatController.pendingAction,
      isSubmitting: seatController.isSubmitting,
      onConfirm: seatController.confirm,
      onCancel: seatController.cancel,
    };
  }, [
    seatController.cancel,
    seatController.confirm,
    seatController.isSubmitting,
    seatController.pendingAction,
  ]);

  const bottomActions = useMemo(
    () =>
      createFibBottomActions({
        state,
        isHost,
        hasPerspective: roundView !== null,
        startRound,
        cancelPreparing,
        revealRound,
        openIdentity,
        configureGame,
        onStartDisabled: () => showErrorAlert('暂时不能开始', '请先坐满所有座位。'),
      }),
    [
      cancelPreparing,
      configureGame,
      isHost,
      openIdentity,
      revealRound,
      roundView,
      startRound,
      state,
    ],
  );

  const controlledSeatModel = useMemo<RoomShellModel['controlledSeat']>(() => {
    if (controlledSeat !== null) {
      return {
        kind: 'controlled',
        seat: controlledSeat,
        displayName: getFibBotDisplayName(controlledSeat),
        onRelease: releaseBot,
      };
    }
    const hasControllableBots =
      capabilities.canTakeOverBots.isAllowed &&
      state.fillEmptySeatsWithBots &&
      Object.keys(state.realSeats).length < state.numberOfPlayers;
    return hasControllableBots ? { kind: 'hint', showBulkViewHint: false } : null;
  }, [capabilities.canTakeOverBots, controlledSeat, releaseBot, state]);

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
        menuItems: [],
      },
      connection: entryController.connection,
      statusRibbon: createFibStatusRibbon(state),
      seats: {
        source: seatSource,
        visuallyDisabled: isCommandSubmitting || seatController.isSubmitting,
        onSeatPress,
        onBotSeatLongPress: capabilities.canTakeOverBots.isAllowed ? onSeatLongPress : null,
      },
      seatConfirmation,
      profile,
      share,
      bottomActions,
      controlledSeat: controlledSeatModel,
    }),
    [
      bottomActions,
      capabilities,
      controlledSeatModel,
      entryController,
      navigation,
      onSeatLongPress,
      onSeatPress,
      isCommandSubmitting,
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
    roundView,
    isIdentityVisible,
    closeIdentity,
    openRules,
    occupiedSeatCount: getFibOccupiedSeatCount(state),
    playerCount: state.numberOfPlayers,
    phase: state.phase,
    preparationStage: state.phase === 'preparing' ? state.pendingRound.stage : null,
    preparationFailureCode:
      state.phase === 'preparationFailed' ? state.preparationFailure.failureCode : null,
    isHost,
  };
}
