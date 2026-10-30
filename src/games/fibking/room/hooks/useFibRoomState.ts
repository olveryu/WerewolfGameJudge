/** Compose shared room controllers with FibKing phase and role semantics. */

import {
  type FibPhase,
  type FibPreparationFailureCode,
  type FibPreparationStage,
  type FibRoundView,
  getFibOccupiedSeatCount,
  getFibRoundView,
  getFibUserSeat,
  isBotSeat,
} from '@game-judge/game-engine/games/fibking/public';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';

import type { RevealEffectType } from '@/features/room/components/RoleRevealEffects/types';
import { createRoomSeatPressHandler } from '@/features/room/controllers/createRoomSeatPressHandler';
import { useBotTakeover } from '@/features/room/controllers/useBotTakeover';
import { useReadyRoomSession } from '@/features/room/controllers/useReadyRoomSession';
import { type RoleViewing, useRoleViewing } from '@/features/room/controllers/useRoleViewing';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useRoomPresentationController } from '@/features/room/controllers/useRoomPresentationController';
import { useRoomRosterController } from '@/features/room/controllers/useRoomRosterController';
import { useSeatPicking } from '@/features/room/hooks/useSeatPicking';
import { createControlledSeatModel } from '@/features/room/model/createControlledSeatModel';
import { createRoomProfileCardModel } from '@/features/room/model/createRoomProfileCardModel';
import { createRoomSeatConfirmationModel } from '@/features/room/model/createRoomSeatConfirmationModel';
import { HOST_FLOW_CONFIRM } from '@/features/room/model/hostManagementActions';
import { resolveEquippedRevealEffect } from '@/features/room/model/resolveEquippedRevealEffect';
import type { RevealRoleData } from '@/features/room/model/RevealRoleData';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { RoomViewer } from '@/features/room/model/RoomViewer';
import type { FibRoomSession } from '@/games/fibking/model/FibRoomSession';
import type { RootStackParamList } from '@/navigation/types';
import { showConfirmAlert } from '@/utils/alertPresets';

import { getFibRevealRolePool } from '../components/FibRoleCardAdapter';
import {
  createFibBottomActions,
  createFibHostManagement,
  createFibRoomCapabilities,
  createFibRoomShellModel,
  createFibSeatDataSource,
  FIB_DISPLAY_NAME,
  getFibProfileTarget,
  getFibSeatTapIntent,
} from '../fibRoomAdapter';
import { getFibRoomCommandFailureMessage } from '../fibRoomCommandFailureMessage';

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
  /**
   * 在座玩家的身份卡：先落查看记录、服务端确认后再弹卡（平台 useRoleViewing）。
   * 旁观者看的是公开题目 / 结果，不走查看记录，见 isPublicViewOpen。
   */
  readonly roleViewing: RoleViewing;
  readonly isPublicViewOpen: boolean;
  readonly closePublicView: () => void;
  /** Animator 角色池（只有种类与计数，零泄密）。 */
  readonly identityAllRoles: readonly RevealRoleData[];
  /** 是否正接管机器人座位（接管时不播查看者本人的揭示动画，D-1）。 */
  readonly isBotTakeoverActive: boolean;
  readonly openRules: () => void;
  readonly playerCount: number;
  readonly phase: FibPhase;
  readonly preparationStage: FibPreparationStage | null;
  readonly preparationFailureCode: FibPreparationFailureCode | null;
  readonly isHost: boolean;
  /** 当前用户装备的揭示动画（已解析）；null 表示未装备、直接显示静态卡。 */
  readonly equippedRevealEffect: RevealEffectType | null;
}

export function useFibRoomState({
  room,
  entryReason,
  navigation,
  entryController,
  session,
}: UseFibRoomScreenStateParams): FibRoomScreenState {
  const { user, state, revision, submit, isSubmitting } = useReadyRoomSession(
    session,
    getFibRoomCommandFailureMessage,
  );
  const isHost = state.hostUserId === user.id;
  const mySeat = getFibUserSeat(state, user.id);
  const viewer = useMemo(
    (): RoomViewer => ({ userId: user.id, isHost, seat: mySeat }),
    [isHost, mySeat, user.id],
  );
  const isLobby = state.phase === 'lobby';
  const bots = useBotTakeover({
    viewer,
    isBotSeat: (seat) => isBotSeat(state.roster, seat),
    gameName: 'FibKing',
  });
  const { controlledSeat, effectiveSeat } = bots;
  // 资料卡全程可开（对齐狼人杀），故用 roster 控制器 + 本家能力表。
  const { seatController, profile, actions } = useRoomRosterController({ session, user, mySeat });
  const { share, titleActions, gachaStatus } = useRoomPresentationController({
    roomCode: room.roomCode,
    gameDisplayName: FIB_DISPLAY_NAME,
    isHost,
    entryReason,
  });
  const roundView = useMemo(() => getFibRoundView(state, effectiveSeat), [effectiveSeat, state]);

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

  // ── 身份查看协议 ──
  // 在座玩家：查看阶段首看先发 role.viewed，确认后弹卡；其余阶段直接弹。
  const roleViewing = useRoleViewing({
    effectiveSeat,
    identityKey: state.round === null ? null : state.round.roundId,
    hasViewed:
      state.phase !== 'viewing' ||
      (effectiveSeat !== null && state.round.viewedSeats.includes(effectiveSeat)),
    occupiedSeatCount: getFibOccupiedSeatCount(state),
    viewedSeatCount: state.round === null ? 0 : state.round.viewedSeats.length,
    submitViewed: () => submit('确认查看身份', { type: 'fibking.role.viewed' }, { controlledSeat }),
  });
  // 旁观者：题目 / 公开结果是公开信息，没有查看记录也没有揭示动画。
  const [isPublicViewOpen, setIsPublicViewOpen] = useState(false);
  const openIdentity = useCallback(() => {
    if (effectiveSeat === null) {
      if (roundView === null) {
        throw new Error('[FAIL-FAST] FibKing public view requires an active or ended round');
      }
      setIsPublicViewOpen(true);
      return;
    }
    roleViewing.open();
  }, [effectiveSeat, roleViewing, roundView]);
  const identityAllRoles = useMemo(
    () => (state.round === null ? [] : getFibRevealRolePool(state.numberOfPlayers)),
    [state.numberOfPlayers, state.round],
  );

  // ── 房主流程 ──
  const startRound = () => {
    const label =
      state.phase === 'ended'
        ? '再来一局'
        : state.phase === 'preparationFailed'
          ? '重新准备'
          : '分配角色';
    void submit(label, { type: 'fibking.roles.assign' });
  };
  const cancelPreparing = () => {
    const isReturningToLobby = state.phase === 'preparationFailed';
    showConfirmAlert(
      isReturningToLobby ? HOST_FLOW_CONFIRM.returnLobbyTitle : '取消准备？',
      isReturningToLobby
        ? '返回大厅后可以调整座位和房间设置。'
        : '本次词语准备会终止，座位和历史词语会保留。',
      async () => {
        await submit(isReturningToLobby ? '返回大厅' : '取消准备', {
          type: 'fibking.round.cancelPreparing',
        });
      },
    );
  };
  const beginRound = () => {
    void submit('开始游戏', { type: 'fibking.game.begin' });
  };
  const markAllBotsViewed = () => {
    void submit('标记机器人已查看', { type: 'fibking.bots.markAllBotsViewed' });
  };
  const revealRound = () => {
    showConfirmAlert('公布答案？', '公布后本轮结束，所有玩家都能看到真实释义和身份。', async () => {
      await submit('公布答案', { type: 'fibking.round.reveal' });
    });
  };
  const redrawRound = () => {
    showConfirmAlert(
      '重新抽词？',
      '当前词语和身份将作废，并重新抽取词语、分配身份。已出现的词语不会再次抽到。',
      async () => {
        await submit('重新抽词', { type: 'fibking.roles.assign' });
      },
    );
  };
  const abandonGame = () => {
    showConfirmAlert(
      HOST_FLOW_CONFIRM.abortTitle,
      '中止后将返回大厅；座位和已用词记录会保留。',
      async () => {
        await submit('中止本局', { type: 'fibking.game.returnToLobby' });
      },
    );
  };
  const endGame = () => {
    showConfirmAlert(
      HOST_FLOW_CONFIRM.returnLobbyTitle,
      HOST_FLOW_CONFIRM.returnLobbyBody,
      async () => {
        await submit('返回大厅', { type: 'fibking.game.returnToLobby' });
      },
    );
  };

  // ── 大聪明选人（房主本地模式，按 roundId 锚定）──
  const [guessRoundId, setGuessRoundId] = useState<string | null>(null);
  const isGuessing =
    isHost &&
    state.phase === 'ongoing' &&
    state.round !== null &&
    guessRoundId === state.round.roundId;
  const toggleGuessMode = useCallback(() => {
    if (state.phase !== 'ongoing' || state.round === null) return;
    setGuessRoundId((current) => (current === state.round.roundId ? null : state.round.roundId));
  }, [state.phase, state.round]);
  const guessSeat = (seat: number) => {
    showConfirmAlert(
      `确定选择 ${seat + 1} 号座位是老实人？`,
      '选择后将公开该座位的身份；选中老实人将直接结束本轮。',
      async () => {
        const succeeded = await submit('大聪明选人', { type: 'fibking.round.guess', seat });
        if (succeeded) setGuessRoundId(null);
      },
    );
  };
  // 资格 = 已入座且尚未被猜过的座位；选人模式内不合资格的点按静默吞掉。
  const guessPicking = useSeatPicking({
    active: isGuessing,
    mode: 'trigger',
    eligibleSeats:
      state.phase === 'ongoing' && state.round !== null
        ? Array.from({ length: state.numberOfPlayers }, (_, seat) => seat).filter(
            (seat) =>
              state.roster[seat] != null &&
              !state.round.guesses.some((guess) => guess.seat === seat),
          )
        : [],
    ineligibleTap: 'swallow',
    anchorKey: guessRoundId,
    storage: { kind: 'local' },
    onPick: guessSeat,
  });

  // ── 座位 / 壳 ──
  const capabilities = createFibRoomCapabilities({
    ...actions,
    state,
    isHost,
    mySeat,
    configureGame,
    openProfile: profile.open,
    takeOverBots: bots.capability,
    shareRoom: share.open,
  });
  const seatSource = useMemo(
    () => createFibSeatDataSource({ state, revision, myUserId: user.id, controlledSeat }),
    [controlledSeat, revision, state, user.id],
  );
  // 对局中：选人模式下点座即选人；否则只开资料卡。
  const onSeatPress = createRoomSeatPressHandler({
    isSetup: isLobby,
    inGameAction: (seat) => {
      if (isGuessing) return guessPicking.handleSeatTap(seat);
      const target = getFibProfileTarget(state, seat);
      if (target === null) return false;
      profile.open(target);
      return true;
    },
    state,
    currentSeat: mySeat,
    resolveIntent: getFibSeatTapIntent,
    profile,
    seatController,
  });
  const hostManagement = createFibHostManagement({
    state,
    isCommandSubmitting: isSubmitting,
    capabilities,
    startRound,
    markAllBotsViewed,
    beginRound,
    isGuessing,
    toggleGuessMode,
    cancelPreparing,
    revealRound,
    redrawRound,
    abandonGame,
    endGame,
  });
  const shellModel: RoomShellModel = createFibRoomShellModel({
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
    bottomActions: createFibBottomActions({
      state,
      isHost,
      viewerSeat: effectiveSeat,
      openIdentity,
    }),
    buildHostManagement: () => hostManagement,
    controlledSeat: createControlledSeatModel({
      controlledSeat,
      controlledBotName:
        controlledSeat !== null
          ? (seatSource.getSeat(controlledSeat).player?.displayName ?? null)
          : null,
      release: bots.release,
      gameName: 'FibKing',
    }),
  });

  return {
    shellModel,
    roundView,
    roleViewing,
    isPublicViewOpen,
    closePublicView: () => setIsPublicViewOpen(false),
    identityAllRoles,
    isBotTakeoverActive: controlledSeat !== null,
    openRules,
    playerCount: state.numberOfPlayers,
    phase: state.phase,
    preparationStage: state.phase === 'preparing' ? state.pendingRound.stage : null,
    preparationFailureCode:
      state.phase === 'preparationFailed' ? state.preparationFailure.failureCode : null,
    isHost,
    equippedRevealEffect: resolveEquippedRevealEffect(user.equippedEffect, room.roomCode, user.id),
  };
}
