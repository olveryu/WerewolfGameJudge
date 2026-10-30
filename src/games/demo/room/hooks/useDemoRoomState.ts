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

import { createRoomSeatPressHandler } from '@/features/room/controllers/createRoomSeatPressHandler';
import { useBotTakeover } from '@/features/room/controllers/useBotTakeover';
import {
  type ReadyRoomSession,
  useReadyRoomSession,
} from '@/features/room/controllers/useReadyRoomSession';
import { type RoleViewing, useRoleViewing } from '@/features/room/controllers/useRoleViewing';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useRoomPresentationController } from '@/features/room/controllers/useRoomPresentationController';
import { useRoomSetupController } from '@/features/room/controllers/useRoomSetupController';
import type { RevealRoleData } from '@/features/room/model/RevealRoleData';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { RoomViewer } from '@/features/room/model/RoomViewer';
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
  /** 平台单飞提交：座位动作由调用点显式传 `{ controlledSeat }`，房主命令不传。 */
  readonly submit: ReadyRoomSession<DemoState, DemoCommand>['submit'];
  readonly isSubmitting: boolean;
  readonly session: DemoRoomSession;
  readonly openRules: () => void;
  /** 身份卡：先落查看记录、确认后再弹卡（平台 useRoleViewing）。 */
  readonly roleViewing: RoleViewing;
  readonly roleCardAllRoles: readonly RevealRoleData[];
}

/** 把当前就绪 session 绑定到房间壳控制器与命令上。 */
export function useDemoRoomState(
  props: GameRoomScreenProps<'demo'> & {
    readonly session: DemoRoomSession;
    readonly entryController: RoomEntryController;
  },
): DemoRoomScreenState {
  const { session, room, navigation, entryController } = props;
  const { user, state, revision, submit, isSubmitting } = useReadyRoomSession(
    session,
    getDemoRoomCommandFailureMessage,
  );
  const isHost = state.hostUserId === user.id;
  const mySeat = getDemoUserSeat(state, user.id);
  const viewer: RoomViewer = { userId: user.id, isHost, seat: mySeat };
  const isLobby = state.phase.kind === 'lobby';
  // 机器人接管：房主随时可接管；失去房主身份或座位不再是机器人时由共享守卫释放。
  const bots = useBotTakeover({
    viewer,
    isBotSeat: (seat) => isBotSeat(state.roster, seat),
    gameName: 'Demo',
  });
  const { controlledSeat, effectiveSeat } = bots;
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
  // 身份查看协议：查看记录先落（接管时是被接管座位），服务端确认后才弹卡。
  const roleViewing = useRoleViewing({
    effectiveSeat,
    identityKey: isLobby ? null : state.gameSequence,
    hasViewed:
      state.phase.kind === 'ended' ||
      (effectiveSeat !== null && state.roleViewedSeats.includes(effectiveSeat)),
    occupiedSeatCount: getDemoOccupiedSeatCount(state),
    viewedSeatCount: state.roleViewedSeats.length,
    submitViewed: () => submit('查看身份', { type: 'demo.role.viewed' }, { controlledSeat }),
  });
  const capabilities: RoomCapabilities = {
    ...setupCapabilities,
    canTakeOverBots: bots.capability,
  };
  const onSeatPress = createRoomSeatPressHandler({
    isSetup: isLobby,
    state,
    currentSeat: mySeat,
    resolveIntent: getDemoSeatTapIntent,
    profile,
    seatController,
  });
  const buildHostManagement = () =>
    createDemoHostManagement({
      state,
      capabilities,
      isSubmitting,
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
    revision,
    controlledSeat,
    seatsVisuallyDisabled: isSubmitting || seatController.isSubmitting,
    onSeatPress,
    onBotSeatLongPress: bots.capability.isAllowed ? bots.onBotSeatLongPress : null,
    seatController,
    profileSelection: profile.selection,
    onProfileClose: profile.close,
    onProfileLeaveSeat: profile.leaveSelf,
    share,
    isLobby,
    buildHostManagement,
    releaseBot: bots.release,
  });
  const viewModel = isLobby ? null : getDemoViewModel(state, effectiveSeat);
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
    submit,
    isSubmitting,
    session,
    openRules: () =>
      navigation.navigate('GameGuide', { gameType: 'demo', roomCode: room.roomCode }),
    roleViewing,
    roleCardAllRoles: Object.values(state.identities).map(toRevealRoleData),
  };
}
