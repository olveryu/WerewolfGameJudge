/**
 * 组装共享房间控制器；Demo只负责身份查看与阶段投影。
 */

import {
  type DemoCommand,
  type DemoState,
  type DemoViewModel,
  getDemoOccupiedSeatCount,
  getDemoUserSeat,
  getDemoViewModel,
  isBotSeat,
} from '@game-judge/game-engine/games/demo/public';
import { useCallback, useState } from 'react';

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
  deriveRemainingRevealCards,
  type RevealRoleData,
} from '@/features/room/model/RevealRoleData';
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
  type RoomCapabilities,
} from '@/features/room/model/RoomCapabilities';
import {
  resolveRoomInGameSeatTap,
  ROOM_SEAT_TAP_BLOCKED_TITLE,
} from '@/features/room/model/RoomSeatTap';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { toRevealRoleData } from '@/games/demo/components/DemoRoleCardAdapter';
import type { DemoRoomSession } from '@/games/demo/model/DemoRoomSession';
import { showErrorAlert } from '@/utils/alertPresets';

import {
  createDemoHostManagement,
  createDemoRoomShellModel,
  getDemoSeatTapIntent,
} from '../demoRoomAdapter';
import { getDemoRoomCommandFailureMessage } from '../demoRoomCommandFailureMessage';
import { useDemoSeatCommands } from './useDemoSeatCommands';

/**
 * Demo房间 Screen 的显式契约：领域推导（视图模型、身份卡锚点）
 * 全部在本 hook 内组装，Screen 只消费本接口渲染。末尾 return 不许 spread。
 */
export interface DemoRoomScreenState {
  readonly state: DemoState;
  readonly shellModel: RoomShellModel;
  /** 当前视角的视图模型（按有效席位裁剪）；大厅为 null。 */
  readonly viewModel: DemoViewModel | null;
  readonly roomCode: string;
  readonly userId: string;
  readonly mySeat: number | null;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly isHost: boolean;
  readonly canControlBots: boolean;
  readonly takeOver: RoomBotControl['takeOver'];
  readonly releaseBot: RoomBotControl['release'];
  readonly submit: (
    label: string,
    command: DemoCommand,
    control?: number | null,
  ) => Promise<boolean>;
  readonly session: DemoRoomSession;
  readonly openRules: () => void;
  /** 身份卡弹窗开关与打开动作（打开即落查看记录）。 */
  readonly roleCardVisible: boolean;
  readonly setRoleCardVisible: (visible: boolean) => void;
  readonly onViewRolePress: () => void;
  /** 首次查看才播揭示动画（服务端查看记录锚点）；接管机器人时恒 false。 */
  readonly roleCardShouldPlay: boolean;
  readonly roleCardAllRoles: readonly RevealRoleData[];
  readonly roleCardRemainingCards: number;
}

/** 把当前就绪 session 绑定到房间壳控制器与命令上。 */
export function useDemoRoomState(
  props: GameRoomScreenProps<'demo'> & {
    readonly session: DemoRoomSession;
    readonly entryController: RoomEntryController;
  },
): DemoRoomScreenState {
  const { session, room, navigation, entryController } = props;
  const { user } = useAuthContext();
  const snapshot = useRoomSessionSnapshot(session);
  if (user === null || snapshot.phase !== 'ready')
    throw new Error('Demo requires an authenticated ready session');
  const state = snapshot.snapshot.state;
  const isHost = state.hostUserId === user.id;
  const mySeat = getDemoUserSeat(state, user.id);
  const isLobby = state.phase.kind === 'lobby';
  const botControl = useRoomBotControl();
  const { controlledSeat, release: releaseBot, takeOver } = botControl;
  const effectiveSeat = controlledSeat ?? mySeat;
  const seats = useDemoSeatCommands(session, user);
  const seatController = useRoomSeatController({ currentSeat: mySeat, takeSeat: seats.takeSeat });
  const profile = useRoomProfileController({
    myUserId: user.id,
    kickSeat: seats.kickSeat,
    leaveSeat: seats.leaveSeat,
  });
  const host = useRoomHostOperations({ clearSeats: seats.clearSeats, fillBots: seats.fillBots });
  const share = useRoomShareController({
    roomCode: room.roomCode,
    gameDisplayName: 'Demo',
  });
  const titleActions = useRoomTitleActions();
  const { data: gachaStatus } = useGachaStatusQuery();
  const submission = useRoomCommandSubmission(getDemoRoomCommandFailureMessage);
  // 派发纪律（#149 定版）：默认不带接管座位。房主命令的平台门只认未接管
  // 身份；座位动作（以被接管机器人身份发出的查看等）由调用方显式传
  // controlledSeat。
  const submit = (label: string, command: DemoCommand, control: number | null = null) =>
    submission.submit(label, () => session.dispatch(command, { controlledSeat: control, label }));
  const [roleCardVisible, setRoleCardVisible] = useState(false);
  const onViewRolePress = () => {
    setRoleCardVisible(true);
    // 身份查看协议：打开身份卡即为当前座位落查看记录
    //（接管时是被接管座位；引擎幂等，终局后不发）。
    if (
      effectiveSeat !== null &&
      state.phase.kind !== 'lobby' &&
      state.phase.kind !== 'ended' &&
      !state.roleViewedSeats.includes(effectiveSeat)
    ) {
      void submit('查看身份', { type: 'demo.role.viewed' }, controlledSeat);
    }
  };
  // 机器人接管：房主随时可接管（无阶段条件）；失去房主身份或座位不再是机器人时自动释放。
  const canControlBots = isHost;
  useBotTakeoverGuard({
    controlledSeat,
    canControlBots,
    seatStillBot: controlledSeat === null || isBotSeat(state.roster, controlledSeat),
    release: releaseBot,
  });
  const capabilities: RoomCapabilities = {
    ...createRoomSetupCapabilities({
      isSetup: isLobby,
      isHost,
      mySeat,
      supportsBots: true,
      hasOccupiedSeats: getDemoOccupiedSeatCount(state) > 0,
      isRoomFull: getDemoOccupiedSeatCount(state) === state.config.numberOfPlayers,
      requestTakeSeat: seatController.requestTakeSeat,
      requestMoveSeat: seatController.requestMoveSeat,
      leaveSeat: profile.leaveSelf,
      kickSeat: profile.kick,
      clearSeats: host.requestClearSeats,
      fillBots: host.requestFillBots,
      configureGame: () =>
        navigation.navigate('GameConfig', {
          gameType: 'demo',
          mode: 'edit',
          roomCode: room.roomCode,
        }),
      shareRoom: share.open,
    }),
    canViewProfiles: isLobby
      ? { isAllowed: true, execute: profile.open }
      : { isAllowed: false, reason: '游戏进行中不能查看玩家资料' },
    canTakeOverBots: createBotTakeoverCapability(canControlBots, takeOver),
  };
  const isSeatBot = useCallback((seat: number) => isBotSeat(state.roster, seat), [state]);
  const onBotSeatLongPress = useBotTakeoverLongPress({
    controlledSeat,
    takeOver,
    release: releaseBot,
    canTakeOver: capabilities.canTakeOverBots.isAllowed,
    deniedReason: capabilities.canTakeOverBots.isAllowed
      ? undefined
      : (capabilities.canTakeOverBots.reason ?? undefined),
    isBotSeat: isSeatBot,
    gameName: 'Demo',
  });
  const onSeatPress = (seat: number, disabledReason?: string) => {
    // 局内裁决走共享 resolveRoomInGameSeatTap（同一实现，全平台一份）。
    if (!isLobby) {
      const outcome = resolveRoomInGameSeatTap(disabledReason);
      if (outcome.kind === 'alert')
        return showErrorAlert(ROOM_SEAT_TAP_BLOCKED_TITLE, outcome.reason);
      return;
    }
    const intent = getDemoSeatTapIntent({
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
  const selection = profile.selection;
  const hostManagement = createDemoHostManagement({
    state,
    isHost,
    capabilities,
    isSubmitting: submission.isSubmitting,
    submit,
  });

  const shellModel: RoomShellModel = createDemoRoomShellModel({
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
  const viewModel = isLobby ? null : getDemoViewModel(state, effectiveSeat);
  const roleCardShouldPlay =
    controlledSeat === null &&
    effectiveSeat !== null &&
    !state.roleViewedSeats.includes(effectiveSeat);
  const roleCardAllRoles = Object.values(state.identities).map(toRevealRoleData);
  const roleCardRemainingCards = deriveRemainingRevealCards(
    getDemoOccupiedSeatCount(state),
    state.roleViewedSeats.length,
  );
  return {
    state,
    shellModel,
    viewModel,
    roomCode: room.roomCode,
    userId: user.id,
    mySeat,
    effectiveSeat,
    controlledSeat,
    isHost,
    canControlBots,
    takeOver,
    releaseBot,
    submit,
    session,
    openRules: () =>
      navigation.navigate('GameGuide', { gameType: 'demo', roomCode: room.roomCode }),
    roleCardVisible,
    setRoleCardVisible,
    onViewRolePress,
    roleCardShouldPlay,
    roleCardAllRoles,
    roleCardRemainingCards,
  };
}
