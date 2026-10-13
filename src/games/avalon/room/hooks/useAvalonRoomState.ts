/**
 * 组装共享房间控制器；阿瓦隆只负责阶段、机器人接管、开始游戏与房主手动结算。
 */

import {
  type AvalonCommand,
  type AvalonRoleId,
  type AvalonState,
  type AvalonViewModel,
  getAvalonOccupiedSeatCount,
  getAvalonUserSeat,
  getAvalonViewModel,
  isAvalonBotSeat,
} from '@game-judge/game-engine/games/avalon/public';
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useAuthContext } from '@/contexts/AuthContext';
import { useGachaStatusQuery } from '@/features/gacha/queries/useGachaQuery';
import type { RevealEffectType } from '@/features/room/components/RoleRevealEffects/types';
import { useAutoShowRoomShareQr } from '@/features/room/controllers/useAutoShowRoomShareQr';
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
import { useStageDeadline } from '@/features/room/hooks/useStageDeadline';
import { resolveEquippedRevealEffect } from '@/features/room/model/resolveEquippedRevealEffect';
import {
  deriveRemainingRevealCards,
  type RevealRoleData,
} from '@/features/room/model/RevealRoleData';
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
  type RoomCapabilities,
} from '@/features/room/model/RoomCapabilities';
import { ROOM_SEAT_TAP_BLOCKED_TITLE } from '@/features/room/model/RoomSeatTap';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { type AvalonRoomSession } from '@/games/avalon/model/AvalonRoomSession';
import { showErrorAlert } from '@/utils/alertPresets';

import type { AvalonAudioRuntime } from '../../audio/AvalonAudioPlayer';
import { toRevealRoleData } from '../../components/AvalonRoleCardAdapter';
import {
  createAvalonHostManagement,
  createAvalonRoomShellModel,
  getAvalonSeatTapIntent,
} from '../avalonRoomAdapter';
import { getAvalonRoomCommandFailureMessage } from '../avalonRoomCommandFailureMessage';
import { useAvalonAudioOrchestration } from './useAvalonAudioOrchestration';
import { useAvalonSeatCommands } from './useAvalonSeatCommands';

/**
 * 阿瓦隆房间 Screen 的显式契约（P-2b，对齐狼人杀 WerewolfRoomScreenState 形态）：
 * 领域推导全部在本 hook 内组装，Screen 只消费本接口渲染。
 */
export interface AvalonRoomScreenState {
  readonly state: AvalonState;
  readonly shellModel: RoomShellModel;
  /** 当前视角的阶段视图模型；大厅阶段为 null（原在 Screen 内推导，P-2b 下沉）。 */
  readonly viewModel: AvalonViewModel | null;
  readonly roomCode: string;
  readonly userId: string;
  readonly mySeat: number | null;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly isHost: boolean;
  readonly canControlBots: boolean;
  readonly equippedRevealEffect: RevealEffectType | null;
  readonly submit: (
    label: string,
    command: AvalonCommand,
    control?: number | null,
  ) => Promise<boolean>;
  readonly isSubmitting: boolean;
  readonly session: AvalonRoomSession;
  readonly openRules: () => void;
  readonly roleCardVisible: boolean;
  readonly setRoleCardVisible: Dispatch<SetStateAction<boolean>>;
  readonly rolePreviewId: AvalonRoleId | null;
  readonly setRolePreviewId: Dispatch<SetStateAction<AvalonRoleId | null>>;
  /** 身份查看协议锚点：有效座位未在服务端记录已查看时才播揭示动画。 */
  readonly roleCardShouldPlay: boolean;
  readonly roleCardRemainingCards: number;
  /** Animator 候选池：公开的完整角色分布（按座位序）。 */
  readonly roleCardAllRoles: readonly RevealRoleData[];
  /** 投票/任务阶段倒计时剩余秒数；不在限时阶段或无截止时为 null。 */
  readonly phaseRemainingSeconds: number | null;
  readonly nightModalVisible: boolean;
  readonly setNightModalVisible: Dispatch<SetStateAction<boolean>>;
  /** 投票弹窗开关：自动弹一次由 Screen 驱动，底部按钮重开也走这里。 */
  readonly voteModalOpen: boolean;
  readonly setVoteModalOpen: Dispatch<SetStateAction<boolean>>;
  /** 出牌弹窗开关：同投票。 */
  readonly questModalOpen: boolean;
  readonly setQuestModalOpen: Dispatch<SetStateAction<boolean>>;
  /** 湖仙确认展示弹窗开关：自动弹一次由 Screen 驱动，底部按钮重开也走这里。 */
  readonly ladyAckOpen: boolean;
  readonly setLadyAckOpen: Dispatch<SetStateAction<boolean>>;
  /** 提前刺杀选人模式：底部「刺杀」按钮开启，选人弹窗住在 Screen 的 overlays。 */
  readonly strikePickMode: boolean;
  readonly setStrikePickMode: Dispatch<SetStateAction<boolean>>;
  /** 注册湖仙结果重开处理器（结果弹窗的已阅状态住在 Screen，adapter 底部入口经此触达）。 */
  readonly setLadyResultReopenHandler: (handler: (() => void) | null) => void;
  /** 座位盘选人（提名）：Screen 同步本地选中集，adapter 据此给选中座位上「队员」徽标。 */
  readonly setPickedSeats: Dispatch<SetStateAction<ReadonlySet<number>>>;
  /** 注册座位点选处理器：返回 true 表示本次点按已被选人消费，不走默认座位行为。 */
  readonly setSeatPickHandler: (handler: ((seat: number) => boolean) | null) => void;
}

/** 把当前就绪 session 绑定到房间壳控制器与命令上。 */
const EMPTY_PICKED_SEATS: ReadonlySet<number> = new Set();

export function useAvalonRoomState(
  props: GameRoomScreenProps<'avalon'> & {
    readonly session: AvalonRoomSession;
    readonly entryController: RoomEntryController;
    readonly audio: AvalonAudioRuntime;
  },
): AvalonRoomScreenState {
  const { session, room, navigation, entryController, audio } = props;
  const { user } = useAuthContext();
  const snapshot = useRoomSessionSnapshot(session);
  if (user === null || snapshot.phase !== 'ready')
    throw new Error('Avalon requires an authenticated ready session');
  const state = snapshot.snapshot.state;
  const isHost = state.hostUserId === user.id;
  // 第一晚播报：房主按序播放服务端队列，播完 ack。
  useAvalonAudioOrchestration({
    session,
    isHost,
    pendingAudioEffects: state.pendingAudioEffects,
    audio,
  });
  const mySeat = getAvalonUserSeat(state, user.id);
  const isLobby = state.phase.kind === 'lobby';
  // 查看身份：角色卡弹窗状态（对齐狼人杀）。
  const [roleCardVisible, setRoleCardVisible] = useState(false);
  const [rolePreviewId, setRolePreviewId] = useState<AvalonRoleId | null>(null);
  // 晚上确认：两步流程（底部按钮 → 弹窗），对齐狼人杀丘比特。
  const [nightModalVisible, setNightModalVisible] = useState(false);
  // 阶段弹窗开关（投票 / 出牌 / 湖仙确认 / 提前刺杀选人）：与夜晚确认同形态，
  // 开关住在 hook，底部动作区的重开入口与 Screen 的自动弹一次共用同一状态。
  const [voteModalOpen, setVoteModalOpen] = useState(false);
  const [questModalOpen, setQuestModalOpen] = useState(false);
  const [ladyAckOpen, setLadyAckOpen] = useState(false);
  const [strikePickMode, setStrikePickMode] = useState(false);
  const ladyResultReopenRef = useRef<(() => void) | null>(null);
  const setLadyResultReopenHandler = useCallback((handler: (() => void) | null) => {
    ladyResultReopenRef.current = handler;
  }, []);
  const [pickedSeats, setPickedSeats] = useState<ReadonlySet<number>>(EMPTY_PICKED_SEATS);
  const seatPickHandlerRef = useRef<((seat: number) => boolean) | null>(null);
  const setSeatPickHandler = useCallback((handler: ((seat: number) => boolean) | null) => {
    seatPickHandlerRef.current = handler;
  }, []);
  // step 推进时重置弹窗状态，防止 stale（比如别人确认完推进了 step，自己开着的弹窗指令已失效）。
  const nightStep = state.phase.kind === 'night' ? state.phase.step : null;
  useEffect(() => {
    setNightModalVisible(false);
  }, [nightStep]);
  const botControl = useRoomBotControl();
  const { controlledSeat, release: releaseBot, takeOver } = botControl;
  const effectiveSeat = controlledSeat ?? mySeat;
  const seats = useAvalonSeatCommands(session, user);
  const seatController = useRoomSeatController({ currentSeat: mySeat, takeSeat: seats.takeSeat });
  const profile = useRoomProfileController({
    myUserId: user.id,
    kickSeat: seats.kickSeat,
    leaveSeat: seats.leaveSeat,
  });
  const host = useRoomHostOperations({ clearSeats: seats.clearSeats, fillBots: seats.fillBots });
  const share = useRoomShareController({ roomCode: room.roomCode, gameDisplayName: '阿瓦隆' });
  const titleActions = useRoomTitleActions();
  const { data: gachaStatus } = useGachaStatusQuery();
  const submission = useRoomCommandSubmission(getAvalonRoomCommandFailureMessage);
  // 派发纪律（对齐卧底 submit 形态）：默认不带接管座位。房主命令的平台门
  // 只认未接管身份（resolveHostActorId），挂着接管座位发房主命令必然被拒；
  // 座位动作（以被接管机器人的身份发出）由调用方显式传 controlledSeat。
  const submit = (label: string, command: AvalonCommand, control: number | null = null) =>
    submission.submit(label, () => session.dispatch(command, { controlledSeat: control, label }));
  // 投票/任务倒计时：到点由任一未接管客户端提交超时结算（引擎校验截止时间，先到者生效）。
  const phaseDeadlineAt =
    state.phase.kind === 'vote' || state.phase.kind === 'quest' ? state.phase.deadlineAt : null;
  // 超时结算走静默派发（对齐 drawguess 的 expire）：全场客户端会同时提交，
  // 先到者结算、其余被引擎阶段校验拒绝——拒绝是预期结果，绝不能弹错误框。
  const expirePhase = useCallback(async () => {
    if (state.phase.kind === 'vote') {
      await session.dispatch(
        { type: 'avalon.vote.timeout' },
        { controlledSeat: null, label: '投票超时结算', isRecoverable: true },
      );
    } else if (state.phase.kind === 'quest') {
      await session.dispatch(
        { type: 'avalon.quest.timeout' },
        { controlledSeat: null, label: '任务超时结算', isRecoverable: true },
      );
    }
  }, [state.phase.kind, session]);
  const shouldExpirePhase = useCallback(() => {
    if (phaseDeadlineAt === null || controlledSeat !== null) return false;
    const current = session.getSnapshot();
    return (
      current.phase === 'ready' &&
      current.connection === 'live' &&
      current.pendingCommandCount === 0 &&
      current.snapshot.state.phaseRevision === state.phaseRevision
    );
  }, [phaseDeadlineAt, controlledSeat, session, state.phaseRevision]);
  const phaseRemainingSeconds = useStageDeadline({
    deadlineAt: phaseDeadlineAt,
    shouldExpire: shouldExpirePhase,
    onExpire: expirePhase,
    label: '阶段超时结算',
    silentExpire: true,
  });
  // 机器人接管：房主随时可接管（无阶段条件）；失去房主身份或座位不再是机器人时自动释放。
  const canControlBots = isHost;
  useBotTakeoverGuard({
    controlledSeat,
    canControlBots,
    seatStillBot: controlledSeat === null || isAvalonBotSeat(state, controlledSeat),
    release: releaseBot,
  });
  const capabilities: RoomCapabilities = {
    ...createRoomSetupCapabilities({
      isSetup: isLobby,
      isHost,
      mySeat,
      supportsBots: true,
      hasOccupiedSeats: getAvalonOccupiedSeatCount(state) > 0,
      isRoomFull: getAvalonOccupiedSeatCount(state) === state.config.numberOfPlayers,
      requestTakeSeat: seatController.requestTakeSeat,
      requestMoveSeat: seatController.requestMoveSeat,
      leaveSeat: profile.leaveSelf,
      kickSeat: profile.kick,
      clearSeats: host.requestClearSeats,
      fillBots: host.requestFillBots,
      configureGame: () =>
        navigation.navigate('GameConfig', {
          gameType: 'avalon',
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
  const onSeatPress = (seat: number, disabledReason?: string) => {
    if (seatPickHandlerRef.current?.(seat) === true) return;
    // 局内点座对齐狼人杀 SeatTapPolicy：带 disabledReason 的座位（局内空座）
    // 仍弹「不可选择」提示，其余未被选座处理器消费的点击一律静默 NOOP
    //（白天 other_status、局内 not_actioner 都是 NOOP）。
    if (!isLobby) {
      if (disabledReason !== undefined)
        return showErrorAlert(ROOM_SEAT_TAP_BLOCKED_TITLE, disabledReason);
      return;
    }
    const intent = getAvalonSeatTapIntent({
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
  // 长按机器人座位接管/释放：用共享 hook。
  const onBotSeatLongPress = useBotTakeoverLongPress({
    controlledSeat,
    takeOver,
    release: releaseBot,
    canTakeOver: capabilities.canTakeOverBots.isAllowed,
    isBotSeat: (seat) => isAvalonBotSeat(state, seat),
    gameName: 'Avalon',
  });
  const hostManagement = createAvalonHostManagement({
    state,
    isHost,
    capabilities,
    isSubmitting: submission.isSubmitting,
    controlledSeat,
    releaseBot,
    submit,
  });

  const selection = profile.selection;
  const shellModel: RoomShellModel = createAvalonRoomShellModel({
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
    pickedSeats,
    seatsVisuallyDisabled:
      state.isAudioPlaying || submission.isSubmitting || seatController.isSubmitting,
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
    effectiveSeat,
    onViewRolePress: () => {
      setRoleCardVisible(true);
      // 身份查看协议：打开角色卡即为当前座位落查看记录
      //（接管时是被接管座位；引擎幂等，终局后不发）。
      if (
        effectiveSeat !== null &&
        state.phase.kind !== 'ended' &&
        !state.roleViewedSeats.includes(effectiveSeat)
      ) {
        void submit('查看身份', { type: 'avalon.role.viewed' }, controlledSeat);
      }
    },
    onNightInfoPress: () => setNightModalVisible(true),
    isSubmitting: submission.isSubmitting,
    settleCountdownSeconds: phaseRemainingSeconds,
    onOpenVotePress: () => setVoteModalOpen(true),
    onOpenQuestPress: () => setQuestModalOpen(true),
    onProposeTeamPress: () => {
      void submit(
        '提交队伍',
        { type: 'avalon.team.propose', seats: [...pickedSeats] },
        controlledSeat,
      );
    },
    onLadyAcknowledgePress: () => setLadyAckOpen(true),
    onLadyResultPress: () => ladyResultReopenRef.current?.(),
    onEarlyStrikePress: () => setStrikePickMode(true),
    hostManagement,
    canControlBots,
    releaseBot,
  });
  const openShare = share.open;
  useAutoShowRoomShareQr({ isHost, entryReason: props.entryReason, openShare });
  const viewModel = isLobby ? null : getAvalonViewModel(state, effectiveSeat);
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
    equippedRevealEffect: resolveEquippedRevealEffect(user.equippedEffect, room.roomCode, user.id),
    phaseRemainingSeconds,
    submit,
    isSubmitting: submission.isSubmitting,
    session,
    openRules: () =>
      navigation.navigate('GameGuide', { gameType: 'avalon', roomCode: room.roomCode }),
    // 查看身份弹窗（对齐狼人杀）。
    roleCardVisible,
    setRoleCardVisible,
    rolePreviewId,
    setRolePreviewId,
    // 身份查看协议：动画锚点（服务端记录）与候选池（公开的完整角色分布）。
    roleCardShouldPlay: effectiveSeat !== null && !state.roleViewedSeats.includes(effectiveSeat),
    roleCardRemainingCards: deriveRemainingRevealCards(
      getAvalonOccupiedSeatCount(state),
      state.roleViewedSeats.length,
    ),
    roleCardAllRoles: Object.entries(state.roles)
      .sort(([seatA], [seatB]) => Number(seatA) - Number(seatB))
      .map(([, roleId]) => toRevealRoleData(roleId)),
    // 晚上确认弹窗：两步流程（底部按钮 → 弹窗）。
    nightModalVisible,
    setNightModalVisible,
    voteModalOpen,
    setVoteModalOpen,
    questModalOpen,
    setQuestModalOpen,
    ladyAckOpen,
    setLadyAckOpen,
    strikePickMode,
    setStrikePickMode,
    setLadyResultReopenHandler,
    setPickedSeats,
    setSeatPickHandler,
  };
}
