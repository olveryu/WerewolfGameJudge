/**
 * 组装共享房间控制器；阿瓦隆只负责阶段、机器人接管与开始游戏。
 */

import {
  type AvalonPublicCommand,
  type AvalonRoleId,
  type AvalonState,
  type AvalonViewModel,
  getAvalonOccupiedSeatCount,
  getAvalonUserSeat,
  getAvalonViewModel,
  isBotSeat,
} from '@game-judge/game-engine/games/avalon/public';
import { useIsFocused } from '@react-navigation/native';
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { RevealEffectType } from '@/features/room/components/RoleRevealEffects/types';
import { createRoomSeatPressHandler } from '@/features/room/controllers/createRoomSeatPressHandler';
import { useBotTakeover } from '@/features/room/controllers/useBotTakeover';
import {
  type ReadyRoomSession,
  useReadyRoomSession,
} from '@/features/room/controllers/useReadyRoomSession';
import { type RoleViewing, useRoleViewing } from '@/features/room/controllers/useRoleViewing';
import {
  type RoomAudioResume,
  useRoomAudioResume,
} from '@/features/room/controllers/useRoomAudioResume';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useRoomPresentationController } from '@/features/room/controllers/useRoomPresentationController';
import { useRoomSetupController } from '@/features/room/controllers/useRoomSetupController';
import { useStageDeadline } from '@/features/room/hooks/useStageDeadline';
import { isAudioPlaybackLocked } from '@/features/room/model/audioPlaybackLock';
import { resolveEquippedRevealEffect } from '@/features/room/model/resolveEquippedRevealEffect';
import type { RevealRoleData } from '@/features/room/model/RevealRoleData';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { RoomViewer } from '@/features/room/model/RoomViewer';
import { type AvalonRoomSession } from '@/games/avalon/model/AvalonRoomSession';

import type { AvalonAudioRuntime } from '../../audio/AvalonAudioPlayer';
import { toRevealRoleData } from '../../components/AvalonRoleCardAdapter';
import {
  createAvalonHostManagement,
  createAvalonRoomShellModel,
  getAvalonSeatTapIntent,
} from '../avalonRoomAdapter';
import { getAvalonRoomCommandFailureMessage } from '../avalonRoomCommandFailureMessage';
import type { AvalonTeamPickKind } from '../components/AvalonTeamPickModal';
import { useAvalonAudioOrchestration } from './useAvalonAudioOrchestration';
import { useAvalonBgmControl } from './useAvalonBgmControl';
import { type AvalonSeatPicking, useAvalonSeatPicking } from './useAvalonSeatPicking';

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
  readonly bgm: ReturnType<typeof useAvalonBgmControl>;
  /** 房主重连后的播报续播门（平台 useRoomAudioResume）。 */
  readonly audioResume: RoomAudioResume;
  readonly equippedRevealEffect: RevealEffectType | null;
  readonly submit: ReadyRoomSession<AvalonState, AvalonPublicCommand>['submit'];
  /** 组队选人弹窗开关：null 关闭，preselect / final 为两段 modal。 */
  readonly teamPickModal: AvalonTeamPickKind | null;
  readonly setTeamPickModal: (modal: AvalonTeamPickKind | null) => void;
  /**
   * 组队选人 modal 确认：先同步草稿（与服务端草稿同集时跳过派发），
   * 再按当前 modal 段发 preselect / propose；确认即关闭 modal。
   * 组队命令全链串行，下一笔等上一笔 followup 落定再发。
   */
  readonly confirmTeamPick: (seats: readonly number[]) => Promise<void>;
  readonly isSubmitting: boolean;
  readonly session: AvalonRoomSession;
  readonly openRules: () => void;
  /** 身份卡：先落查看记录、确认后再弹卡（平台 useRoleViewing）。 */
  readonly roleViewing: RoleViewing;
  /** 板子信息里点开的角色预览；与身份卡共用同一弹窗，无揭示动效。 */
  readonly rolePreviewId: AvalonRoleId | null;
  readonly setRolePreviewId: Dispatch<SetStateAction<AvalonRoleId | null>>;
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
  /** 提前刺杀选人模式：底部「刺杀」按钮开启，座位盘点选由 Screen 的 seatPickHandler 消费并打开刺杀二次确认。 */
  readonly strikePickMode: boolean;
  readonly setStrikePickMode: Dispatch<SetStateAction<boolean>>;
  /** 注册湖仙结果重开处理器（结果弹窗的已阅状态住在 Screen，adapter 底部入口经此触达）。 */
  readonly setLadyResultReopenHandler: (handler: (() => void) | null) => void;
  /** 对局中的座位盘点选（刺杀 / 湖仙）与其待确认目标。 */
  readonly seatPicking: AvalonSeatPicking;
}

/** 把当前就绪 session 绑定到房间壳控制器与命令上。 */
export function useAvalonRoomState(
  props: GameRoomScreenProps<'avalon'> & {
    readonly session: AvalonRoomSession;
    readonly entryController: RoomEntryController;
    readonly audio: AvalonAudioRuntime;
  },
  callbacks: {
    /** 本局复盘入口：Screen 持有复盘浮层开关，底部与主持管理共用它。 */
    readonly onReviewPress: () => void;
  },
): AvalonRoomScreenState {
  const { session, room, navigation, entryController, audio } = props;
  const { user, state, revision, submit, isSubmitting } = useReadyRoomSession(
    session,
    getAvalonRoomCommandFailureMessage,
  );
  const isHost = state.hostUserId === user.id;
  const isFocused = useIsFocused();
  const bgm = useAvalonBgmControl(isHost, state.phase.kind, state.isAudioPlaying);
  // 第一晚播报：房主按序播放服务端队列，播完 ack；重连后经续播门重放。
  const orchestration = useAvalonAudioOrchestration({ session, isHost, audio });
  const audioResume = useRoomAudioResume({
    isHost,
    isNarratedPhase: state.isAudioPlaying,
    isFocused,
    revision,
    readWasAudioInterrupted: orchestration.readWasAudioInterrupted,
    resume: orchestration.resumeAfterRejoin,
    onResumed: bgm.startBgmIfEnabled,
  });
  const mySeat = getAvalonUserSeat(state, user.id);
  const viewer: RoomViewer = { userId: user.id, isHost, seat: mySeat };
  const isLobby = state.phase.kind === 'lobby';
  const [rolePreviewId, setRolePreviewId] = useState<AvalonRoleId | null>(null);
  // 晚上确认：两步流程（底部按钮 → 弹窗），对齐狼人杀丘比特。
  const [nightModalVisible, setNightModalVisible] = useState(false);
  // 阶段弹窗开关（投票 / 出牌 / 湖仙确认）与提前刺杀选人模式：与夜晚确认
  // 同形态，开关住在 hook，底部动作区的入口与 Screen 共用同一状态。
  const [voteModalOpen, setVoteModalOpen] = useState(false);
  const [questModalOpen, setQuestModalOpen] = useState(false);
  const [ladyAckOpen, setLadyAckOpen] = useState(false);
  const [strikePickMode, setStrikePickMode] = useState(false);
  const ladyResultReopenRef = useRef<(() => void) | null>(null);
  const setLadyResultReopenHandler = useCallback((handler: (() => void) | null) => {
    ladyResultReopenRef.current = handler;
  }, []);
  // step 推进时重置弹窗状态，防止 stale（比如别人确认完推进了 step，自己开着的弹窗指令已失效）。
  const nightStep = state.phase.kind === 'night' ? state.phase.step : null;
  useEffect(() => {
    setNightModalVisible(false);
  }, [nightStep]);
  // 机器人接管：房主随时可接管（无阶段条件）；失去房主身份或座位不再是机器人时自动释放。
  const bots = useBotTakeover({
    viewer,
    isBotSeat: (seat) => isBotSeat(state.roster, seat),
    gameName: 'Avalon',
  });
  const { controlledSeat, effectiveSeat } = bots;
  const { share, titleActions, gachaStatus } = useRoomPresentationController({
    roomCode: room.roomCode,
    gameDisplayName: '阿瓦隆',
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
    hasOccupiedSeats: getAvalonOccupiedSeatCount(state) > 0,
    isRoomFull: getAvalonOccupiedSeatCount(state) === state.config.numberOfPlayers,
    configureGame: () =>
      navigation.navigate('GameConfig', {
        gameType: 'avalon',
        mode: 'edit',
        roomCode: room.roomCode,
      }),
    shareRoom: share.open,
  });
  // 身份查看协议：先落查看记录、服务端确认后再弹卡（接管时是被接管座位）。
  const roleViewing = useRoleViewing({
    effectiveSeat,
    identityKey: isLobby ? null : state.gameSequence,
    hasViewed:
      state.phase.kind === 'ended' ||
      (effectiveSeat !== null && state.roleViewedSeats.includes(effectiveSeat)),
    occupiedSeatCount: getAvalonOccupiedSeatCount(state),
    viewedSeatCount: state.roleViewedSeats.length,
    submitViewed: () => submit('查看身份', { type: 'avalon.role.viewed' }, { controlledSeat }),
  });
  // 组队选人 modal 开关：选人与确认都在 modal 里做（见 confirmTeamPick），
  // 板子点选已停用，不再有派生镜像覆盖草稿。
  const [teamPickModal, setTeamPickModal] = useState<AvalonTeamPickKind | null>(null);
  const lastTeamDraftDispatchRef = useRef<Promise<boolean> | null>(null);
  const submitTeamDraft = (seats: readonly number[]): Promise<boolean> => {
    // submission 是单飞锁：后一笔组队命令若与在飞的前一笔重叠，会被
    // 锁以「已有操作进行中」直接拒绝。故按发送顺序逐笔接续——等前一笔
    // 落定再发本笔，本笔返回值仍是它自己的派发结果；confirmTeamPick
    // 把 followup 也接进同一条链，下一笔等 followup 落定再发。
    const dispatchNow = () =>
      submit('更新草稿', { type: 'avalon.team.updateDraft', seats }, { controlledSeat });
    const previous = lastTeamDraftDispatchRef.current;
    const dispatch = previous === null ? dispatchNow() : previous.then(dispatchNow, dispatchNow);
    lastTeamDraftDispatchRef.current = dispatch;
    return dispatch;
  };
  // 投票/任务倒计时：结算的正确性由服务端定时投递保证（引擎武装倒计时的
  // 同时排下 avalon.settle.due，Worker 到点以系统身份内部结算）。客户端
  // 这条 expire 派发只是加速路径：抢先提交同一个超时结算，先到者生效。
  const phaseDeadlineAt =
    state.phase.kind === 'vote' || state.phase.kind === 'quest' ? state.phase.deadlineAt : null;
  // 超时结算走静默派发（对齐 drawguess 的 expire）：全场客户端会同时提交，
  // 先到者结算、其余被引擎阶段校验拒绝——拒绝是预期结果，绝不能弹错误框。
  const expirePhase = useCallback(async () => {
    if (state.phase.kind === 'vote') {
      await session.dispatch(
        { type: 'avalon.phase.expire' },
        { controlledSeat: null, label: '投票超时结算', durable: true },
      );
    } else if (state.phase.kind === 'quest') {
      await session.dispatch(
        { type: 'avalon.phase.expire' },
        { controlledSeat: null, label: '任务超时结算', durable: true },
      );
    }
  }, [state.phase.kind, session]);
  const shouldExpirePhase = useCallback(() => {
    if (phaseDeadlineAt === null || controlledSeat !== null) return false;
    const current = session.getSnapshot();
    return (
      current.phase === 'ready' &&
      current.status.kind === 'live' &&
      current.pendingDurableCount === 0 &&
      current.room.state.phaseRevision === state.phaseRevision
    );
  }, [phaseDeadlineAt, controlledSeat, session, state.phaseRevision]);
  const { remainingSeconds: phaseRemainingSeconds } = useStageDeadline({
    deadlineAt: phaseDeadlineAt,
    shouldExpire: shouldExpirePhase,
    onExpire: expirePhase,
    label: '阶段超时结算',
    silentExpire: true,
  });
  const capabilities: RoomCapabilities = {
    ...setupCapabilities,
    canTakeOverBots: bots.capability,
  };
  const viewModel = isLobby ? null : getAvalonViewModel(state, effectiveSeat);
  const seatPicking = useAvalonSeatPicking({ viewModel, strikePickMode, setStrikePickMode });
  // 对局中的座位点选（湖仙 / 刺杀选人）先于默认座位语义消费点按。
  const onSeatPress = createRoomSeatPressHandler({
    isSetup: isLobby,
    inGameAction: seatPicking.handleSeatTap,
    state,
    currentSeat: mySeat,
    resolveIntent: getAvalonSeatTapIntent,
    profile,
    seatController,
  });
  const buildHostManagement = () =>
    createAvalonHostManagement({
      state,
      capabilities,
      isSubmitting,
      controlledSeat,
      releaseBot: bots.release,
      onReviewPress: callbacks.onReviewPress,
      onMusicSettings: () => {
        bgm.stopBgm();
        navigation.navigate('MusicSettings', { roomCode: room.roomCode });
      },
      submit,
    });

  const selection = profile.selection;
  // 组队选人 modal 确认：先同步草稿（与服务端草稿同集时跳过），再按
  // 当前 modal 段发 preselect / propose。组队命令全链串行：followup
  // 返回 submit 链、链尾记回 ref，下一笔组队命令等上一笔 followup
  // 落定再发，免得被单飞锁以「已有操作进行中」拒绝；草稿被拒时
  // followup 照常发出，由引擎校验承接。
  const confirmTeamPick = (seats: readonly number[]): Promise<void> => {
    const kind = teamPickModal;
    setTeamPickModal(null);
    if (kind === null || state.phase.kind !== 'nominate') return Promise.resolve();
    const serverDraft = state.phase.draftSeats;
    const sameSet =
      serverDraft.length === seats.length && seats.every((seat) => serverDraft.includes(seat));
    const followup = () =>
      submit(
        kind === 'preselect' ? '预选队伍' : '提交队伍',
        kind === 'preselect' ? { type: 'avalon.team.preselect' } : { type: 'avalon.team.propose' },
        { controlledSeat },
      );
    const previous = lastTeamDraftDispatchRef.current;
    const chained = sameSet
      ? previous === null
        ? followup()
        : previous.then(followup, followup)
      : submitTeamDraft(seats).then(followup, followup);
    lastTeamDraftDispatchRef.current = chained;
    return chained.then(() => undefined);
  };
  const shellModel: RoomShellModel = createAvalonRoomShellModel({
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
    seatsVisuallyDisabled:
      isAudioPlaybackLocked(state.isAudioPlaying) || isSubmitting || seatController.isSubmitting,
    onSeatPress,
    onBotSeatLongPress: bots.capability.isAllowed ? bots.onBotSeatLongPress : null,
    seatController,
    profileSelection: selection,
    onProfileClose: profile.close,
    onProfileLeaveSeat: profile.leaveSelf,
    share,
    isLobby,
    effectiveSeat,
    onViewRolePress: roleViewing.open,
    onNightInfoPress: () => setNightModalVisible(true),
    isSubmitting,
    settleCountdownSeconds: phaseRemainingSeconds,
    onOpenVotePress: () => setVoteModalOpen(true),
    onOpenQuestPress: () => setQuestModalOpen(true),
    // 两段式组队入口：底部按钮只打开选人 modal，选人与确认都在
    // modal 里做（见 confirmTeamPick）；板子点选已停用。
    onPreselectTeamPress: () => setTeamPickModal('preselect'),
    onProposeTeamPress: () => setTeamPickModal('final'),
    onLadyAcknowledgePress: () => setLadyAckOpen(true),
    onLadyResultPress: () => ladyResultReopenRef.current?.(),
    onEarlyStrikePress: () => setStrikePickMode(true),
    onReviewPress: callbacks.onReviewPress,
    strikePickMode,
    onCancelEarlyStrikePress: () => setStrikePickMode(false),
    buildHostManagement,
    releaseBot: bots.release,
  });
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
    equippedRevealEffect: resolveEquippedRevealEffect(user.equippedEffect, room.roomCode, user.id),
    bgm,
    audioResume,
    phaseRemainingSeconds,
    submit,
    teamPickModal,
    setTeamPickModal,
    confirmTeamPick,
    isSubmitting,
    session,
    openRules: () =>
      navigation.navigate('GameGuide', { gameType: 'avalon', roomCode: room.roomCode }),
    roleViewing,
    rolePreviewId,
    setRolePreviewId,
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
    seatPicking,
  };
}
