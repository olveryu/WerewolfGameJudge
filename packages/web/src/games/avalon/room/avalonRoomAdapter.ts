/**
 * 把阿瓦隆权威状态投影到共享座位表与房间壳模型，不暴露私密信息。
 */

import {
  AVALON_BOARDS,
  AVALON_NIGHT_STEPS,
  type AvalonNightStep,
  type AvalonPhaseKind,
  type AvalonPublicCommand,
  type AvalonRoleId,
  type AvalonState,
  type AvalonViewModel,
  getAvalonNightParticipants,
  getAvalonOccupiedSeatCount,
  getAvalonUserSeat,
  getAvalonViewingParticipants,
  getAvalonViewModel,
  isAvalonPlayerCount,
  isBotSeat,
} from '@game-judge/game-engine/games/avalon/public';

import type { RoomProfileSelection } from '@/features/room/controllers/useRoomProfileController';
import type { RoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import { applyAudioPlaybackLock } from '@/features/room/model/audioPlaybackLock';
import type { BoardInfoSection, RoleDisplayItem } from '@/features/room/model/BoardInfoSection';
import { createControlledSeatModel } from '@/features/room/model/createControlledSeatModel';
import { createRoomProfileCardModel } from '@/features/room/model/createRoomProfileCardModel';
import { createRoomSeatConfirmationModel } from '@/features/room/model/createRoomSeatConfirmationModel';
import { createRoomSeatDataSource } from '@/features/room/model/createRoomSeatDataSource';
import {
  createRoomShellModel,
  type RoomShellModelInput,
} from '@/features/room/model/createRoomShellModel';
import { getRoomProfileTarget } from '@/features/room/model/getRoomProfileTarget';
import {
  allViewedConfirmBody,
  buildAssignRolesAction,
  buildClearSeatsAction,
  buildFillBotsAction,
  buildMarkBotsViewedAction,
  buildMusicSettingsAction,
  buildPendingAwareHostAction,
  buildResetToLobbyAction,
  buildRoomConfigAction,
  buildStartGameAction,
  createViewingBeginGate,
  HOST_ACTION_KEYS,
  HOST_FLOW_CONFIRM,
  hostActionTask,
  projectViewingProgress,
  seatShortageReason,
  viewedProgressReason,
} from '@/features/room/model/hostManagementActions';
import { type NightStepProgress, resolveStepProgress } from '@/features/room/model/nightProgress';
import type { RoomHostAction, RoomPlayerAction } from '@/features/room/model/RoomAction';
import type { RoomCapabilities, RoomProfileTarget } from '@/features/room/model/RoomCapabilities';
import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';
import type { RoomPlayerActionModel } from '@/features/room/model/RoomPlayerActions';
import {
  buildEndedWaitingMessage,
  buildViewIdentityButton,
  resolveViewIdentityAction,
  VIEW_IDENTITY_LABEL,
} from '@/features/room/model/RoomPlayerActions';
import type { RoomProfileCardModel } from '@/features/room/model/RoomProfile';
import type {
  RoomSeatDataSource,
  RoomSeatHighlight,
  RoomSeatIndicators,
  RoomSeatMarker,
} from '@/features/room/model/RoomSeatDataSource';
import { createRoomSeatTapIntentResolver } from '@/features/room/model/RoomSeatTap';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { RoomViewer } from '@/features/room/model/RoomViewer';
import {
  buildReviewHostAction,
  buildViewerReviewBottomButtons,
  type RoomReviewEntry,
} from '@/features/room/review/roomReviewActions';
import { TESTIDS } from '@/testids';
import { showConfirmAlert, showDestructiveAlert } from '@/utils/alertPresets';

import { getAvalonRoleDisplayName } from '../model/avalonRoleDisplay';
import { getAvalonRoleMeta } from '../model/avalonRoleMeta';
import {
  formatAvalonQuestLabel,
  resolveAssassinInstruction,
  resolveLadyInstruction,
  resolveNightInstruction,
  resolveNominateInstruction,
  resolveQuestInstruction,
  resolveVoteInstruction,
} from './policy/avalonInteractionPolicy';

/** 「N 号 · 名字」座位称呼（与阶段组件原口径一致），名字读名册记录。 */
function avalonSeatLabel(state: AvalonState, seat: number): string {
  const name = getAvalonProfileTarget(state, seat)?.rosterName ?? `座位${seat + 1}`;
  return `${seat + 1} 号 · ${name}`;
}

/** 为共享资料卡控件返回公开的席位身份。 */
const getAvalonProfileTarget = (state: AvalonState, seat: number): RoomProfileTarget | null =>
  getRoomProfileTarget(state.roster, seat);

/**
 * 组队者与湖仙徽标的阶段门：两者只在白天流程中有职能（组队 / 投票 /
 * 任务 / 湖仙 / 刺杀），只在这些阶段显示。身份查看与夜晚显示它们是
 * 阶段信息串扰（与查看勾只属于查看阶段同类命题）；大厅未定、终局无
 * 职能，同样不显示。穷尽映射逐阶段表态，新增阶段必须在此显式决定。
 */
const AVALON_DAY_BADGE_PHASES: Readonly<Record<AvalonPhaseKind, boolean>> = {
  lobby: false,
  viewing: false,
  night: false,
  nominate: true,
  vote: true,
  voteResult: true,
  quest: true,
  questResult: true,
  lady: true,
  assassin: true,
  ended: false,
};

function avalonSeatIndicators(
  state: AvalonState,
  seat: number,
  progressLabel: string | null,
): RoomSeatIndicators | null {
  const phase = state.phase;
  if (phase.kind === 'lobby') return null;
  const isDay = AVALON_DAY_BADGE_PHASES[phase.kind];
  const isPicker = isDay && state.leaderSeat === seat;
  const isTeamMember =
    ((phase.kind === 'vote' || phase.kind === 'voteResult') &&
      phase.proposedSeats.includes(seat)) ||
    (phase.kind === 'quest' && phase.teamSeats.includes(seat));
  const isPreselected = phase.kind === 'nominate' && phase.preselectedSeats.includes(seat);
  const markers: RoomSeatMarker[] = [];
  if (isPicker)
    markers.push({
      key: 'leader',
      label: '组队者',
      tone: 'warning',
    });
  if (isDay && state.ladyHolderSeat === seat)
    markers.push({
      key: 'lady',
      label: '湖仙',
      tone: 'info',
    });
  return {
    markers,
    selection: isTeamMember
      ? { kind: 'selected', label: '队员' }
      : isPreselected
        ? { kind: 'preselected', label: '预选' }
        : null,
    progressLabel,
  };
}

function avalonNightRevealHighlight(
  view: AvalonViewModel,
  seat: number,
): RoomSeatHighlight | undefined {
  if (view.nightConfirmed) return undefined;
  if (view.evilPeers?.includes(seat) || view.merlinSees?.includes(seat)) return 'danger';
  if (view.percivalSees?.includes(seat)) return 'info';
  return undefined;
}

/** 创建共享座位表数据源：含组队者 / 队员 / 湖仙状态徽标（不暴露角色）。 */
export interface AvalonSeatSourceInput {
  readonly state: AvalonState;
  readonly revision: number;
  readonly userId: string;
  readonly controlledSeat: number | null;
}

/** Project Avalon seating into the shared room seat-tap contract. */
export const getAvalonSeatTapIntent = createRoomSeatTapIntentResolver(getAvalonProfileTarget);

export function createAvalonSeatDataSource(input: AvalonSeatSourceInput): RoomSeatDataSource {
  const { state, revision, userId, controlledSeat } = input;
  // 夜晚已确认徽标只给当前步参与者看（私密确认不计数、不外泄给非参与者）。
  const nightPhase = state.phase.kind === 'night' ? state.phase : null;
  const ownSeat = getAvalonUserSeat(state, userId) ?? undefined;
  const viewerSeat = controlledSeat ?? ownSeat;
  const stepParticipants =
    nightPhase === null ? [] : getAvalonNightParticipants(state.roles, nightPhase.step);
  const viewerIsStepParticipant = viewerSeat !== undefined && stepParticipants.includes(viewerSeat);
  const nightView =
    nightPhase !== null && viewerSeat !== undefined ? getAvalonViewModel(state, viewerSeat) : null;
  return createRoomSeatDataSource({
    seatCount: state.config.numberOfPlayers,
    revision,
    roster: state.roster,
    viewerUserId: userId,
    controlledSeat,
    isLobby: state.phase.kind === 'lobby',
    gameName: 'Avalon',
    resolveSecondaryLabel: (seat, player) => {
      // 角色状态虽公开广播，bot 身份副标签仍只给房主显示（D6-Q1）。
      const botRole =
        state.hostUserId === userId && player?.occupant.kind === 'bot'
          ? state.roles[seat]
          : undefined;
      return botRole !== undefined ? getAvalonRoleDisplayName(botRole) : null;
    },
    // 逐座位已查看身份徽标（公开信息）：勾只属于查看阶段——对局开始
    // （begin 进夜晚）即清（展示契约 §3.3 徽标命题，与狼人杀口径一致）。
    resolveShowReadyBadge: (seat) =>
      state.phase.kind === 'viewing' && state.roleViewedSeats.includes(seat),
    resolveHighlight: (seat) =>
      seat !== controlledSeat && nightView !== null
        ? avalonNightRevealHighlight(nightView, seat)
        : undefined,
    resolveIndicators: (seat) => {
      const nightConfirmed =
        nightPhase !== null && viewerIsStepParticipant && nightPhase.confirmedSeats.includes(seat);
      const progressLabel = nightConfirmed ? '已确认' : null;
      return avalonSeatIndicators(state, seat, progressLabel);
    },
  });
}

const AVALON_NIGHT_STEP_LABELS: Readonly<Record<AvalonNightStep, string>> = {
  evilReveal: '坏人互认',
  merlinReveal: '梅林的视野',
  percivalReveal: '派西维尔的视野',
};

/**
 * 夜晚步进进度（底部细进度行的数据）：与狼人杀同形，共享步进派生
 * （第x步/共y步 + 步名）。私密确认进度由逐座位徽标呈现（仅参与者
 * 可见），进度行不计数。非夜晚阶段为 null。
 */
export function deriveAvalonBottomProgress(state: AvalonState): NightStepProgress | null {
  if (state.phase.kind !== 'night') return null;
  return resolveStepProgress(AVALON_NIGHT_STEPS, state.phase.step, AVALON_NIGHT_STEP_LABELS);
}

/** 最新一次任务结算的结论句；尚无任务结算时为 null。 */
function avalonLatestQuestConclusion(state: AvalonState): string | null {
  for (let index = state.roundHistory.length - 1; index >= 0; index -= 1) {
    const record = state.roundHistory[index]!;
    if (record.quest === null) continue;
    const quest = record.quest;
    return quest.result === 'success'
      ? `${formatAvalonQuestLabel(record.round)} · 成功（成功牌 ${quest.successCount}）`
      : `${formatAvalonQuestLabel(record.round)} · 失败（失败牌 ${quest.failCount}）`;
  }
  return null;
}

/**
 * 对局摘要文案：最新结算结论优先，其次当前轮次状态句。仅在白天及终局
 * 返回摘要；大厅、身份查看和夜晚阶段不显示。只读公开信息，不含身份。
 */
export function createAvalonHistorySummary(state: AvalonState): string | null {
  const phase = state.phase;
  switch (phase.kind) {
    case 'lobby':
    case 'viewing':
    case 'night':
      return null;
    case 'ended':
      return phase.winner === 'good' ? '本局结束 · 好人获胜' : '本局结束 · 坏人获胜';
    case 'assassin':
      return avalonLatestQuestConclusion(state) ?? '刺杀阶段';
    case 'lady':
      return (
        avalonLatestQuestConclusion(state) ??
        `${formatAvalonQuestLabel(phase.afterRound)} · 湖中仙女查验`
      );
    case 'nominate':
    case 'vote':
    case 'voteResult':
    case 'quest': {
      const round = phase.round;
      const questLabel = formatAvalonQuestLabel(round);
      const record = state.roundHistory.find((candidate) => candidate.round === round);
      // 本轮已有提案结算（否决后回到组队、或通过后任务进行中）：
      // 最新结算就是这次投票结论。
      const vote = record?.proposals.at(-1);
      if (vote !== undefined) {
        if (vote.automatic) return `${questLabel} · 队伍自动通过`;
        return `${questLabel} · ${vote.approved ? '队伍通过' : '提案被否决'}（赞成 ${vote.approveCount} · 反对 ${vote.rejectCount}）`;
      }
      // 本轮尚无提案结算时，最新结算是上一轮的任务结论。
      if (record === undefined) {
        const conclusion = avalonLatestQuestConclusion(state);
        if (conclusion !== null) return conclusion;
      }
      if (phase.kind === 'nominate') {
        const attempt = (record?.proposals.length ?? 0) + 1;
        return `${questLabel} · 第${attempt}次提案 · 组队者组队中`;
      }
      if (phase.kind === 'vote') {
        const attempt = (record?.proposals.length ?? 0) + 1;
        return `${questLabel} · 第${attempt}次提案投票中`;
      }
      return `${questLabel} · 任务执行中`;
    }
    case 'questResult':
      return avalonLatestQuestConclusion(state);
  }
}

/** 当前阶段，不以最近一次结算替代正在进行的操作。 */
export function createAvalonCurrentStatus(state: AvalonState): string | null {
  const phase = state.phase;
  switch (phase.kind) {
    case 'lobby':
    case 'viewing':
    case 'night':
      return null;
    case 'nominate':
      return '组队进行中';
    case 'vote':
      return '提案投票中';
    case 'voteResult':
      return '投票结果确认中';
    case 'quest':
      return '任务执行中';
    case 'questResult':
      return '任务结果确认中';
    case 'lady':
      return '湖中仙女查验中';
    case 'assassin':
      return '刺杀阶段';
    case 'ended':
      return phase.winner === 'good' ? '好人获胜' : '坏人获胜';
  }
}

/**
 * 把棋盘按阵营分组成板子信息分组（坏人 / 好人，忠臣归好人）；
 * 人数不在棋盘表内时返回 null（卡片不渲染）。
 */
export function createAvalonBoardInfoSections(
  playerCount: number,
): readonly BoardInfoSection[] | null {
  if (!isAvalonPlayerCount(playerCount)) return null;
  const board = AVALON_BOARDS[playerCount];
  const toItems = (roles: readonly AvalonRoleId[]): RoleDisplayItem[] => {
    const counts = new Map<AvalonRoleId, number>();
    for (const roleId of roles) counts.set(roleId, (counts.get(roleId) ?? 0) + 1);
    return [...counts.entries()].map(([roleId, count]) => ({
      roleId,
      displayName: getAvalonRoleDisplayName(roleId),
      count,
    }));
  };
  return [
    {
      title: '坏人',
      items: toItems(board.filter((roleId) => getAvalonRoleMeta(roleId).isEvil)),
      color: 'var(--color-wolf)',
    },
    {
      title: '好人',
      items: toItems(board.filter((roleId) => !getAvalonRoleMeta(roleId).isEvil)),
      color: 'var(--color-god)',
    },
  ];
}

const AVALON_ROLE_ID_SET: ReadonlySet<string> = new Set(Object.values(AVALON_BOARDS).flat());

/** 共享板子卡以 string 回报 roleId；用棋盘全集把有效值压回 AvalonRoleId。 */
export function isAvalonRoleId(roleId: string): roleId is AvalonRoleId {
  return AVALON_ROLE_ID_SET.has(roleId);
}

export interface AvalonBottomActionsInput {
  readonly state: AvalonState;
  readonly isLobby: boolean;
  readonly viewer: RoomViewer;
  /** The seat the viewer acts as (own or taken-over bot); null for a spectator. */
  readonly effectiveSeat: number | null;
  readonly isSubmitting: boolean;
  /** 机器人接管能力（房主）：决定「长按接管后投票」类引导文案。 */
  readonly canTakeOverBots: boolean;
  /** 投票/出牌结算倒计时剩余秒数（screen 的 tick 派生）；未武装为 null。 */
  readonly settleCountdownSeconds: number | null;
  readonly onViewRolePress: () => void;
  readonly onNightInfoPress: () => void;
  readonly onOpenVotePress: () => void;
  readonly onOpenQuestPress: () => void;
  readonly onPreselectTeamPress: () => void;
  readonly onProposeTeamPress: () => void;
  readonly onEarlyStrikePress: () => void;
  /** 本局复盘入口（平台 useRoomReview）：终局时存在，底部按钮与主持管理共用；终局前为 null。 */
  readonly review: RoomReviewEntry | null;
  /** 提前刺杀选人模式（本地 UI 状态）：开启时底部区独占为座位盘点选提示 + 取消入口。 */
  readonly strikePickMode: boolean;
  readonly onCancelEarlyStrikePress: () => void;
}

/**
 * 阿瓦隆底部动作区：全游戏个人动作与个人指令的唯一落点（落点总规则）——
 * 查看身份局内常驻；夜晚信息步两步确认（按钮 → 弹窗）；白天各阶段的主按钮
 * （预选队伍 / 最终队伍 / 去投票 / 去出牌 / 查看查验请求）与个人状态走 message；
 * 夜晚步进走底部细进度行、公开阶段状态归摘要条、逐座状态归座位盘、
 * 一次性信息归弹窗。
 */
function createAvalonPlayerActions(input: AvalonBottomActionsInput): RoomPlayerActionModel {
  const { state } = input;
  const primary: RoomPlayerAction[] = [];
  const secondary: RoomPlayerAction[] = [];
  const ghost: RoomPlayerAction[] = [];
  let message: string | null = null;
  if (input.isLobby) {
    // 大厅客人等分配（个人提示）；房主走房主面板。
    if (!input.viewer.isHost && input.viewer.seat !== null) message = '等待房主分配角色';
    return { message, progress: null, actions: [...primary, ...secondary, ...ghost], group: null };
  }
  // 查看身份：局内常驻（对齐狼人杀）。用 effectiveSeat：房主代打 bot 时也能看 bot 的身份。
  const isViewingStep = state.phase.kind === 'viewing';
  const viewIdentityAction = resolveViewIdentityAction({
    isVisible: input.effectiveSeat !== null,
    label: VIEW_IDENTITY_LABEL,
    onPress: input.onViewRolePress,
  });
  if (viewIdentityAction !== null) {
    secondary.push(
      buildViewIdentityButton(viewIdentityAction, {
        isSubmitting: input.isSubmitting,
        key: 'viewRole',
        audience: 'participant',
        testID: TESTIDS.roomViewIdentityButton,
        isPending:
          isViewingStep &&
          input.effectiveSeat !== null &&
          !state.roleViewedSeats.includes(input.effectiveSeat),
      }),
    );
  }
  const phase = state.phase;
  if (phase.kind === 'viewing') {
    // 查看阶段本人未看时提示去看（展示契约 self-hint 态，只走这一处出口）。
    if (input.effectiveSeat !== null && !state.roleViewedSeats.includes(input.effectiveSeat)) {
      message = '请点击下方「查看身份」，查看你的角色';
    }
    return { message, progress: null, actions: [...primary, ...secondary, ...ghost], group: null };
  }
  if (phase.kind === 'night') {
    // 晚上：两步确认（底部按钮 → 弹窗），对齐狼人杀丘比特。
    if (input.effectiveSeat !== null) {
      const vm = getAvalonViewModel(state, input.effectiveSeat);
      const instruction = resolveNightInstruction(vm);
      if (instruction.kind === 'waiting' || instruction.kind === 'confirmed') {
        // 非本步参与者与已确认者：等本步其余参与者确认（步名归进度行，
        // 此处只给等待对象，不复述步名）。
        message = '等待本步玩家确认';
      }
      if (
        instruction.kind === 'evilPeers' ||
        instruction.kind === 'merlin' ||
        instruction.kind === 'percival'
      ) {
        // 确认与播报并行：音频播放中也保持可用（引擎完成评估与确认、
        // ack 的到达顺序无关，见 E3 §5b）；不再换成禁用占位等播报结束。
        primary.push({
          key: 'nightInfo',
          label: '确认信息',
          audience: 'participant',
          category: 'player',
          isPending: true,
          state: { kind: 'ready', onPress: input.onNightInfoPress },
          testID: TESTIDS.avalonNightInfo,
        });
      }
    }
    return {
      message,
      progress: deriveAvalonBottomProgress(state),
      actions: [...primary, ...secondary, ...ghost],
      group: null,
    };
  }
  const vm = getAvalonViewModel(state, input.effectiveSeat);
  // 提前刺杀：刺客个人常驻动作（不属于房主管理），白天阶段与阶段主按钮并存。
  if (vm.canEarlyStrike) {
    if (input.strikePickMode) {
      // 选人模式独占底部区（对齐原选人弹窗对其他交互的阻断）：只留取消
      // 入口与座位盘点选提示；点选由 Screen 的 seatPickHandler 消费，选中
      // 后开刺杀二次确认。查看身份是局内常驻个人动作，已在上方入列。
      secondary.push({
        key: 'earlyStrike',
        label: '取消刺杀',
        audience: 'participant',
        category: 'player',
        state: { kind: 'ready', onPress: input.onCancelEarlyStrikePress },
        testID: TESTIDS.avalonEarlyStrike,
      });
      message =
        '点座位盘点选一名玩家进行提前刺杀（除自己外任意座位），点选后会再次确认。刺中梅林坏人直接获胜，刺错好人直接获胜。';
      return {
        message,
        progress: null,
        actions: [...primary, ...secondary, ...ghost],
        group: null,
      };
    }
    secondary.push({
      key: 'earlyStrike',
      label: '刺杀',
      audience: 'participant',
      category: 'player',
      state: { kind: 'ready', onPress: input.onEarlyStrikePress },
      testID: TESTIDS.avalonEarlyStrike,
    });
  }
  switch (phase.kind) {
    case 'nominate': {
      const instruction = resolveNominateInstruction(vm, vm.mySeat);
      // 两段式组队（引擎规则）：按钮阶段由服务端预选记录驱动——
      // 未预选时主按钮是「预选队伍」，预选回声到后翻成「最终队伍」；
      // 选人与确认都在 modal 里做（满员门在 modal 确认按钮上），
      // 底部按钮只负责打开 modal，不再按草稿满员设门。
      const preselected = vm.preselectedSeats !== null && vm.preselectedSeats.length > 0;
      if (instruction.isLeader) {
        if (!preselected) {
          message = `点「预选队伍」打开选人，在里面选 ${instruction.requiredSize} 名队员，确认后全房可见。`;
          if (!input.isSubmitting) {
            primary.push({
              key: 'preselectTeam',
              label: '预选队伍',
              audience: 'participant',
              category: 'player',
              isPending: true,
              state: { kind: 'ready', onPress: input.onPreselectTeamPress },
              testID: TESTIDS.avalonNominatePreselect,
            });
          } else {
            primary.push({
              key: 'preselectTeam',
              label: '预选队伍',
              audience: 'participant',
              category: 'player',
              isPending: true,
              state: { kind: 'busy' },
              testID: TESTIDS.avalonNominatePreselect,
            });
          }
        } else {
          message = '预选已确认，点「最终队伍」打开选人调整最终队伍。';
          if (!input.isSubmitting) {
            primary.push({
              key: 'proposeTeam',
              label: '最终队伍',
              audience: 'participant',
              category: 'player',
              isPending: true,
              state: { kind: 'ready', onPress: input.onProposeTeamPress },
              testID: TESTIDS.avalonNominateSubmit,
            });
          } else {
            primary.push({
              key: 'proposeTeam',
              label: '最终队伍',
              audience: 'participant',
              category: 'player',
              isPending: true,
              state: { kind: 'busy' },
              testID: TESTIDS.avalonNominateSubmit,
            });
          }
        }
      } else {
        message = preselected
          ? '队长已预选，正在定最终队伍。'
          : `等待组队者组队（${instruction.leaderSeat + 1} 号座位），本轮需要 ${instruction.requiredSize} 名队员。`;
      }
      break;
    }
    case 'vote': {
      const instruction = resolveVoteInstruction(vm);
      if (instruction.canVote) {
        primary.push({
          key: 'openVote',
          label: instruction.myBallot === null ? '去投票' : '修改投票',
          audience: 'participant',
          category: 'player',
          isPending: instruction.myBallot === null,
          state: { kind: 'ready', onPress: input.onOpenVotePress },
          testID: TESTIDS.avalonVoteOpen,
        });
      }
      // 未投票名单全房公开：计数 + 未投票行，人人可见（不再只给已投票者看个人票）。
      // 已投计数与引擎视图层 AvalonCurrentProposalView 同一派生（只数已投人数、永不归名，
      // 与暗投口径一致）；个人票仍只在弹窗里看。
      message =
        phase.deadlineAt !== null &&
        input.settleCountdownSeconds !== null &&
        input.settleCountdownSeconds > 0
          ? `已全部投票，${input.settleCountdownSeconds} 秒后揭晓`
          : vm.pendingVoteSeats !== null && vm.pendingVoteSeats.length > 0
            ? `已投 ${Object.keys(phase.ballots).length}/${getAvalonOccupiedSeatCount(state)}`
            : null;
      if (message === null && !instruction.canVote) {
        message = input.canTakeOverBots ? '长按机器人座位接管后投票。' : '你不在座位上，无法投票。';
      }
      break;
    }
    case 'voteResult':
      message = '结果展示后自动继续';
      break;
    case 'questResult':
      message = '结果展示后自动继续';
      break;
    case 'quest': {
      const instruction = resolveQuestInstruction(vm);
      if (instruction.isTeamMember) {
        primary.push({
          key: 'openQuest',
          label: instruction.myPlay === null ? '去出牌' : '修改出牌',
          audience: 'participant',
          category: 'player',
          isPending: instruction.myPlay === null,
          state: { kind: 'ready', onPress: input.onOpenQuestPress },
          testID: TESTIDS.avalonQuestOpen,
        });
      }
      // 未出牌名单全房公开：计数 + 未出牌行，人人可见；个人牌仍只在弹窗里看。
      message =
        phase.deadlineAt !== null &&
        input.settleCountdownSeconds !== null &&
        input.settleCountdownSeconds > 0
          ? `已全部出牌，${input.settleCountdownSeconds} 秒后揭晓`
          : vm.pendingPlaySeats !== null && vm.pendingPlaySeats.length > 0
            ? `已出牌 ${Object.keys(phase.plays).length}/${phase.teamSeats.length}`
            : null;
      if (message === null && !instruction.isTeamMember) {
        message = '等待队员出牌…';
      }
      break;
    }
    case 'lady': {
      const instruction = resolveLadyInstruction(vm);
      switch (instruction.kind) {
        case 'holderPick':
          message =
            '点座位盘点选一名没当过湖仙的玩家进行查验（只能看到其阵营：好 / 坏），点选后会再次确认。';
          break;
        case 'watching':
          // 旁观者看公开进程：谁在查验谁（或还在选对象）。查验结果是
          // 持有人私密信息，不在此句出现。
          message =
            instruction.targetSeat !== null
              ? `${avalonSeatLabel(state, instruction.holderSeat)} 已选择查验 ${avalonSeatLabel(state, instruction.targetSeat)}，等待持有人确认结果`
              : `${avalonSeatLabel(state, instruction.holderSeat)} 正在选择查验对象`;
          break;
        case 'result':
          // 结果本体归弹窗（上方重开入口），是持有人私密信息，此处不落文案。
          break;
      }
      break;
    }
    case 'assassin': {
      const instruction = resolveAssassinInstruction(vm);
      message =
        instruction.kind === 'assassinPick'
          ? '点座位盘点选一名玩家指认其为梅林（除自己外任意座位），点选后会再次确认。指认正确坏人获胜，指认错误好人直接获胜。'
          : instruction.kind === 'evilWait'
            ? '坏人商量时间（线下口头），等待刺客指认。'
            : '坏人正在商量刺杀目标…';
      break;
    }
    case 'ended': {
      // 终局结算只在本局复盘里；底部区只留复盘入口（玩家与观看者同款），
      // 房主的复盘入口与再来一局 / 返回大厅并列在房主任务卡。
      const { review } = input;
      if (review === null) throw new Error('[FAIL-FAST] Avalon ended has no review entry');
      secondary.push(...buildViewerReviewBottomButtons(review, input.viewer));
      message = buildEndedWaitingMessage({ isEnded: true, viewer: input.viewer });
      break;
    }
    default:
      break;
  }
  return { message, progress: null, actions: [...primary, ...secondary, ...ghost], group: null };
}

export interface AvalonRoomShellModelInput extends Omit<
  RoomShellModelInput,
  | 'phase'
  | 'step'
  | 'isAudioPlaying'
  | 'seatSource'
  | 'seatConfirmation'
  | 'profile'
  | 'playerActions'
  | 'controlledSeat'
> {
  readonly state: AvalonState;
  readonly revision: number;
  readonly controlledSeat: number | null;
  readonly seatController: RoomSeatController;
  readonly profileSelection: RoomProfileSelection | null;
  readonly gameDetails?: RoomProfileCardModel['gameDetails'];
  readonly onProfileClose: () => void;
  readonly onProfileLeaveSeat: () => void;
  readonly isLobby: boolean;
  readonly effectiveSeat: number | null;
  readonly onViewRolePress: () => void;
  readonly onNightInfoPress: () => void;
  readonly isSubmitting: boolean;
  readonly settleCountdownSeconds: number | null;
  readonly onOpenVotePress: () => void;
  readonly onOpenQuestPress: () => void;
  readonly onPreselectTeamPress: () => void;
  readonly onProposeTeamPress: () => void;
  readonly onEarlyStrikePress: () => void;
  readonly review: RoomReviewEntry | null;
  readonly strikePickMode: boolean;
  readonly onCancelEarlyStrikePress: () => void;
  readonly releaseBot: () => void;
}

export interface AvalonHostManagementInput {
  readonly state: AvalonState;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canFillBots' | 'canClearSeats' | 'canShareRoom'
  >;
  readonly isSubmitting: boolean;
  readonly controlledSeat: number | null;
  readonly releaseBot: () => void;
  /** 本局复盘入口（平台 useRoomReview）：与底部按钮同一入口；终局前为 null。 */
  readonly review: RoomReviewEntry | null;
  readonly onMusicSettings: () => void;
  readonly submit: (
    label: string,
    command: AvalonPublicCommand,
    options: { readonly actionKey: string | null },
  ) => Promise<boolean>;
}

/** Avalon management actions remain subject to the authoritative narration lock. */
const AVALON_AUDIO_LOCK_EXEMPT_ACTION_KEYS: ReadonlySet<string> = new Set();

function buildAvalonRestartAction(input: AvalonHostManagementInput): RoomHostAction {
  const { state } = input;
  return buildResetToLobbyAction({
    onPress: () =>
      showDestructiveAlert(
        '重新开始？',
        state.phase.kind === 'ended'
          ? input.review?.isPending
            ? '你尚未查看本局复盘。重新开始将保留座位和配置、清除本局，之后可能无法查看复盘；本局已结算，奖励不会撤销。'
            : '保留座位和配置，清除本局并回到准备。之后可能无法查看复盘；本局已结算，奖励不会撤销。'
          : '保留座位和配置，清除本局并回到准备。本局中止，不结算完成奖励。',
        '重新开始',
        async () => {
          await input.submit(
            '重新开始',
            {
              type: 'avalon.game.restart',
              gameSequence: state.gameSequence,
              wasEnded: state.phase.kind === 'ended',
            },
            { actionKey: HOST_ACTION_KEYS.restart },
          );
        },
      ),
    isEnabled: !input.isSubmitting,
    isLoading: input.isSubmitting,
  });
}

function createAvalonHostTools(input: AvalonHostManagementInput): RoomHostAction[] {
  const { state } = input;
  const actions: RoomHostAction[] = [];
  if (state.phase.kind === 'lobby' || state.phase.kind === 'viewing')
    actions.push(buildMusicSettingsAction({ onPress: input.onMusicSettings }));
  if (state.phase.kind === 'lobby' || state.phase.kind === 'ended') return actions;
  if (
    getAvalonViewingParticipants(state).some(
      (participant) => participant.isBot && !state.roleViewedSeats.includes(participant.seat),
    )
  )
    actions.push(
      buildMarkBotsViewedAction({
        onPress: () =>
          showConfirmAlert('标记机器人已查看？', '将标记所有未查看身份的机器人。', () => {
            void input.submit(
              '标记机器人已查看',
              { type: 'avalon.bots.markAllBotsViewed' },
              { actionKey: HOST_ACTION_KEYS.markBotsViewed },
            );
          }),
        isEnabled: !input.isSubmitting,
        isLoading: input.isSubmitting,
      }),
    );
  const phase = state.phase;
  if (
    phase.kind === 'night' &&
    getAvalonNightParticipants(state.roles, phase.step).some(
      (seat) => isBotSeat(state.roster, seat) && !phase.confirmedSeats.includes(seat),
    )
  )
    actions.push(
      buildPendingAwareHostAction(
        {
          key: 'mark-bots-confirmed',
          label: '标记机器人已确认',
          icon: 'checkmark-done-outline',
          category: 'host',
          testID: TESTIDS.roomMarkBotsConfirmedButton,
        },
        input.isSubmitting,
        () =>
          showConfirmAlert('标记机器人已确认？', '将为本阶段的机器人确认信息。', () => {
            void input.submit(
              '标记机器人已确认',
              {
                type: 'avalon.bots.markAllBotsGroupConfirmed',
              },
              { actionKey: 'mark-bots-confirmed' },
            );
          }),
      ),
    );
  return [...actions, buildAvalonRestartAction(input)];
}

function createAvalonEndedActions(input: AvalonHostManagementInput): RoomHostAction[] {
  const { review } = input;
  if (review === null) throw new Error('[FAIL-FAST] Avalon ended host has no review entry');
  return [buildReviewHostAction(review), buildAvalonRestartAction(input)];
}

/** Assembles the Avalon host panel for the current phase. Host gating belongs to the shell factory. */
export function createAvalonHostManagement(
  input: AvalonHostManagementInput,
): RoomHostManagementModel {
  const { state, capabilities } = input;
  const submit = input.submit;
  // Every exit passes through the one audio playback lock: while the
  // night narration plays, panel actions render disabled and their
  // presses are unreachable instead of relying on engine rejection.
  const applyLock = (model: RoomHostManagementModel): RoomHostManagementModel =>
    applyAudioPlaybackLock(
      {
        ...model,
        actions: [...model.actions, ...createAvalonHostTools(input)],
      },
      {
        isAudioPlaying: state.isAudioPlaying,
        exemptActionKeys: AVALON_AUDIO_LOCK_EXEMPT_ACTION_KEYS,
      },
    ) ?? model;
  const roomActions: RoomHostAction[] = [];
  if (capabilities.canConfigureGame.isAllowed)
    roomActions.push(buildRoomConfigAction({ onPress: capabilities.canConfigureGame.execute }));
  if (capabilities.canFillBots.isAllowed)
    roomActions.push(buildFillBotsAction({ onPress: capabilities.canFillBots.execute }));
  if (capabilities.canClearSeats.isAllowed)
    roomActions.push(buildClearSeatsAction({ onPress: capabilities.canClearSeats.execute }));
  if (state.phase.kind === 'lobby') {
    const occupiedSeatCount = getAvalonOccupiedSeatCount(state);
    const canStart = occupiedSeatCount === state.config.numberOfPlayers;
    const startDisabledReason = canStart
      ? null
      : seatShortageReason(state.config.numberOfPlayers, occupiedSeatCount);
    const submitAssign = () =>
      void submit(
        '分配角色',
        { type: 'avalon.roles.assign' },
        { actionKey: HOST_ACTION_KEYS.assignRoles },
      );
    const assignAction = buildAssignRolesAction({
      onPress: () =>
        showConfirmAlert(
          HOST_FLOW_CONFIRM.assignTitle,
          '所有座位已满，将洗牌并分配角色',
          submitAssign,
        ),
      isEnabled: !input.isSubmitting && canStart,
      disabledReason: startDisabledReason,
      isLoading: input.isSubmitting,
    });
    return applyLock({
      task: hostActionTask(HOST_ACTION_KEYS.assignRoles),
      pendingActionKeys: [HOST_ACTION_KEYS.assignRoles],
      actions: [assignAction, ...roomActions],
    });
  }
  if (state.phase.kind === 'viewing') {
    // 三段式中段：牌已发、对局未开始。全员查看齐后房主点「开始游戏」
    // 才进夜晚（引擎 begin 门同口径，这里先给禁用态与原因）。
    const participants = getAvalonViewingParticipants(state);
    const progress = projectViewingProgress(participants, state.roleViewedSeats);
    const beginGate = createViewingBeginGate({
      ...progress,
      submitting: input.isSubmitting,
      notViewedCopy: viewedProgressReason(progress.viewedCount, progress.totalSeats, '身份'),
    });
    const submitBegin = () =>
      void submit(
        '开始游戏',
        { type: 'avalon.game.begin' },
        { actionKey: HOST_ACTION_KEYS.startGame },
      );
    const beginAction = buildStartGameAction({
      onPress: () =>
        showConfirmAlert(
          HOST_FLOW_CONFIRM.startTitle,
          allViewedConfirmBody('身份', '开始后将进入夜晚阶段'),
          submitBegin,
        ),
      isEnabled: beginGate.isEnabled,
      disabledReason: beginGate.disabledReason,
      isLoading: input.isSubmitting,
    });
    const hostSeat = getAvalonUserSeat(state, state.hostUserId);
    // The task is the start; until every seat viewed it is blocked by
    // the action's own state.
    return applyLock({
      task: hostActionTask(HOST_ACTION_KEYS.startGame),
      pendingActionKeys:
        hostSeat !== null && !state.roleViewedSeats.includes(hostSeat)
          ? []
          : [HOST_ACTION_KEYS.startGame],
      actions: [beginAction, ...roomActions],
    });
  }
  if (state.phase.kind === 'ended') {
    return applyLock({
      task: { kind: 'choice', actionKeys: [HOST_ACTION_KEYS.review, 'restart'] },
      pendingActionKeys: input.review?.isPending ? [HOST_ACTION_KEYS.review] : [],
      actions: createAvalonEndedActions(input),
    });
  }
  // 局中投票 / 任务自动结算，房主无推进命令：此刻没有待操作。
  return applyLock({
    task: null,
    pendingActionKeys: [],
    actions: roomActions,
  });
}

/** Assembles the Avalon RoomShellModel from the hook's projections. */
export function createAvalonRoomShellModel(input: AvalonRoomShellModelInput): RoomShellModel {
  const { state } = input;
  const seatSource = createAvalonSeatDataSource({
    state,
    revision: input.revision,
    userId: input.viewer.userId,
    controlledSeat: input.controlledSeat,
  });
  return createRoomShellModel({
    ...input,
    isAudioPlaying: state.isAudioPlaying,
    seatSource,
    phase: state.phase.kind,
    // The step anchor: only the night phase carries a step (its three
    // confirmation steps, verbatim from the phase). Every other phase
    // kind is already the finest-grained state, so no step there.
    step: state.phase.kind === 'night' ? state.phase.step : null,
    seatConfirmation: createRoomSeatConfirmationModel(input.seatController),
    profile: createRoomProfileCardModel({
      selection: input.profileSelection,
      capabilities: input.capabilities,
      onClose: input.onProfileClose,
      onLeaveSeat: input.onProfileLeaveSeat,
      gameDetails: input.gameDetails,
    }),
    playerActions: createAvalonPlayerActions({
      state,
      isLobby: input.isLobby,
      viewer: input.viewer,
      effectiveSeat: input.effectiveSeat,
      isSubmitting: input.isSubmitting,
      canTakeOverBots: input.capabilities.canTakeOverBots.isAllowed,
      settleCountdownSeconds: input.settleCountdownSeconds,
      onViewRolePress: input.onViewRolePress,
      onNightInfoPress: input.onNightInfoPress,
      onOpenVotePress: input.onOpenVotePress,
      onOpenQuestPress: input.onOpenQuestPress,
      onPreselectTeamPress: input.onPreselectTeamPress,
      onProposeTeamPress: input.onProposeTeamPress,
      onEarlyStrikePress: input.onEarlyStrikePress,
      review: input.review,
      strikePickMode: input.strikePickMode,
      onCancelEarlyStrikePress: input.onCancelEarlyStrikePress,
    }),
    controlledSeat: createControlledSeatModel({
      controlledSeat: input.controlledSeat,
      controlledBotName:
        input.controlledSeat !== null
          ? (seatSource.getSeat(input.controlledSeat).player?.displayName ?? null)
          : null,
      release: input.releaseBot,
      gameName: 'Avalon',
    }),
  });
}
