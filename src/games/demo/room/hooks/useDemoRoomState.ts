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
import { createRoomSeatPressHandler } from '@/features/room/controllers/createRoomSeatPressHandler';
import { useBotTakeoverGuard } from '@/features/room/controllers/useBotTakeoverGuard';
import { useBotTakeoverLongPress } from '@/features/room/controllers/useBotTakeoverLongPress';
import {
  type RoomBotControl,
  useRoomBotControl,
} from '@/features/room/controllers/useRoomBotControl';
import { useRoomCommandSubmission } from '@/features/room/controllers/useRoomCommandSubmission';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useRoomLinkSnapshot } from '@/features/room/controllers/useRoomLinkSnapshot';
import { useRoomPresentationController } from '@/features/room/controllers/useRoomPresentationController';
import { useRoomSetupController } from '@/features/room/controllers/useRoomSetupController';
import {
  deriveRemainingRevealCards,
  type RevealRoleData,
} from '@/features/room/model/RevealRoleData';
import {
  createBotTakeoverCapability,
  type RoomCapabilities,
} from '@/features/room/model/RoomCapabilities';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { resolveEffectiveSeat, type RoomViewer } from '@/features/room/model/RoomViewer';
import { toRevealRoleData } from '@/games/demo/components/DemoRoleCardAdapter';
import type { DemoRoomSession } from '@/games/demo/model/DemoRoomSession';

import {
  createDemoHostManagement,
  createDemoRoomShellModel,
  getDemoSeatTapIntent,
} from '../demoRoomAdapter';
import { getDemoRoomCommandFailureMessage } from '../demoRoomCommandFailureMessage';

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
  const snapshot = useRoomLinkSnapshot(session);
  if (user === null || snapshot.phase !== 'ready')
    throw new Error('Demo requires an authenticated ready session');
  const state = snapshot.room.state;
  const isHost = state.hostUserId === user.id;
  const mySeat = getDemoUserSeat(state, user.id);
  const viewer: RoomViewer = { userId: user.id, isHost, seat: mySeat };
  const isLobby = state.phase.kind === 'lobby';
  const botControl = useRoomBotControl();
  const { controlledSeat, release: releaseBot, takeOver } = botControl;
  const effectiveSeat = resolveEffectiveSeat(viewer, controlledSeat);
  const { share, titleActions, gachaStatus } = useRoomPresentationController({
    roomCode: room.roomCode,
    gameDisplayName: 'Demo',
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
    hasOccupiedSeats: getDemoOccupiedSeatCount(state) > 0,
    isRoomFull: getDemoOccupiedSeatCount(state) === state.config.numberOfPlayers,
    configureGame: () =>
      navigation.navigate('GameConfig', {
        gameType: 'demo',
        mode: 'edit',
        roomCode: room.roomCode,
      }),
    shareRoom: share.open,
  });
  const submission = useRoomCommandSubmission(getDemoRoomCommandFailureMessage);
  // 派发纪律（#149 定版）：默认不带接管座位。房主命令的平台门只认未接管
  // 身份；座位动作（以被接管机器人身份发出的查看等）由调用方显式传
  // controlledSeat。
  const submit = (label: string, command: DemoCommand, control: number | null = null) =>
    submission.submit(label, () =>
      session.dispatch(command, { controlledSeat: control, label, durable: false }),
    );
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
    ...setupCapabilities,
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
  const onSeatPress = createRoomSeatPressHandler({
    isSetup: isLobby,
    state,
    currentSeat: mySeat,
    resolveIntent: getDemoSeatTapIntent,
    profile,
    seatController,
  });
  const selection = profile.selection;
  const buildHostManagement = () =>
    createDemoHostManagement({
      state,
      capabilities,
      isSubmitting: submission.isSubmitting,
      submit,
    });

  const shellModel: RoomShellModel = createDemoRoomShellModel({
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
    revision: snapshot.room.revision,
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
