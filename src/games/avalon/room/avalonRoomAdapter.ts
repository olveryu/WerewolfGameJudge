/**
 * 把阿瓦隆权威状态投影到共享座位表与房间状态条，不暴露私密信息。
 */

import {
  type AvalonNightStep,
  type AvalonState,
  getAvalonBotDisplayName,
  getAvalonNightParticipants,
  getAvalonOccupiedSeatCount,
  getAvalonUserSeat,
  getAvalonViewingParticipants,
  isAvalonBotSeat,
  isBotOccupant,
} from '@game-judge/game-engine/games/avalon/public';

import type { RoomProfileTarget } from '@/features/room/model/RoomCapabilities';
import type {
  RoomSeatDataSource,
  RoomSeatViewModel,
} from '@/features/room/model/RoomSeatDataSource';
import type { RoomStatusRibbonModel } from '@/features/room/model/RoomShellModel';

import { getAvalonRoleDisplayName } from '../model/avalonRoleDisplay';

/** 为共享资料卡控件返回公开的席位身份。 */
export function getAvalonProfileTarget(state: AvalonState, seat: number): RoomProfileTarget | null {
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
export function createAvalonSeatDataSource(
  state: AvalonState,
  revision: number,
  userId: string,
  controlledSeat: number | null,
  pickedSeats: ReadonlySet<number> = NO_PICKED_SEATS,
): RoomSeatDataSource {
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
          ? {
              kind: 'human' as const,
              userId: human.userId,
              ...human.profile,
              seatPetId: human.profile.revealEffect,
              isAnonymous: human.profile.avatarUrl === undefined,
            }
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
        // 夜晚逐座位已查看身份徽标（公开信息，对齐狼人杀 hasViewedRole ✅）。
        showReadyBadge: nightPhase !== null && state.roleViewedSeats.includes(seat),
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
export function createAvalonStatusRibbon(state: AvalonState): RoomStatusRibbonModel {
  const phase = state.phase;
  if (phase.kind === 'night') {
    // 身份查看协议检查点：夜晚信息步已走完但还有真人没看角色时，
    // 状态条明示阻塞原因（座位级名单在房主管理区，状态条只报人数）。
    const stepParticipants = getAvalonNightParticipants(state.roles, phase.step);
    const unviewedHumans = getAvalonViewingParticipants(state).filter(
      (participant) => !participant.isBot && !state.roleViewedSeats.includes(participant.seat),
    ).length;
    if (
      phase.step === 'percivalReveal' &&
      unviewedHumans > 0 &&
      stepParticipants.every((seat) => phase.confirmedSeats.includes(seat))
    ) {
      return {
        kind: 'message',
        icon: 'guide',
        text: `等待全员查看身份 · 还差 ${unviewedHumans} 人`,
        supportingText: null,
      };
    }
    // 夜晚只报当前步名：私密确认进度改由逐座位徽标呈现（仅参与者可见），不计数。
    return {
      kind: 'message',
      icon: 'guide',
      text: `天黑 · ${AVALON_NIGHT_STEP_LABELS[phase.step]}`,
      supportingText: null,
    };
  }
  if (phase.kind === 'nominate')
    return {
      kind: 'message',
      icon: 'guide',
      text: `第 ${phase.round} 轮 · 队长组队中`,
      supportingText: null,
    };
  if (phase.kind === 'vote') {
    // 已投计数是公开信息（座位徽标同口径）；武装后进入揭晓倒计时。
    const castCount = Object.keys(phase.ballots).length;
    const totalCount = Object.keys(state.roster).length;
    return {
      kind: 'message',
      icon: 'guide',
      text: `第 ${phase.round} 轮 · 组队投票中`,
      supportingText:
        phase.deadlineAt !== null ? '已全部投票 · 即将揭晓' : `已投 ${castCount}/${totalCount}`,
    };
  }
  if (phase.kind === 'quest') {
    const playedCount = phase.teamSeats.filter((seat) => phase.plays[seat] !== undefined).length;
    return {
      kind: 'message',
      icon: 'guide',
      text: `第 ${phase.round} 轮 · 任务执行中`,
      supportingText:
        phase.deadlineAt !== null
          ? '已全部出牌 · 即将揭晓'
          : `已出牌 ${playedCount}/${phase.teamSeats.length}`,
    };
  }
  if (phase.kind === 'lady')
    return { kind: 'message', icon: 'guide', text: '湖中仙女查验', supportingText: null };
  if (phase.kind === 'assassin')
    return { kind: 'message', icon: 'guide', text: '刺杀阶段', supportingText: null };
  if (phase.kind === 'ended')
    return { kind: 'message', icon: 'guide', text: '本局已结束', supportingText: null };
  return {
    kind: 'message',
    icon: 'guide',
    text: `等待入座 · ${getAvalonOccupiedSeatCount(state)}/${state.config.numberOfPlayers}`,
    supportingText: null,
  };
}
