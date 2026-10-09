/**
 * 把阿瓦隆权威状态投影到共享座位表与房间状态条，不暴露私密信息。
 */

import {
  type AvalonState,
  getAvalonBotDisplayName,
  getAvalonNightParticipants,
  getAvalonOccupiedSeatCount,
  getAvalonViewingParticipants,
  isAvalonImplicitBotSeat,
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
  const occupant = state.realSeats[seat];
  if (occupant !== undefined)
    return {
      seat,
      userId: occupant.userId,
      occupantKind: 'human',
      rosterName: occupant.profile.displayName,
    };
  return isAvalonImplicitBotSeat(state, seat)
    ? {
        seat,
        userId: `avalon-bot:${state.roomCode}:${seat}`,
        occupantKind: 'bot',
        rosterName: getAvalonBotDisplayName(seat),
      }
    : null;
}

function avalonSeatStatusLabel(state: AvalonState, seat: number): string | null {
  if (state.leaderSeat === seat && state.phase.kind !== 'lobby') return '队长';
  const phase = state.phase;
  if (phase.kind === 'lady' && phase.holderSeat === seat) return '湖仙';
  if (phase.kind === 'nominate' || phase.kind === 'vote') {
    const proposed = phase.kind === 'nominate' ? null : phase.proposedSeats.includes(seat);
    if (proposed === true) return '队员';
  }
  if (phase.kind === 'quest' && phase.teamSeats.includes(seat)) return '队员';
  return null;
}

/** 创建共享座位表数据源：含队长 / 队员 / 湖仙状态徽标（不暴露角色）。 */
export function createAvalonSeatDataSource(
  state: AvalonState,
  revision: number,
  userId: string,
  controlledSeat: number | null,
): RoomSeatDataSource {
  return {
    count: state.config.numberOfPlayers,
    revision: `${revision}:${controlledSeat ?? 'self'}`,
    getSeat(seat): RoomSeatViewModel {
      if (!Number.isSafeInteger(seat) || seat < 0 || seat >= state.config.numberOfPlayers)
        throw new Error('Avalon seat out of range');
      const occupant = state.realSeats[seat];
      const target = getAvalonProfileTarget(state, seat);
      const player =
        occupant !== undefined
          ? {
              kind: 'human' as const,
              userId: occupant.userId,
              ...occupant.profile,
              seatPetId: occupant.profile.revealEffect,
              isAnonymous: occupant.profile.avatarUrl === undefined,
            }
          : target === null
            ? null
            : {
                kind: 'bot' as const,
                userId: target.userId,
                displayName: target.rosterName,
                isAnonymous: true,
              };
      const statusLabel = avalonSeatStatusLabel(state, seat);
      // 对齐狼人杀：bot 座位显示身份（state.roles 是公开广播的，D6-Q1）。
      const botRole = player?.kind === 'bot' ? state.roles[seat] : undefined;
      // 投票阶段：显示已投票状态，房主可定位缺票者。
      const hasVoted = state.phase.kind === 'vote' && state.phase.ballots[seat] !== undefined;
      const voteLabel = hasVoted ? '已投票' : null;
      const combinedLabel =
        statusLabel !== null && voteLabel !== null
          ? `${statusLabel} · ${voteLabel}`
          : (voteLabel ?? statusLabel);
      return {
        seat,
        player,
        isSelf: occupant?.userId === userId,
        highlight: controlledSeat === seat ? 'controlled' : 'none',
        secondaryLabel: botRole !== undefined ? getAvalonRoleDisplayName(botRole) : null,
        showReadyBadge: false,
        statusBadge:
          combinedLabel === null
            ? null
            : {
                label: combinedLabel,
                tone: combinedLabel.includes('已投票')
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
    // 对齐狼人杀：显示确认进度。total 是当前 step 的参与者数（非全员），
    // 因为 confirmedSeats 在每次 step 推进时清零。
    const confirmed = phase.confirmedSeats.length;
    const total = stepParticipants.length;
    return { kind: 'progress', current: confirmed, total, label: '天黑确认' };
  }
  if (phase.kind === 'nominate')
    return {
      kind: 'message',
      icon: 'guide',
      text: `第 ${phase.round} 轮 · 队长组队中`,
      supportingText: null,
    };
  if (phase.kind === 'vote')
    return {
      kind: 'message',
      icon: 'guide',
      text: `第 ${phase.round} 轮 · 组队投票中`,
      supportingText: null,
    };
  if (phase.kind === 'quest')
    return {
      kind: 'message',
      icon: 'guide',
      text: `第 ${phase.round} 轮 · 任务执行中`,
      supportingText: null,
    };
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
