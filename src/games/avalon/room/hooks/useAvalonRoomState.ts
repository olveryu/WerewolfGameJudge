/**
 * 组装共享房间控制器；阿瓦隆只负责阶段、机器人接管、开始游戏与房主手动结算。
 */

import {
  type AvalonCommand,
  type AvalonRoleId,
  getAvalonOccupiedSeatCount,
  getAvalonViewModel,
} from '@game-judge/game-engine/games/avalon/public';
import { useEffect, useRef, useState } from 'react';

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
import { type AvalonRoomSession, getAvalonUserSeat } from '@/games/avalon/model/AvalonRoomSession';
import { TESTIDS } from '@/testids';
import { showAlert } from '@/utils/alert';
import { showConfirmAlert, showErrorAlert } from '@/utils/alertPresets';

import type { AvalonAudioRuntime } from '../../audio/AvalonAudioPlayer';
import {
  createAvalonSeatDataSource,
  createAvalonStatusRibbon,
  getAvalonProfileTarget,
} from '../avalonRoomAdapter';
import { getAvalonRoomCommandFailureMessage } from '../avalonRoomCommandFailureMessage';
import { resolveNightInstruction } from '../policy/avalonInteractionPolicy';
import { useAvalonAudioOrchestration } from './useAvalonAudioOrchestration';
import { useAvalonSeatCommands } from './useAvalonSeatCommands';

/** 机器人可被接管的阶段：大厅与终局除外（D12：机制保留，不做接管提示）。 */
function canControlBotsInPhase(phaseKind: string): boolean {
  return (
    phaseKind === 'night' ||
    phaseKind === 'nominate' ||
    phaseKind === 'vote' ||
    phaseKind === 'quest' ||
    phaseKind === 'lady' ||
    phaseKind === 'assassin'
  );
}

/** 把当前就绪 session 绑定到房间壳控制器与命令上。 */
export function useAvalonRoomState(
  props: GameRoomScreenProps<'avalon'> & {
    readonly session: AvalonRoomSession;
    readonly entryController: RoomEntryController;
    readonly audio: AvalonAudioRuntime;
  },
) {
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
  const submit = (label: string, command: AvalonCommand) =>
    submission.submit(label, () => session.dispatch(command, { controlledSeat, label }));
  // 机器人席位仅房主可接管；离开可接管阶段自动释放。
  const canControlBots = isHost && canControlBotsInPhase(state.phase.kind);
  useEffect(() => {
    if (controlledSeat !== null && !canControlBots) releaseBot();
  }, [canControlBots, controlledSeat, releaseBot]);
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
      : { isAllowed: false, reason: '当前不能接管机器人' },
  };
  const onSeatPress = (seat: number) => {
    if (!isLobby) {
      // 狼人杀模式：房主点机器人座位接管/释放，不改变界面（D12 不做任何接管提示）。
      if (canControlBots) {
        const inGameTarget = getAvalonProfileTarget(state, seat);
        if (inGameTarget?.occupantKind === 'bot') {
          if (controlledSeat === seat) releaseBot();
          else takeOver(seat);
          return;
        }
      }
      return showErrorAlert('不可选择', '游戏进行中不能调整座位');
    }
    const target = getAvalonProfileTarget(state, seat);
    if (target?.occupantKind === 'bot')
      return showAlert(target.rosterName, '请选择对该机器人座位的操作', [
        { text: '取消', style: 'cancel' },
        { text: '查看资料', onPress: () => profile.open(target) },
        {
          text: '替换机器人入座',
          onPress: () =>
            mySeat === null
              ? seatController.requestTakeSeat(seat)
              : seatController.requestMoveSeat(seat),
        },
      ]);
    if (target !== null) return profile.open(target);
    return mySeat === null
      ? seatController.requestTakeSeat(seat)
      : seatController.requestMoveSeat(seat);
  };
  const roomActions: RoomHostManagementAction[] = [];
  if (capabilities.canConfigureGame.isAllowed)
    roomActions.push({
      key: 'configure',
      label: '房间设置',
      icon: 'options-outline',
      variant: 'secondary',
      isEnabled: true,
      onPress: capabilities.canConfigureGame.execute,
    });
  if (capabilities.canFillBots.isAllowed)
    roomActions.push({
      key: 'fill',
      label: '填充机器人',
      icon: 'people-outline',
      variant: 'secondary',
      isEnabled: true,
      onPress: capabilities.canFillBots.execute,
      testID: TESTIDS.roomFillBotsButton,
    });
  if (capabilities.canClearSeats.isAllowed)
    roomActions.push({
      key: 'clear',
      label: '清空座位',
      icon: 'trash-outline',
      variant: 'danger',
      isEnabled: true,
      onPress: capabilities.canClearSeats.execute,
    });
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
                    '未投票的座位将视为弃权，确定结束投票并结算吗？',
                    () => void submit('结束投票', { type: 'avalon.vote.finish' }),
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
                    '未出牌的队员将视为成功，确定提前结算吗？',
                    () => void submit('结束任务', { type: 'avalon.quest.finish' }),
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
      ),
      visuallyDisabled:
        state.isAudioPlaying || submission.isSubmitting || seatController.isSubmitting,
      onSeatPress,
      // 狼人杀模式用点选接管，长按入口已移除。
      onBotSeatLongPress: null,
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
              isHost && isLobby && !selection.isSelf
                ? () => profile.kick(selection.target.seat)
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
          onPress: () => setRoleCardVisible(true),
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
    // D12：不做任何关于 bot 接管的提示——不渲染受控席位 banner。
    // 释放：房主点已接管的机器人座位即可释放（狼人杀模式）。
    controlledSeat: null,
  };
  const hasAutoShownQR = useRef(false);
  const openShare = share.open;
  useEffect(() => {
    if (isHost && props.entryReason === 'created' && !hasAutoShownQR.current) {
      hasAutoShownQR.current = true;
      openShare();
    }
  }, [isHost, openShare, props.entryReason]);
  return {
    state,
    shellModel,
    roomCode: room.roomCode,
    userId: user.id,
    mySeat,
    effectiveSeat,
    controlledSeat,
    isHost,
    canControlBots,
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
    // 晚上确认弹窗：两步流程（底部按钮 → 弹窗）。
    nightModalVisible,
    setNightModalVisible,
  };
}
