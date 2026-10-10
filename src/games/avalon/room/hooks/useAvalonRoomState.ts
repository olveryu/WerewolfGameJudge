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
import { createControlledSeatModel } from '@/features/room/model/createControlledSeatModel';
import { executeProfileKick } from '@/features/room/model/executeProfileKick';
import {
  buildClearSeatsAction,
  buildFillBotsAction,
  buildRoomConfigAction,
} from '@/features/room/model/hostManagementActions';
import { resolveEquippedRevealEffect } from '@/features/room/model/resolveEquippedRevealEffect';
import type { RevealRoleData } from '@/features/room/model/RevealRoleData';
import {
  createRoomSetupCapabilities,
  type RoomCapabilities,
} from '@/features/room/model/RoomCapabilities';
import type {
  RoomHostManagementAction,
  RoomHostManagementModel,
  RoomHostManagementSection,
} from '@/features/room/model/RoomHostManagement';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { type AvalonRoomSession } from '@/games/avalon/model/AvalonRoomSession';
import { showConfirmAlert, showErrorAlert } from '@/utils/alertPresets';

import type { AvalonAudioRuntime } from '../../audio/AvalonAudioPlayer';
import { toRevealRoleData } from '../../components/AvalonRoleCardAdapter';
import {
  createAvalonSeatDataSource,
  createAvalonStatusRibbon,
  getAvalonProfileTarget,
} from '../avalonRoomAdapter';
import { getAvalonRoomCommandFailureMessage } from '../avalonRoomCommandFailureMessage';
import { resolveNightInstruction } from '../policy/avalonInteractionPolicy';
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
    controlledSeatOverride?: number | null,
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
  /** Animator 候选池：公开的完整角色分布（按座位序）。 */
  readonly roleCardAllRoles: readonly RevealRoleData[];
  /** 投票/任务阶段倒计时剩余秒数；不在限时阶段或无截止时为 null。 */
  readonly phaseRemainingSeconds: number | null;
  readonly nightModalVisible: boolean;
  readonly setNightModalVisible: Dispatch<SetStateAction<boolean>>;
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
  // 结构性修复：submit 接受 controlledSeat 显式参数，避免闭包捕获旧值。
  // 调用方在需要时传入最新值（如释放接管后传 null），不传则用当前 render 的值。
  const submit = (label: string, command: AvalonCommand, controlledSeatOverride?: number | null) =>
    submission.submit(label, () =>
      session.dispatch(command, {
        controlledSeat:
          controlledSeatOverride !== undefined ? controlledSeatOverride : controlledSeat,
        label,
      }),
    );
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
    canTakeOverBots: canControlBots
      ? { isAllowed: true, execute: takeOver }
      : { isAllowed: false, reason: '只有房主可以接管机器人' },
  };
  const onSeatPress = (seat: number) => {
    if (seatPickHandlerRef.current?.(seat) === true) return;
    if (!isLobby) {
      return showErrorAlert('不可选择', '游戏进行中不能调整座位');
    }
    const target = getAvalonProfileTarget(state, seat);
    if (target !== null) return profile.open(target);
    return mySeat === null
      ? seatController.requestTakeSeat(seat)
      : seatController.requestMoveSeat(seat);
  };
  // 长按机器人座位接管/释放：用共享 hook（D12：不做任何接管提示）。
  const onBotSeatLongPress = useBotTakeoverLongPress({
    controlledSeat,
    takeOver,
    release: releaseBot,
    canTakeOver: capabilities.canTakeOverBots.isAllowed,
    isBotSeat: (seat) => getAvalonProfileTarget(state, seat)?.occupantKind === 'bot',
    gameName: 'Avalon',
  });
  const roomActions: RoomHostManagementAction[] = [];
  if (capabilities.canConfigureGame.isAllowed)
    roomActions.push(buildRoomConfigAction({ onPress: capabilities.canConfigureGame.execute }));
  if (capabilities.canFillBots.isAllowed)
    roomActions.push(buildFillBotsAction({ onPress: capabilities.canFillBots.execute }));
  if (capabilities.canClearSeats.isAllowed)
    roomActions.push(buildClearSeatsAction({ onPress: capabilities.canClearSeats.execute }));
  const occupiedSeatCount = getAvalonOccupiedSeatCount(state);
  const canStart = occupiedSeatCount === state.config.numberOfPlayers;
  const startDisabledReason = canStart
    ? null
    : `座位尚未坐满（还差 ${state.config.numberOfPlayers - occupiedSeatCount} 人）`;
  const isTerminal = state.phase.kind === 'ended';
  const lobbyHostManagement: RoomHostManagementModel = {
    preview: '开始游戏',
    status: `等待入座 · ${occupiedSeatCount}/${state.config.numberOfPlayers}`,
    sections: [
      {
        key: 'game',
        title: '游戏',
        actions: [
          {
            key: 'start',
            label: '开始游戏',
            icon: 'play-outline',
            variant: 'primary',
            isLoading: submission.isSubmitting,
            testID: 'avalon-start',
            ...(submission.isSubmitting || !canStart
              ? {
                  isEnabled: false as const,
                  disabledReason: startDisabledReason,
                  onDisabledPress: () =>
                    showErrorAlert('暂时不能开始', startDisabledReason ?? '请稍后重试'),
                }
              : {
                  isEnabled: true as const,
                  onPress: () => void submit('开始游戏', { type: 'avalon.game.start' }),
                }),
          },
        ],
      },
      { key: 'room', title: '房间管理', actions: roomActions },
    ],
  };
  // 房主手动结算（D15/D16）：投票阶段可结束投票，任务阶段可结束任务。
  const inGameSections: RoomHostManagementSection[] = [];
  if (state.phase.kind === 'vote')
    inGameSections.push({
      key: 'vote',
      title: '投票管理',
      actions: [
        {
          key: 'finish-vote',
          label: '结束投票',
          icon: 'checkmark-done-outline',
          variant: 'primary',
          isLoading: submission.isSubmitting,
          testID: 'avalon-finish-vote',
          ...(submission.isSubmitting
            ? { isEnabled: false as const, disabledReason: null, onDisabledPress: null }
            : {
                isEnabled: true as const,
                onPress: () =>
                  showConfirmAlert(
                    '结束投票',
                    controlledSeat !== null
                      ? '未投票的座位将视为弃权，确定结束投票并结算吗？你正在接管机器人座位，结算前将先释放接管。'
                      : '未投票的座位将视为弃权，确定结束投票并结算吗？',
                    () => {
                      // 房主接管中需先释放，否则服务端按"机器人身份"拒绝（requireAvalonHost）。
                      // 显式传 null，避免闭包捕获旧的 controlledSeat。
                      if (controlledSeat !== null) releaseBot();
                      void submit('结束投票', { type: 'avalon.vote.finish' }, null);
                    },
                  ),
              }),
        },
      ],
    });
  if (state.phase.kind === 'quest')
    inGameSections.push({
      key: 'quest',
      title: '任务管理',
      actions: [
        {
          key: 'finish-quest',
          label: '结束任务',
          icon: 'checkmark-done-outline',
          variant: 'primary',
          isLoading: submission.isSubmitting,
          testID: 'avalon-finish-quest',
          ...(submission.isSubmitting
            ? { isEnabled: false as const, disabledReason: null, onDisabledPress: null }
            : {
                isEnabled: true as const,
                onPress: () =>
                  showConfirmAlert(
                    '结束任务',
                    controlledSeat !== null
                      ? '未出牌的队员将视为成功，确定提前结算吗？你正在接管机器人座位，结算前将先释放接管。'
                      : '未出牌的队员将视为成功，确定提前结算吗？',
                    () => {
                      if (controlledSeat !== null) releaseBot();
                      void submit('结束任务', { type: 'avalon.quest.finish' }, null);
                    },
                  ),
              }),
        },
      ],
    });
  // 房主管理常驻（对齐狼人杀）：局内任何时候房主都能点开，房间管理区始终有，
  // 投票/任务阶段额外出现"结束投票"/"结束任务"。
  const inGameHostManagement: RoomHostManagementModel = {
    preview:
      state.phase.kind === 'vote'
        ? '结束投票'
        : state.phase.kind === 'quest'
          ? '结束任务'
          : '房主管理',
    status: null,
    sections: [...inGameSections, { key: 'room', title: '房间管理', actions: roomActions }],
  };
  const terminalHostManagement: RoomHostManagementModel = {
    preview: '本局已结束',
    status: null,
    sections: [
      {
        key: 'current-flow',
        title: '当前流程',
        actions: [
          {
            key: 'next-round',
            label: '再来一局',
            icon: 'play-forward-outline',
            variant: 'primary',
            isEnabled: true,
            testID: 'avalon-next-round',
            onPress: () =>
              showConfirmAlert(
                '再来一局',
                '重新发牌并清零比分，开始新的一局。',
                () => void submit('再来一局', { type: 'avalon.game.start' }),
              ),
          },
          {
            key: 'return-lobby',
            label: '返回大厅',
            icon: 'return-down-back-outline',
            variant: 'secondary',
            isEnabled: true,
            testID: 'avalon-return-lobby',
            onPress: () =>
              showConfirmAlert(
                '返回大厅',
                '保留座位和设置，清除当前对局。',
                () => void submit('返回大厅', { type: 'avalon.game.returnToLobby' }),
              ),
          },
        ],
      },
    ],
  };
  const selection = profile.selection;
  const shellModel: RoomShellModel = {
    roomCode: room.roomCode,
    capabilities,
    header: {
      onBack: () => entryController.requestExit(capabilities.shouldConfirmExit),
      onTitlePress: titleActions.handleTitlePress,
      onTitleLongPress: titleActions.handleTitleLongPress,
      userAction: {
        user,
        ticketCount: gachaStatus ? gachaStatus.normalDraws + gachaStatus.goldenDraws : null,
        onPress: () => navigation.navigate('Settings', { roomCode: room.roomCode }),
      },
    },
    connection: entryController.connection,
    statusRibbon: createAvalonStatusRibbon(state),
    seats: {
      source: createAvalonSeatDataSource(
        state,
        snapshot.snapshot.revision,
        user.id,
        controlledSeat,
        pickedSeats,
      ),
      visuallyDisabled:
        state.isAudioPlaying || submission.isSubmitting || seatController.isSubmitting,
      onSeatPress,
      // 对齐其他有座位游戏：长按机器人座位接管/释放。
      onBotSeatLongPress: canControlBots ? onBotSeatLongPress : null,
    },
    seatConfirmation:
      seatController.pendingAction === null
        ? null
        : {
            action: seatController.pendingAction,
            isSubmitting: seatController.isSubmitting,
            onConfirm: seatController.confirm,
            onCancel: seatController.cancel,
          },
    profile:
      selection === null
        ? null
        : {
            target: selection.target,
            isSelf: selection.isSelf,
            onClose: profile.close,
            gameDetails: null,
            onKick:
              !selection.isSelf && capabilities.canKickSeat.isAllowed
                ? () => executeProfileKick(capabilities, selection)
                : null,
            onLeaveSeat: isLobby && selection.isSelf ? profile.leaveSelf : null,
          },
    share,
    bottomActions: (() => {
      const actions: Array<
        {
          readonly key: string;
          readonly label: string;
          readonly variant: 'primary' | 'secondary' | 'ghost';
          readonly size: 'lg' | 'md';
          readonly testID: string;
        } & (
          | { readonly isEnabled: true; readonly onPress: () => void }
          | {
              readonly isEnabled: false;
              readonly disabledReason: string | null;
              readonly onDisabledPress: (() => void) | null;
            }
        )
      > = [];
      // 查看身份：局内常驻（对齐狼人杀）。用 effectiveSeat：房主代打 bot 时也能看 bot 的身份。
      if (!isLobby && effectiveSeat !== null) {
        actions.push({
          key: 'viewRole',
          label: '查看身份',
          variant: 'secondary',
          size: 'md',
          isEnabled: true,
          onPress: () => {
            setRoleCardVisible(true);
            // 身份查看协议：打开角色卡即为当前座位落查看记录
            //（接管时是被接管座位；引擎幂等，终局后不发）。
            if (state.phase.kind !== 'ended' && !state.roleViewedSeats.includes(effectiveSeat)) {
              void submit('查看身份', { type: 'avalon.role.viewed' });
            }
          },
          testID: 'avalon-view-role',
        });
      }
      // 晚上：两步确认（底部按钮 → 弹窗），对齐狼人杀丘比特。
      if (!isLobby && state.phase.kind === 'night' && effectiveSeat !== null) {
        const vm = getAvalonViewModel(state, effectiveSeat);
        const instruction = resolveNightInstruction(vm);
        if (
          instruction.kind === 'evilPeers' ||
          instruction.kind === 'merlin' ||
          instruction.kind === 'percival'
        ) {
          actions.push(
            state.isAudioPlaying
              ? {
                  key: 'nightInfo',
                  label: '语音播报中…',
                  variant: 'primary',
                  size: 'md',
                  isEnabled: false as const,
                  disabledReason: '语音播报尚未结束，请稍候',
                  onDisabledPress: null,
                  testID: 'avalon-night-info',
                }
              : {
                  key: 'nightInfo',
                  label: '确认信息',
                  variant: 'primary',
                  size: 'md',
                  isEnabled: true as const,
                  onPress: () => setNightModalVisible(true),
                  testID: 'avalon-night-info',
                },
          );
        }
      }
      return {
        kind: 'info' as const,
        message: isLobby && !isHost && mySeat !== null ? '等待房主开始游戏' : null,
        actions,
      };
    })(),
    hostManagement: !isHost
      ? null
      : isLobby
        ? lobbyHostManagement
        : isTerminal
          ? terminalHostManagement
          : inGameHostManagement,
    controlledSeat: createControlledSeatModel({
      isVisible: isHost && canControlBots,
      controlledSeat,
      controlledBotName: controlledSeat !== null ? `座位 ${controlledSeat + 1}` : null,
      release: releaseBot,
      gameName: 'Avalon',
    }),
  };
  const hasAutoShownQR = useRef(false);
  const openShare = share.open;
  useEffect(() => {
    if (isHost && props.entryReason === 'created' && !hasAutoShownQR.current) {
      hasAutoShownQR.current = true;
      openShare();
    }
  }, [isHost, openShare, props.entryReason]);
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
    roleCardAllRoles: Object.entries(state.roles)
      .sort(([seatA], [seatB]) => Number(seatA) - Number(seatB))
      .map(([, roleId]) => toRevealRoleData(roleId)),
    // 晚上确认弹窗：两步流程（底部按钮 → 弹窗）。
    nightModalVisible,
    setNightModalVisible,
    setPickedSeats,
    setSeatPickHandler,
  };
}
