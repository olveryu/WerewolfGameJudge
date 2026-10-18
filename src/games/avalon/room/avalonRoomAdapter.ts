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
  getAvalonNightParticipants,
  getAvalonOccupiedSeatCount,
  getAvalonUserSeat,
  getAvalonViewingParticipants,
  getAvalonViewModel,
  isAvalonPlayerCount,
} from '@game-judge/game-engine/games/avalon/public';
import { getBotDisplayName } from '@game-judge/game-engine/platform/room/getBotDisplayName';

import type { RoomProfileSelection } from '@/features/room/controllers/useRoomProfileController';
import type { RoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import type { BoardInfoSection, RoleDisplayItem } from '@/features/room/model/BoardInfoSection';
import {
  buildRoomHeaderModel,
  type RoomHeaderGachaStatus,
} from '@/features/room/model/buildRoomHeaderModel';
import { createControlledSeatModel } from '@/features/room/model/createControlledSeatModel';
import { createRoomProfileCardModel } from '@/features/room/model/createRoomProfileCardModel';
import { createRoomSeatConfirmationModel } from '@/features/room/model/createRoomSeatConfirmationModel';
import { createRoomSeatDataSource } from '@/features/room/model/createRoomSeatDataSource';
import { getRoomProfileTarget } from '@/features/room/model/getRoomProfileTarget';
import {
  buildClearSeatsAction,
  buildFillBotsAction,
  buildMarkBotsViewedAction,
  buildNextRoundAction,
  buildPendingAwareHostAction,
  buildReturnLobbyAction,
  buildRoomConfigAction,
  buildStartGameAction,
} from '@/features/room/model/hostManagementActions';
import { type NightStepProgress, resolveStepProgress } from '@/features/room/model/nightProgress';
import {
  buildEndedWaitingMessage,
  buildViewIdentityButton,
  resolveViewIdentityAction,
  type RoomBottomButton,
  type RoomBottomStackModel,
  VIEW_IDENTITY_LABEL,
} from '@/features/room/model/RoomBottomActions';
import type { RoomProfileTarget } from '@/features/room/model/RoomCapabilities';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';
import {
  buildShareRoomRemedy,
  type RoomHostManagementAction,
  type RoomHostManagementSection,
} from '@/features/room/model/RoomHostManagement';
import type { RoomSeatDataSource } from '@/features/room/model/RoomSeatDataSource';
import { getRoomSeatTapIntent } from '@/features/room/model/RoomSeatTap';
import type { RoomShareModel } from '@/features/room/model/RoomShare';
import type { RoomConnectionViewModel, RoomShellModel } from '@/features/room/model/RoomShellModel';
import { colors } from '@/theme';
import { showConfirmAlert } from '@/utils/alertPresets';

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
function getAvalonProfileTarget(state: AvalonState, seat: number): RoomProfileTarget | null {
  return getRoomProfileTarget(
    state.roster,
    seat,
    (botSeat) => `avalon-bot:${state.roomCode}:${botSeat}`,
    getBotDisplayName,
  );
}

/**
 * 队长徽标的阶段门：队长只在白天组队流程中有职能（组队 / 投票 / 任务 /
 * 湖仙 / 刺杀），只在这些阶段显示。身份查看与夜晚显示队长是阶段信息串扰
 * （与查看勾只属于查看阶段同类命题）；大厅队长未定、终局队长无职能，
 * 同样不显示。穷尽映射逐阶段表态，新增阶段必须在此显式决定。
 */
const AVALON_LEADER_BADGE_PHASES: Readonly<Record<AvalonPhaseKind, boolean>> = {
  lobby: false,
  viewing: false,
  night: false,
  nominate: true,
  vote: true,
  quest: true,
  lady: true,
  assassin: true,
  ended: false,
};

function avalonSeatStatusLabel(state: AvalonState, seat: number): string | null {
  const phase = state.phase;
  if (state.leaderSeat === seat && AVALON_LEADER_BADGE_PHASES[phase.kind]) return '队长';
  if (phase.kind === 'lady' && phase.holderSeat === seat) return '湖仙';
  // 提名草稿（服务端权威、全房可见）：草稿中的座位即「队员」徽标。
  // 本函数读的是调用方给的派生输入：队长本人屏幕由 room-state 以点选
  // 镜像覆盖 draftSeats（未回声先按镜像亮），其余视角恒为服务端草稿。
  if (phase.kind === 'nominate' && phase.draftSeats.includes(seat)) return '队员';
  if (phase.kind === 'vote' && phase.proposedSeats.includes(seat)) return '队员';
  if (phase.kind === 'quest' && phase.teamSeats.includes(seat)) return '队员';
  return null;
}

/** 创建共享座位表数据源：含队长 / 队员 / 湖仙状态徽标（不暴露角色）。 */
export interface AvalonSeatSourceInput {
  readonly state: AvalonState;
  readonly revision: number;
  readonly userId: string;
  readonly controlledSeat: number | null;
}

interface AvalonSeatTapInput {
  readonly state: AvalonState;
  readonly seat: number;
  readonly currentSeat: number | null;
  readonly disabledReason?: string;
}

/** Project Avalon seating into the shared room seat-tap contract. */
export function getAvalonSeatTapIntent(input: AvalonSeatTapInput) {
  return getRoomSeatTapIntent({
    seat: input.seat,
    currentSeat: input.currentSeat,
    target: getAvalonProfileTarget(input.state, input.seat),
    disabledReason: input.disabledReason,
  });
}

export function createAvalonSeatDataSource(input: AvalonSeatSourceInput): RoomSeatDataSource {
  const { state, revision, userId, controlledSeat } = input;
  // 夜晚已确认徽标只给当前步参与者看（私密确认不计数、不外泄给非参与者）。
  const nightPhase = state.phase.kind === 'night' ? state.phase : null;
  const ownSeat = getAvalonUserSeat(state, userId) ?? undefined;
  const viewerSeat = controlledSeat ?? ownSeat;
  const stepParticipants =
    nightPhase === null ? [] : getAvalonNightParticipants(state.roles, nightPhase.step);
  const viewerIsStepParticipant = viewerSeat !== undefined && stepParticipants.includes(viewerSeat);
  return createRoomSeatDataSource({
    seatCount: state.config.numberOfPlayers,
    revision,
    roster: state.roster,
    viewerUserId: userId,
    controlledSeat,
    isLobby: state.phase.kind === 'lobby',
    botUserId: (seat) => `avalon-bot:${state.roomCode}:${seat}`,
    outOfRangeError: () => 'Avalon seat out of range',
    lockedSeatReason: '游戏进行中不能入座',
    resolveSecondaryLabel: (seat, player) => {
      // 对齐狼人杀：bot 座位显示身份（state.roles 是公开广播的，D6-Q1）。
      const botRole = player?.kind === 'bot' ? state.roles[seat] : undefined;
      return botRole !== undefined ? getAvalonRoleDisplayName(botRole) : null;
    },
    // 逐座位已查看身份徽标（公开信息）：勾只属于查看阶段——对局开始
    // （begin 进夜晚）即清（展示契约 §3.3 徽标命题，与狼人杀口径一致）。
    resolveShowReadyBadge: (seat) =>
      state.phase.kind === 'viewing' && state.roleViewedSeats.includes(seat),
    resolveStatusBadge: (seat) => {
      const statusLabel = avalonSeatStatusLabel(state, seat);
      // 投票/任务阶段显示已投票/已出牌；夜晚给参与者显示同伴已确认（只暴露是否行动）。
      const hasVoted = state.phase.kind === 'vote' && state.phase.ballots[seat] !== undefined;
      const hasPlayed = state.phase.kind === 'quest' && state.phase.plays[seat] !== undefined;
      const nightConfirmed =
        nightPhase !== null && viewerIsStepParticipant && nightPhase.confirmedSeats.includes(seat);
      const progressLabel = hasVoted
        ? '已投票'
        : hasPlayed
          ? '已出牌'
          : nightConfirmed
            ? '已确认'
            : null;
      const combinedLabel =
        statusLabel !== null && progressLabel !== null
          ? `${statusLabel} · ${progressLabel}`
          : (progressLabel ?? statusLabel);
      return combinedLabel === null
        ? null
        : {
            label: combinedLabel,
            tone:
              combinedLabel.includes('已投票') ||
              combinedLabel.includes('已出牌') ||
              combinedLabel.includes('已确认')
                ? 'success'
                : combinedLabel === '队员'
                  ? 'success'
                  : 'warning',
          };
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
      ? `${formatAvalonQuestLabel(record.round)} · 成功（成功票 ${quest.successCount}）`
      : `${formatAvalonQuestLabel(record.round)} · 失败（失败票 ${quest.failCount}）`;
  }
  return null;
}

/**
 * 对局摘要条文案（座位表上方常驻，入口按狼人杀口径）：最新结算结论
 * 优先，其次当前轮次状态句；大厅不出现（返回 null）。只读公开信息
 * （落盘记录与阶段），不含未结算票面与任何身份。
 */
export function createAvalonHistorySummary(state: AvalonState): string | null {
  const phase = state.phase;
  switch (phase.kind) {
    case 'lobby':
      return null;
    case 'viewing':
      return '身份查看阶段';
    case 'night':
      return '第一晚';
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
    case 'quest': {
      const round = phase.round;
      const questLabel = formatAvalonQuestLabel(round);
      const record = state.roundHistory.find((candidate) => candidate.round === round);
      // 本轮已有提案结算（否决后回到组队、或通过后任务进行中）：
      // 最新结算就是这次投票结论。
      if (state.lastVoteResult !== null && record !== undefined && record.proposals.length > 0) {
        const vote = state.lastVoteResult;
        return `${questLabel} · ${vote.approved ? '队伍通过' : '提案被否决'}（赞成 ${vote.approveCount} · 反对 ${vote.rejectCount}）`;
      }
      // 本轮尚无提案结算时，最新结算是上一轮的任务结论。
      if (record === undefined) {
        const conclusion = avalonLatestQuestConclusion(state);
        if (conclusion !== null) return conclusion;
      }
      if (phase.kind === 'nominate') {
        const attempt = (record?.proposals.length ?? 0) + 1;
        return `${questLabel} · 第${attempt}次提案 · 队长组队中`;
      }
      if (phase.kind === 'vote') {
        const attempt = (record?.proposals.length ?? 0) + 1;
        return `${questLabel} · 第${attempt}次提案投票中`;
      }
      return `${questLabel} · 任务执行中`;
    }
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
      color: colors.wolf,
    },
    {
      title: '好人',
      items: toItems(board.filter((roleId) => !getAvalonRoleMeta(roleId).isEvil)),
      color: colors.god,
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
  readonly isHost: boolean;
  readonly mySeat: number | null;
  readonly effectiveSeat: number | null;
  readonly isSubmitting: boolean;
  readonly canControlBots: boolean;
  /** 投票/出牌结算倒计时剩余秒数（screen 的 tick 派生）；未武装为 null。 */
  readonly settleCountdownSeconds: number | null;
  readonly onViewRolePress: () => void;
  readonly onNightInfoPress: () => void;
  readonly onOpenVotePress: () => void;
  readonly onOpenQuestPress: () => void;
  readonly onProposeTeamPress: () => void;
  readonly onLadyAcknowledgePress: () => void;
  readonly onLadyResultPress: () => void;
  readonly onEarlyStrikePress: () => void;
  /** 提前刺杀选人模式（本地 UI 状态）：开启时底部区独占为座位盘点选提示 + 取消入口。 */
  readonly strikePickMode: boolean;
  readonly onCancelEarlyStrikePress: () => void;
}

/**
 * 阿瓦隆底部动作区：全游戏个人动作与个人指令的唯一落点（落点总规则）——
 * 查看身份局内常驻；夜晚信息步两步确认（按钮 → 弹窗）；白天各阶段的主按钮
 * （提交队伍 / 去投票 / 去出牌 / 查看查验请求）与个人状态走 message；
 * 夜晚步进走底部细进度行、公开阶段状态归摘要条、逐座状态归座位盘、
 * 一次性信息归弹窗。
 */
function createAvalonBottomActions(input: AvalonBottomActionsInput): RoomBottomStackModel {
  const { state } = input;
  const primary: RoomBottomButton[] = [];
  const secondary: RoomBottomButton[] = [];
  const ghost: RoomBottomButton[] = [];
  let message: string | null = null;
  if (input.isLobby) {
    // 大厅客人等分配（个人提示）；房主走房主面板。
    if (!input.isHost && input.mySeat !== null) message = '等待房主分配角色';
    return { kind: 'stacked', message, progress: null, layout: { primary, secondary, ghost } };
  }
  // 查看身份：局内常驻（对齐狼人杀）。用 effectiveSeat：房主代打 bot 时也能看 bot 的身份。
  const viewIdentityAction = resolveViewIdentityAction({
    isVisible: input.effectiveSeat !== null,
    label: VIEW_IDENTITY_LABEL,
    onPress: input.onViewRolePress,
  });
  if (viewIdentityAction !== null) {
    ghost.push(
      buildViewIdentityButton(viewIdentityAction, {
        key: 'viewRole',
        testID: 'avalon-view-role',
      }),
    );
  }
  const phase = state.phase;
  if (phase.kind === 'viewing') {
    // 查看阶段本人未看时提示去看（展示契约 self-hint 态，只走这一处出口）。
    if (input.effectiveSeat !== null && !state.roleViewedSeats.includes(input.effectiveSeat)) {
      message = '请点击下方「查看身份」，查看你的角色';
    }
    return { kind: 'stacked', message, progress: null, layout: { primary, secondary, ghost } };
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
          variant: 'primary',
          size: 'md',
          isEnabled: true,
          onPress: input.onNightInfoPress,
          testID: 'avalon-night-info',
        });
      }
    }
    return {
      kind: 'stacked',
      message,
      progress: deriveAvalonBottomProgress(state),
      layout: { primary, secondary, ghost },
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
        variant: 'secondary',
        size: 'md',
        isEnabled: true,
        onPress: input.onCancelEarlyStrikePress,
        testID: 'avalon-early-strike',
      });
      message =
        '点座位盘点选一名玩家进行提前刺杀（除自己外任意座位），点选后会再次确认。刺中梅林坏人直接获胜，刺错好人直接获胜。';
      return { kind: 'stacked', message, progress: null, layout: { primary, secondary, ghost } };
    }
    primary.push({
      key: 'earlyStrike',
      label: '刺杀',
      variant: 'primary',
      size: 'md',
      buttonColor: colors.error,
      isEnabled: true,
      onPress: input.onEarlyStrikePress,
      testID: 'avalon-early-strike',
    });
  }
  // 湖仙查验结果重开入口：结果本体只住弹窗（一次性私密信息），此处只放入口；
  // VM 只向持有人暴露 lastLadyCheck 结果，非持有人恒无此按钮。
  if (vm.ladyCheckResult !== null && phase.kind !== 'ended') {
    secondary.push({
      key: 'ladyResult',
      label: '查验结果',
      variant: 'secondary',
      size: 'md',
      isEnabled: true,
      onPress: input.onLadyResultPress,
      testID: 'avalon-lady-result-open',
    });
  }
  switch (phase.kind) {
    case 'nominate': {
      const instruction = resolveNominateInstruction(vm, vm.mySeat);
      if (instruction.isLeader) {
        message = `点座位盘点选 ${instruction.requiredSize} 名队员（可含自己），选中的座位会亮起「队员」徽标，再点一次取消。`;
        const isFull = vm.draftSeats !== null && vm.draftSeats.length === instruction.requiredSize;
        if (isFull && !input.isSubmitting) {
          primary.push({
            key: 'proposeTeam',
            label: '提交队伍',
            variant: 'primary',
            size: 'md',
            isEnabled: true,
            onPress: input.onProposeTeamPress,
            testID: 'avalon-nominate-submit',
          });
        } else if (isFull) {
          primary.push({
            key: 'proposeTeam',
            label: '提交队伍',
            variant: 'primary',
            size: 'md',
            isEnabled: false,
            disabledReason: null,
            isLoading: true,
            testID: 'avalon-nominate-submit',
          });
        } else {
          primary.push({
            key: 'proposeTeam',
            label: '提交队伍',
            variant: 'primary',
            size: 'md',
            isEnabled: false,
            disabledReason: `队员人数必须为 ${instruction.requiredSize} 人`,
            testID: 'avalon-nominate-submit',
          });
        }
      } else {
        message = `等待队长组队（${instruction.leaderSeat + 1} 号座位），本轮需要 ${instruction.requiredSize} 名队员。`;
      }
      break;
    }
    case 'vote': {
      const instruction = resolveVoteInstruction(vm);
      if (instruction.canVote) {
        primary.push({
          key: 'openVote',
          label: instruction.myBallot === null ? '去投票' : '修改投票',
          variant: 'primary',
          size: 'md',
          isEnabled: true,
          onPress: input.onOpenVotePress,
          testID: 'avalon-vote-open',
        });
        // 已投计数与引擎视图层 AvalonCurrentProposalView 同一派生
        // （只数已投人数、永不归名，与暗投口径一致）。
        message =
          phase.deadlineAt !== null && input.settleCountdownSeconds !== null
            ? `已全部投票，${input.settleCountdownSeconds} 秒后揭晓`
            : instruction.myBallot !== null
              ? `你已投：${instruction.myBallot === 'approve' ? '赞成' : '反对'}（揭晓前可改票）· 已投 ${Object.keys(phase.ballots).length}/${getAvalonOccupiedSeatCount(state)}`
              : null;
      } else {
        message = input.canControlBots ? '长按机器人座位接管后投票。' : '你不在座位上，无法投票。';
      }
      break;
    }
    case 'quest': {
      const instruction = resolveQuestInstruction(vm);
      if (instruction.isTeamMember) {
        primary.push({
          key: 'openQuest',
          label: instruction.myPlay === null ? '去出牌' : '修改出牌',
          variant: 'primary',
          size: 'md',
          isEnabled: true,
          onPress: input.onOpenQuestPress,
          testID: 'avalon-quest-open',
        });
        message =
          phase.deadlineAt !== null && input.settleCountdownSeconds !== null
            ? `已全部出牌，${input.settleCountdownSeconds} 秒后揭晓`
            : instruction.myPlay !== null
              ? '你已出牌，等待揭晓'
              : null;
      } else {
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
        case 'holderWait':
          message = `已选择查验${avalonSeatLabel(state, instruction.targetSeat)}，等待对方确认展示。`;
          break;
        case 'targetConfirm':
          message = `${avalonSeatLabel(state, instruction.holderSeat)} 要查验你的阵营，确认展示后对方将看到你是好人还是坏人。`;
          primary.push({
            key: 'ladyAcknowledge',
            label: '查看查验请求',
            variant: 'primary',
            size: 'md',
            isEnabled: true,
            onPress: input.onLadyAcknowledgePress,
            testID: 'avalon-lady-acknowledge-open',
          });
          break;
        case 'watching':
          // 旁观者看公开进程：谁在查验谁（或还在选对象）。查验结果是
          // 持有人私密信息，不在此句出现。
          message =
            instruction.targetSeat !== null
              ? `${avalonSeatLabel(state, instruction.holderSeat)} 已选择查验 ${avalonSeatLabel(state, instruction.targetSeat)}，等待对方确认`
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
    case 'ended':
      // 结算常驻于座位表上方区；非房主玩家在此等房主决定再来一局
      // 或返回大厅（共享终局等待句，DrawGuess 基准句式）。
      message = buildEndedWaitingMessage({
        isEnded: true,
        isHost: input.isHost,
        mySeat: input.mySeat,
      });
      break;
    default:
      break;
  }
  return { kind: 'stacked', message, progress: null, layout: { primary, secondary, ghost } };
}

export interface AvalonRoomShellModelInput {
  readonly roomCode: string;
  readonly capabilities: RoomCapabilities;
  readonly onBack: () => void;
  readonly onTitlePress: () => void;
  readonly onTitleLongPress: () => void;
  readonly user: { readonly id: string; readonly avatarUrl?: string | null } | null;
  readonly gachaStatus: RoomHeaderGachaStatus | null | undefined;
  readonly onUserActionPress: () => void;
  readonly connection: RoomConnectionViewModel;
  readonly state: AvalonState;
  readonly revision: number;
  readonly userId: string;
  readonly controlledSeat: number | null;
  readonly seatsVisuallyDisabled: boolean;
  readonly onSeatPress: (seat: number, disabledReason?: string) => void;
  readonly onBotSeatLongPress: ((seat: number) => void) | null;
  readonly seatController: RoomSeatController;
  readonly profileSelection: RoomProfileSelection | null;
  readonly onProfileClose: () => void;
  readonly onProfileLeaveSeat: () => void;
  readonly share: RoomShareModel;
  readonly isLobby: boolean;
  readonly isHost: boolean;
  readonly mySeat: number | null;
  readonly effectiveSeat: number | null;
  readonly onViewRolePress: () => void;
  readonly onNightInfoPress: () => void;
  readonly isSubmitting: boolean;
  readonly settleCountdownSeconds: number | null;
  readonly onOpenVotePress: () => void;
  readonly onOpenQuestPress: () => void;
  readonly onProposeTeamPress: () => void;
  readonly onLadyAcknowledgePress: () => void;
  readonly onLadyResultPress: () => void;
  readonly onEarlyStrikePress: () => void;
  readonly strikePickMode: boolean;
  readonly onCancelEarlyStrikePress: () => void;
  readonly hostManagement: RoomHostManagementModel | null;
  readonly canControlBots: boolean;
  readonly releaseBot: () => void;
}

export interface AvalonHostManagementInput {
  readonly state: AvalonState;
  readonly isHost: boolean;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canFillBots' | 'canClearSeats' | 'canShareRoom'
  >;
  readonly isSubmitting: boolean;
  readonly controlledSeat: number | null;
  readonly releaseBot: () => void;
  readonly submit: (
    label: string,
    command: AvalonPublicCommand,
    control?: number | null,
  ) => Promise<boolean>;
}

/** Assembles the Avalon host panel for the current phase. */
export function createAvalonHostManagement(
  input: AvalonHostManagementInput,
): RoomHostManagementModel | null {
  if (!input.isHost) return null;
  const { state, capabilities } = input;
  const submit = input.submit;
  const roomActions: RoomHostManagementAction[] = [];
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
      : `座位尚未坐满（还差 ${state.config.numberOfPlayers - occupiedSeatCount} 人）`;
    const submitAssign = () => void submit('分配角色', { type: 'avalon.game.start' });
    const assignAction = buildStartGameAction({
      label: '分配角色',
      onPress: () => showConfirmAlert('分配角色？', '所有座位已满，将洗牌并分配角色', submitAssign),
      isEnabled: !input.isSubmitting && canStart,
      disabledReason: startDisabledReason,
      isLoading: input.isSubmitting,
      isPrimary: true,
      remedy: buildShareRoomRemedy(capabilities.canShareRoom),
    });
    return {
      sections: [
        {
          key: 'game',
          title: '游戏',
          actions: [assignAction],
        },
        { key: 'room', title: '房间管理', actions: roomActions },
      ],
    };
  }
  if (state.phase.kind === 'viewing') {
    // 三段式中段：牌已发、对局未开始。全员查看齐后房主点「开始游戏」
    // 才进夜晚（引擎 begin 门同口径，这里先给禁用态与原因）。
    const participants = getAvalonViewingParticipants(state);
    const viewedCount = participants.filter((participant) =>
      state.roleViewedSeats.includes(participant.seat),
    ).length;
    const allViewed = viewedCount === participants.length;
    const beginDisabledReason = allViewed ? null : '还有玩家未查看身份';
    const submitBegin = () => void submit('开始游戏', { type: 'avalon.game.begin' });
    const beginAction = buildStartGameAction({
      onPress: () =>
        showConfirmAlert('开始游戏？', '全员已查看身份，开始后将进入夜晚阶段', submitBegin),
      isEnabled: !input.isSubmitting && allViewed,
      disabledReason: beginDisabledReason,
      isLoading: input.isSubmitting,
      isPrimary: true,
    });
    const sections: RoomHostManagementSection[] = [
      {
        key: 'game',
        title: '游戏',
        actions: [beginAction],
      },
    ];
    const hasUnviewedBot = participants.some(
      (participant) => participant.isBot && !state.roleViewedSeats.includes(participant.seat),
    );
    if (hasUnviewedBot)
      sections.push({
        key: 'bot-viewing',
        title: '身份查看',
        actions: [
          buildMarkBotsViewedAction({
            onPress: () =>
              void submit('标记机器人已查看', { type: 'avalon.bots.markAllBotsViewed' }),
            isEnabled: !input.isSubmitting,
            isLoading: input.isSubmitting,
          }),
        ],
      });
    sections.push({ key: 'room', title: '房间管理', actions: roomActions });
    return {
      sections,
    };
  }
  if (state.phase.kind === 'ended') {
    return {
      sections: [
        {
          key: 'current-flow',
          title: '当前流程',
          actions: [
            buildNextRoundAction({
              onPress: () =>
                showConfirmAlert(
                  '再来一局',
                  '重新发牌并清零比分，开始新的一局。',
                  () => void submit('再来一局', { type: 'avalon.game.start' }),
                ),
            }),
            buildReturnLobbyAction({
              onPress: () =>
                showConfirmAlert(
                  '返回大厅',
                  '保留座位和设置，清除当前对局。',
                  () => void submit('返回大厅', { type: 'avalon.game.returnToLobby' }),
                ),
            }),
          ],
        },
      ],
    };
  }
  // 房主手动结算（D15/D16）：投票阶段可结束投票，任务阶段可结束任务。
  const inGameSections: RoomHostManagementSection[] = [];
  if (state.phase.kind === 'vote')
    inGameSections.push({
      key: 'vote',
      title: '投票管理',
      actions: [
        buildPendingAwareHostAction(
          {
            key: 'finish-vote',
            label: '结束投票',
            icon: 'checkmark-done-outline',
            variant: 'primary',
            isLoading: input.isSubmitting,
            testID: 'avalon-finish-vote',
          },
          input.isSubmitting,
          () =>
            showConfirmAlert(
              '结束投票',
              input.controlledSeat !== null
                ? '未投票的座位将视为弃权，确定结束投票并结算吗？你正在接管机器人座位，结算前将先释放接管。'
                : '未投票的座位将视为弃权，确定结束投票并结算吗？',
              () => {
                // 房主接管中需先释放，否则服务端按"机器人身份"拒绝（requireAvalonHost）。
                // 显式传 null，避免闭包捕获旧的 controlledSeat。
                if (input.controlledSeat !== null) input.releaseBot();
                void submit('结束投票', { type: 'avalon.vote.finish' }, null);
              },
            ),
        ),
      ],
    });
  if (state.phase.kind === 'quest')
    inGameSections.push({
      key: 'quest',
      title: '任务管理',
      actions: [
        buildPendingAwareHostAction(
          {
            key: 'finish-quest',
            label: '结束任务',
            icon: 'checkmark-done-outline',
            variant: 'primary',
            isLoading: input.isSubmitting,
            testID: 'avalon-finish-quest',
          },
          input.isSubmitting,
          () =>
            showConfirmAlert(
              '结束任务',
              input.controlledSeat !== null
                ? '未出牌的队员将视为成功，确定提前结算吗？你正在接管机器人座位，结算前将先释放接管。'
                : '未出牌的队员将视为成功，确定提前结算吗？',
              () => {
                if (input.controlledSeat !== null) input.releaseBot();
                void submit('结束任务', { type: 'avalon.quest.finish' }, null);
              },
            ),
        ),
      ],
    });
  // 身份查看脚手架（对齐狼人杀）：还有机器人座位未落查看记录时，
  // 房主可一键标记；引擎不自动落标记，检查点对 bot 同样生效。
  const hasUnviewedBot = getAvalonViewingParticipants(state).some(
    (participant) => participant.isBot && !state.roleViewedSeats.includes(participant.seat),
  );
  if (hasUnviewedBot)
    inGameSections.push({
      key: 'bot-viewing',
      title: '身份查看',
      actions: [
        buildMarkBotsViewedAction({
          onPress: () => void submit('标记机器人已查看', { type: 'avalon.bots.markAllBotsViewed' }),
          isEnabled: !input.isSubmitting,
          isLoading: input.isSubmitting,
        }),
      ],
    });
  // 房主管理常驻（对齐狼人杀）：局内任何时候房主都能点开，房间管理区始终有，
  // 投票/任务阶段额外出现"结束投票"/"结束任务"。
  return {
    sections: [...inGameSections, { key: 'room', title: '房间管理', actions: roomActions }],
  };
}

/** Assembles the Avalon RoomShellModel from the hook's projections. */
export function createAvalonRoomShellModel(input: AvalonRoomShellModelInput): RoomShellModel {
  const { state } = input;
  const seatSource = createAvalonSeatDataSource({
    state,
    revision: input.revision,
    userId: input.userId,
    controlledSeat: input.controlledSeat,
  });
  return {
    roomCode: input.roomCode,
    capabilities: input.capabilities,
    phase: state.phase.kind,
    header: buildRoomHeaderModel({
      onBack: input.onBack,
      onTitlePress: input.onTitlePress,
      onTitleLongPress: input.onTitleLongPress,
      user: input.user,
      gachaStatus: input.gachaStatus,
      onUserActionPress: input.onUserActionPress,
    }),
    connection: input.connection,
    seats: {
      source: seatSource,
      visuallyDisabled: input.seatsVisuallyDisabled,
      onSeatPress: input.onSeatPress,
      // 对齐其他有座位游戏：长按机器人座位接管/释放。
      onBotSeatLongPress: input.onBotSeatLongPress,
    },
    seatConfirmation: createRoomSeatConfirmationModel(input.seatController),
    profile: createRoomProfileCardModel({
      selection: input.profileSelection,
      capabilities: input.capabilities,
      onClose: input.onProfileClose,
      onLeaveSeat: input.onProfileLeaveSeat,
    }),
    share: input.share,
    bottomActions: createAvalonBottomActions({
      state,
      isLobby: input.isLobby,
      isHost: input.isHost,
      mySeat: input.mySeat,
      effectiveSeat: input.effectiveSeat,
      isSubmitting: input.isSubmitting,
      canControlBots: input.canControlBots,
      settleCountdownSeconds: input.settleCountdownSeconds,
      onViewRolePress: input.onViewRolePress,
      onNightInfoPress: input.onNightInfoPress,
      onOpenVotePress: input.onOpenVotePress,
      onOpenQuestPress: input.onOpenQuestPress,
      onProposeTeamPress: input.onProposeTeamPress,
      onLadyAcknowledgePress: input.onLadyAcknowledgePress,
      onLadyResultPress: input.onLadyResultPress,
      onEarlyStrikePress: input.onEarlyStrikePress,
      strikePickMode: input.strikePickMode,
      onCancelEarlyStrikePress: input.onCancelEarlyStrikePress,
    }),
    hostManagement: input.hostManagement,
    controlledSeat: createControlledSeatModel({
      controlledSeat: input.controlledSeat,
      controlledBotName:
        input.controlledSeat !== null
          ? (seatSource.getSeat(input.controlledSeat).player?.displayName ?? null)
          : null,
      release: input.releaseBot,
      gameName: 'Avalon',
    }),
  };
}
