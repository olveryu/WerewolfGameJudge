/**
 * 把阿瓦隆权威状态投影到共享座位表与房间状态条，不暴露私密信息。
 */

import {
  AVALON_BOARDS,
  AVALON_NIGHT_STEPS,
  type AvalonCommand,
  type AvalonNightStep,
  type AvalonRoleId,
  type AvalonState,
  getAvalonBotDisplayName,
  getAvalonBotSeats,
  getAvalonNightParticipants,
  getAvalonOccupiedSeatCount,
  getAvalonUserSeat,
  getAvalonViewingParticipants,
  getAvalonViewModel,
  isAvalonBotSeat,
  isAvalonPlayerCount,
  isBotOccupant,
} from '@game-judge/game-engine/games/avalon/public';

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
import {
  buildClearSeatsAction,
  buildFillBotsAction,
  buildMarkBotsViewedAction,
  buildNextRoundAction,
  buildReturnLobbyAction,
  buildRoomConfigAction,
  buildStartGameAction,
} from '@/features/room/model/hostManagementActions';
import { resolveStepProgress } from '@/features/room/model/nightProgress';
import {
  buildAudioWaitingButton,
  type RoomBottomButton,
  type RoomBottomInfoModel,
} from '@/features/room/model/RoomBottomActions';
import type { RoomProfileTarget } from '@/features/room/model/RoomCapabilities';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type {
  RoomHostManagementAction,
  RoomHostManagementSection,
} from '@/features/room/model/RoomHostManagement';
import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';
import type {
  RoomSeatDataSource,
  RoomSeatViewModel,
} from '@/features/room/model/RoomSeatDataSource';
import { getRoomSeatTapIntent } from '@/features/room/model/RoomSeatTap';
import type { RoomShareModel } from '@/features/room/model/RoomShare';
import type { RoomStatusRibbonModel } from '@/features/room/model/RoomShellModel';
import type { RoomConnectionViewModel, RoomShellModel } from '@/features/room/model/RoomShellModel';
import {
  buildLobbyWaitingText,
  messageRibbon,
  progressRibbon,
} from '@/features/room/model/statusRibbon';
import { toRoomSeatPlayer } from '@/features/room/model/toRoomSeatPlayer';
import { colors } from '@/theme';
import { showConfirmAlert, showErrorAlert } from '@/utils/alertPresets';

import { getAvalonRoleDisplayName } from '../model/avalonRoleDisplay';
import { getAvalonRoleMeta } from '../model/avalonRoleMeta';
import { resolveNightInstruction } from './policy/avalonInteractionPolicy';

/** 为共享资料卡控件返回公开的席位身份。 */
function getAvalonProfileTarget(state: AvalonState, seat: number): RoomProfileTarget | null {
  const occupant = state.roster[seat];
  if (occupant != null && !isBotOccupant(occupant))
    return {
      seat,
      userId: occupant.userId,
      occupantKind: 'human',
      rosterName: occupant.profile.displayName,
    };
  return isAvalonBotSeat(state, seat)
    ? {
        seat,
        userId: `avalon-bot:${state.roomCode}:${seat}`,
        occupantKind: 'bot',
        rosterName: getAvalonBotDisplayName(seat),
      }
    : null;
}

function avalonSeatStatusLabel(
  state: AvalonState,
  seat: number,
  pickedSeats: ReadonlySet<number>,
): string | null {
  if (state.leaderSeat === seat && state.phase.kind !== 'lobby') return '队长';
  const phase = state.phase;
  if (phase.kind === 'lady' && phase.holderSeat === seat) return '湖仙';
  // 提名阶段队长在座位盘上的本地选中集（尚未提交）：选中即「队员」徽标。
  if (phase.kind === 'nominate' && pickedSeats.has(seat)) return '队员';
  if (phase.kind === 'nominate' || phase.kind === 'vote') {
    const proposed = phase.kind === 'nominate' ? null : phase.proposedSeats.includes(seat);
    if (proposed === true) return '队员';
  }
  if (phase.kind === 'quest' && phase.teamSeats.includes(seat)) return '队员';
  return null;
}

const NO_PICKED_SEATS: ReadonlySet<number> = new Set();

/** 创建共享座位表数据源：含队长 / 队员 / 湖仙状态徽标（不暴露角色）。 */
export interface AvalonSeatSourceInput {
  readonly state: AvalonState;
  readonly revision: number;
  readonly userId: string;
  readonly controlledSeat: number | null;
  readonly pickedSeats?: ReadonlySet<number>;
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
  const { state, revision, userId, controlledSeat, pickedSeats = NO_PICKED_SEATS } = input;
  // 夜晚已确认徽标只给当前步参与者看（私密确认不计数、不外泄给非参与者）。
  const nightPhase = state.phase.kind === 'night' ? state.phase : null;
  const ownSeat = getAvalonUserSeat(state, userId) ?? undefined;
  const viewerSeat = controlledSeat ?? ownSeat;
  const stepParticipants =
    nightPhase === null ? [] : getAvalonNightParticipants(state.roles, nightPhase.step);
  const viewerIsStepParticipant = viewerSeat !== undefined && stepParticipants.includes(viewerSeat);
  return {
    count: state.config.numberOfPlayers,
    revision: `${revision}:${controlledSeat ?? 'self'}`,
    getSeat(seat): RoomSeatViewModel {
      if (!Number.isSafeInteger(seat) || seat < 0 || seat >= state.config.numberOfPlayers)
        throw new Error('Avalon seat out of range');
      const occupant = state.roster[seat];
      const target = getAvalonProfileTarget(state, seat);
      const human = occupant != null && !isBotOccupant(occupant) ? occupant : undefined;
      const player =
        human !== undefined
          ? toRoomSeatPlayer({ kind: 'human', userId: human.userId, ...human.profile })
          : target === null
            ? null
            : {
                kind: 'bot' as const,
                userId: target.userId,
                displayName: target.rosterName,
                isAnonymous: true,
              };
      const statusLabel = avalonSeatStatusLabel(state, seat, pickedSeats);
      // 对齐狼人杀：bot 座位显示身份（state.roles 是公开广播的，D6-Q1）。
      const botRole = player?.kind === 'bot' ? state.roles[seat] : undefined;
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
      return {
        seat,
        player,
        isSelf: human?.userId === userId,
        highlight: controlledSeat === seat ? 'controlled' : 'none',
        secondaryLabel: botRole !== undefined ? getAvalonRoleDisplayName(botRole) : null,
        // 逐座位已查看身份徽标（公开信息，对齐狼人杀 hasViewedRole ✅）：
        // 查看阶段逐个点亮进度，夜晚保持全亮。
        showReadyBadge:
          (state.phase.kind === 'viewing' || nightPhase !== null) &&
          state.roleViewedSeats.includes(seat),
        statusBadge:
          combinedLabel === null
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
              },
        isStatusEmphasized: false,
        showLevel: state.phase.kind === 'lobby',
        decorationsEnabled: state.phase.kind === 'lobby',
        disabledReason:
          player === null && state.phase.kind !== 'lobby' ? '游戏进行中不能入座' : undefined,
      };
    },
  };
}

const AVALON_NIGHT_STEP_LABELS: Readonly<Record<AvalonNightStep, string>> = {
  evilReveal: '坏人互认',
  merlinReveal: '梅林的视野',
  percivalReveal: '派西维尔的视野',
};

/** 公共状态条：不含私密信息。 */
export function createAvalonStatusRibbon(state: AvalonState): RoomStatusRibbonModel | null {
  const phase = state.phase;
  if (phase.kind === 'viewing') {
    // 查看阶段（对局未开始）：只报查看进度，名单看座位盘打勾。
    const participants = getAvalonViewingParticipants(state);
    const viewedCount = participants.filter((participant) =>
      state.roleViewedSeats.includes(participant.seat),
    ).length;
    return messageRibbon(`等待全员查看身份 · ${viewedCount}/${participants.length}`);
  }
  if (phase.kind === 'night') {
    // 夜晚横幅与狼人杀同形：共享进度派生（第x步/共y步 + 步名 + 进度条）。
    // 私密确认进度由逐座位徽标呈现（仅参与者可见），横幅不计数。
    const progress = resolveStepProgress(AVALON_NIGHT_STEPS, phase.step, AVALON_NIGHT_STEP_LABELS);
    if (progress !== null) return progressRibbon(progress);
    return messageRibbon(`天黑 · ${AVALON_NIGHT_STEP_LABELS[phase.step]}`);
  }
  if (phase.kind === 'nominate') return messageRibbon(`第 ${phase.round} 轮 · 队长组队中`);
  if (phase.kind === 'vote') {
    // 已投计数是公开信息（座位徽标同口径）；武装后进入揭晓倒计时。
    const castCount = Object.keys(phase.ballots).length;
    const totalCount = Object.keys(state.roster).length;
    return messageRibbon(
      `第 ${phase.round} 轮 · 组队投票中`,
      phase.deadlineAt !== null ? '已全部投票 · 即将揭晓' : `已投 ${castCount}/${totalCount}`,
    );
  }
  if (phase.kind === 'quest') {
    const playedCount = phase.teamSeats.filter((seat) => phase.plays[seat] !== undefined).length;
    return messageRibbon(
      `第 ${phase.round} 轮 · 任务执行中`,
      phase.deadlineAt !== null
        ? '已全部出牌 · 即将揭晓'
        : `已出牌 ${playedCount}/${phase.teamSeats.length}`,
    );
  }
  if (phase.kind === 'lady') return messageRibbon('湖中仙女查验');
  if (phase.kind === 'assassin') return messageRibbon('刺杀阶段');
  if (phase.kind === 'ended') return messageRibbon('本局已结束');
  return messageRibbon(
    buildLobbyWaitingText(getAvalonOccupiedSeatCount(state), state.config.numberOfPlayers),
  );
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
  readonly onViewRolePress: () => void;
  readonly onNightInfoPress: () => void;
}

/** 阿瓦隆底部动作：查看身份常驻局内；夜晚信息步两步确认（按钮 → 弹窗）。 */
function createAvalonBottomActions(input: AvalonBottomActionsInput): RoomBottomInfoModel {
  const { state } = input;
  const actions: RoomBottomButton[] = [];
  // 查看身份：局内常驻（对齐狼人杀）。用 effectiveSeat：房主代打 bot 时也能看 bot 的身份。
  if (!input.isLobby && input.effectiveSeat !== null) {
    actions.push({
      key: 'viewRole',
      label: '查看身份',
      variant: 'secondary',
      size: 'md',
      isEnabled: true,
      onPress: input.onViewRolePress,
      testID: 'avalon-view-role',
    });
  }
  // 晚上：两步确认（底部按钮 → 弹窗），对齐狼人杀丘比特。
  if (!input.isLobby && state.phase.kind === 'night' && input.effectiveSeat !== null) {
    const vm = getAvalonViewModel(state, input.effectiveSeat);
    const instruction = resolveNightInstruction(vm);
    if (
      instruction.kind === 'evilPeers' ||
      instruction.kind === 'merlin' ||
      instruction.kind === 'percival'
    ) {
      actions.push(
        state.isAudioPlaying
          ? buildAudioWaitingButton({ key: 'nightInfo', testID: 'avalon-night-info' })
          : {
              key: 'nightInfo',
              label: '确认信息',
              variant: 'primary',
              size: 'md',
              isEnabled: true,
              onPress: input.onNightInfoPress,
              testID: 'avalon-night-info',
            },
      );
    }
  }
  return {
    kind: 'info',
    message: input.isLobby && !input.isHost && input.mySeat !== null ? '等待房主开始游戏' : null,
    actions,
  };
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
  readonly pickedSeats: ReadonlySet<number>;
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
  readonly hostManagement: RoomHostManagementModel | null;
  readonly canControlBots: boolean;
  readonly releaseBot: () => void;
}

export interface AvalonHostManagementInput {
  readonly state: AvalonState;
  readonly isHost: boolean;
  readonly capabilities: Pick<
    RoomCapabilities,
    'canConfigureGame' | 'canFillBots' | 'canClearSeats'
  >;
  readonly isSubmitting: boolean;
  readonly controlledSeat: number | null;
  readonly releaseBot: () => void;
  readonly submit: (
    label: string,
    command: AvalonCommand,
    controlledSeatOverride?: number | null,
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
    return {
      preview: '分配角色',
      status: buildLobbyWaitingText(occupiedSeatCount, state.config.numberOfPlayers),
      sections: [
        {
          key: 'game',
          title: '游戏',
          actions: [
            buildStartGameAction({
              label: '分配角色',
              onPress: () => void submit('分配角色', { type: 'avalon.game.start' }),
              isEnabled: !input.isSubmitting && canStart,
              disabledReason: startDisabledReason,
              onDisabledPress: () =>
                showErrorAlert('暂时不能开始', startDisabledReason ?? '请稍后重试'),
              isLoading: input.isSubmitting,
            }),
          ],
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
    const sections: RoomHostManagementSection[] = [
      {
        key: 'game',
        title: '游戏',
        actions: [
          buildStartGameAction({
            onPress: () => void submit('开始游戏', { type: 'avalon.game.begin' }),
            isEnabled: !input.isSubmitting && allViewed,
            disabledReason: beginDisabledReason,
            onDisabledPress: () =>
              showErrorAlert('暂时不能开始', beginDisabledReason ?? '请稍后重试'),
            isLoading: input.isSubmitting,
          }),
        ],
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
              void submit('标记机器人已查看', { type: 'avalon.role.markAllBotsViewed' }),
            isEnabled: !input.isSubmitting,
            isLoading: input.isSubmitting,
          }),
        ],
      });
    sections.push({ key: 'room', title: '房间管理', actions: roomActions });
    return {
      preview: '开始游戏',
      status: `等待全员查看身份 · ${viewedCount}/${participants.length}`,
      sections,
    };
  }
  if (state.phase.kind === 'ended') {
    return {
      preview: '本局已结束',
      status: null,
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
        {
          key: 'finish-vote',
          label: '结束投票',
          icon: 'checkmark-done-outline',
          variant: 'primary',
          isLoading: input.isSubmitting,
          testID: 'avalon-finish-vote',
          ...(input.isSubmitting
            ? { isEnabled: false as const, disabledReason: null, onDisabledPress: null }
            : {
                isEnabled: true as const,
                onPress: () =>
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
          isLoading: input.isSubmitting,
          testID: 'avalon-finish-quest',
          ...(input.isSubmitting
            ? { isEnabled: false as const, disabledReason: null, onDisabledPress: null }
            : {
                isEnabled: true as const,
                onPress: () =>
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
              }),
        },
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
          onPress: () => void submit('标记机器人已查看', { type: 'avalon.role.markAllBotsViewed' }),
          isEnabled: !input.isSubmitting,
          isLoading: input.isSubmitting,
        }),
      ],
    });
  // 房主管理常驻（对齐狼人杀）：局内任何时候房主都能点开，房间管理区始终有，
  // 投票/任务阶段额外出现"结束投票"/"结束任务"。
  return {
    preview:
      state.phase.kind === 'vote'
        ? '结束投票'
        : state.phase.kind === 'quest'
          ? '结束任务'
          : '房主管理',
    status: null,
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
    pickedSeats: input.pickedSeats,
  });
  return {
    roomCode: input.roomCode,
    capabilities: input.capabilities,
    header: buildRoomHeaderModel({
      onBack: input.onBack,
      onTitlePress: input.onTitlePress,
      onTitleLongPress: input.onTitleLongPress,
      user: input.user,
      gachaStatus: input.gachaStatus,
      onUserActionPress: input.onUserActionPress,
    }),
    connection: input.connection,
    statusRibbon: createAvalonStatusRibbon(state),
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
      onViewRolePress: input.onViewRolePress,
      onNightInfoPress: input.onNightInfoPress,
    }),
    hostManagement: input.hostManagement,
    controlledSeat: createControlledSeatModel({
      canControlBots: input.canControlBots,
      hasBots: getAvalonBotSeats(state).length > 0,
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
