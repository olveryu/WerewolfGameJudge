/** Compose shared room controllers with FibKing phase and role semantics. */

import {
  type FibPhase,
  type FibPreparationFailureCode,
  type FibPreparationStage,
  type FibPublicCommand,
  type FibRoundView,
  getFibBotSeats,
  getFibOccupiedSeatCount,
  getFibRoundView,
  getFibUserSeat,
  isFibBotSeat,
} from '@game-judge/game-engine/games/fibking/public';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuthContext } from '@/contexts/AuthContext';
import { useGachaStatusQuery } from '@/features/gacha/queries/useGachaQuery';
import type { RevealEffectType } from '@/features/room/components/RoleRevealEffects/types';
import { useBotTakeoverGuard } from '@/features/room/controllers/useBotTakeoverGuard';
import { useBotTakeoverLongPress } from '@/features/room/controllers/useBotTakeoverLongPress';
import { useRoomBotControl } from '@/features/room/controllers/useRoomBotControl';
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
import { resolveEquippedRevealEffect } from '@/features/room/model/resolveEquippedRevealEffect';
import type { RevealRoleData } from '@/features/room/model/RevealRoleData';
import type { RoomProfileCardModel } from '@/features/room/model/RoomProfile';
import type { RoomSeatConfirmationModel } from '@/features/room/model/RoomSeatConfirmation';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { FibRoomSession } from '@/games/fibking/model/FibRoomSession';
import type { RootStackParamList } from '@/navigation/types';
import { showConfirmAlert, showErrorAlert } from '@/utils/alertPresets';

import { getFibRevealRolePool } from '../components/FibRoleCardAdapter';
import {
  createFibBottomActions,
  createFibHostManagement,
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
  /** 身份弹窗确认（唯一出口）：viewing 未确认时提交查看记录并关闭，其余等同关闭。 */
  readonly confirmIdentity: () => void;
  /** 身份弹窗确认按钮文案（viewing 未确认时为「我已看清」）。 */
  readonly identityConfirmText: string;
  /** 是否播放揭示动画（服务端查看记录锚点：本轮未记录已查看才播）。 */
  readonly identityShouldPlay: boolean;
  /** Animator 角色池（只有种类与计数，零泄密）。 */
  readonly identityAllRoles: readonly RevealRoleData[];
  /** 是否正接管机器人座位（接管时不播查看者本人的揭示动画，D-1）。 */
  readonly isBotTakeoverActive: boolean;
  readonly openRules: () => void;
  readonly occupiedSeatCount: number;
  readonly playerCount: number;
  readonly phase: FibPhase;
  readonly preparationStage: FibPreparationStage | null;
  readonly preparationFailureCode: FibPreparationFailureCode | null;
  readonly isHost: boolean;
  /** 当前用户装备的揭示动画（已解析）；null 表示未装备、直接显示静态卡。 */
  readonly equippedRevealEffect: RevealEffectType | null;
}

export function useFibRoomScreenState({
  room,
  entryReason,
  navigation,
  entryController,
  session,
}: UseFibRoomScreenStateParams): FibRoomScreenState {
  const { handleTitlePress, handleTitleLongPress } = useRoomTitleActions();
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

  // 接管是房主权限，无阶段条件（与入口 capability 同源，见 fibRoomAdapter）。
  useBotTakeoverGuard({
    controlledSeat,
    canControlBots: isHost,
    seatStillBot: controlledSeat === null || isFibBotSeat(state, controlledSeat),
    release: releaseBot,
  });

  useEffect(() => {
    if (
      isIdentityVisible &&
      state.phase !== 'viewing' &&
      state.phase !== 'ongoing' &&
      state.phase !== 'ended'
    ) {
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

  const redrawRound = useCallback(() => {
    showConfirmAlert(
      '重新抽词？',
      '当前词语和身份将作废，并重新抽取词语、分配身份。已出现的词语不会再次抽到。',
      async () => {
        await submitCommand('重新抽词', { type: 'fib.round.start' });
      },
    );
  }, [submitCommand]);

  const abandonGame = useCallback(() => {
    showConfirmAlert('放弃游戏？', '放弃后将返回大厅；座位和已用词记录会保留。', async () => {
      await submitCommand('放弃游戏', { type: 'fib.game.returnToLobby' });
    });
  }, [submitCommand]);

  const endGame = useCallback(() => {
    showConfirmAlert('结束游戏？', '结束后返回大厅，座位和已用词记录会保留。', async () => {
      await submitCommand('结束游戏', { type: 'fib.game.returnToLobby' });
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

  const confirmIdentity = useCallback(() => {
    if (!isIdentityVisible) {
      throw new Error('[FAIL-FAST] FibKing identity modal is not open');
    }
    if (roundView?.phase === 'viewing' && !roundView.viewerHasViewed) {
      void submitCommand('确认查看身份', { type: 'fib.round.confirmRoleView' });
    }
    setIsIdentityVisible(false);
  }, [isIdentityVisible, roundView, submitCommand]);

  const identityHasViewed =
    state.round !== null &&
    effectiveSeat !== null &&
    state.round.viewedSeats.includes(effectiveSeat);
  const identityShouldPlay = roundView !== null && effectiveSeat !== null && !identityHasViewed;
  const identityAllRoles = useMemo(
    () => (state.round === null ? [] : getFibRevealRolePool(state.numberOfPlayers)),
    [state.numberOfPlayers, state.round],
  );
  const identityConfirmText =
    roundView?.phase === 'viewing' && !roundView.viewerHasViewed ? '我已看清' : '知道了';

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
            showErrorAlert('无法查看资料', capability.reason ?? '游戏进行中不能查看玩家资料');
            return;
          }
          capability.execute(roomIntent.target);
          return;
        }
      }
    },
    [capabilities, mySeat, state],
  );

  const isBotSeat = useCallback(
    (seat: number) => getFibProfileTarget(state, seat)?.occupantKind === 'bot',
    [state],
  );
  const onSeatLongPress = useBotTakeoverLongPress({
    controlledSeat,
    takeOver: takeOverBot,
    release: releaseBot,
    canTakeOver: capabilities.canTakeOverBots.isAllowed,
    deniedReason: capabilities.canTakeOverBots.isAllowed
      ? undefined
      : (capabilities.canTakeOverBots.reason ?? undefined),
    isBotSeat,
    gameName: 'FibKing',
  });

  const handleProfileKick = useCallback(() => {
    executeProfileKick(capabilities, profileSelection);
  }, [capabilities, profileSelection]);

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

  const showStartRoundDisabled = useCallback(() => {
    showErrorAlert('暂时不能开始', '请先坐满所有座位，或填充机器人。');
  }, []);

  const hostManagement = useMemo(
    () =>
      createFibHostManagement({
        state,
        isHost,
        isCommandSubmitting,
        capabilities,
        startRound,
        cancelPreparing,
        revealRound,
        redrawRound,
        abandonGame,
        endGame,
        onStartDisabled: showStartRoundDisabled,
      }),
    [
      abandonGame,
      cancelPreparing,
      capabilities,
      endGame,
      isCommandSubmitting,
      isHost,
      redrawRound,
      revealRound,
      showStartRoundDisabled,
      startRound,
      state,
    ],
  );

  const bottomActions = useMemo(
    () =>
      createFibBottomActions({
        state,
        isHost,
        viewerSeat: effectiveSeat,
        openIdentity,
      }),
    [effectiveSeat, isHost, openIdentity, state],
  );

  const controlledSeatModel = createControlledSeatModel({
    canControlBots: capabilities.canTakeOverBots.isAllowed,
    hasBots: getFibBotSeats(state).length > 0,
    controlledSeat,
    controlledBotName: controlledSeat !== null ? getBotDisplayName(controlledSeat) : null,
    release: releaseBot,
    gameName: 'FibKing',
  });

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
      hostManagement,
      controlledSeat: controlledSeatModel,
    }),
    [
      bottomActions,
      capabilities,
      controlledSeatModel,
      entryController,
      handleTitlePress,
      handleTitleLongPress,
      navigation,
      onSeatLongPress,
      onSeatPress,
      isCommandSubmitting,
      hostManagement,
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
    confirmIdentity,
    identityConfirmText,
    identityShouldPlay,
    identityAllRoles,
    isBotTakeoverActive: controlledSeat !== null,
    openRules,
    occupiedSeatCount: getFibOccupiedSeatCount(state),
    playerCount: state.numberOfPlayers,
    phase: state.phase,
    preparationStage: state.phase === 'preparing' ? state.pendingRound.stage : null,
    preparationFailureCode:
      state.phase === 'preparationFailed' ? state.preparationFailure.failureCode : null,
    isHost,
    equippedRevealEffect: resolveEquippedRevealEffect(user.equippedEffect, room.roomCode, user.id),
  };
}
