/**
 * 把你画我猜权威状态投影到共享座位表与房间状态条，不暴露答案。
 */

import {
  type DrawGuessState,
  getDrawGuessBotDisplayName,
  getDrawGuessOccupiedSeatCount,
  isDrawGuessImplicitBotSeat,
} from '@game-judge/game-engine/games/drawguess/public';

import type { RoomProfileTarget } from '@/features/room/model/RoomCapabilities';
import type {
  RoomSeatDataSource,
  RoomSeatViewModel,
} from '@/features/room/model/RoomSeatDataSource';
import type { RoomStatusRibbonModel } from '@/features/room/model/RoomShellModel';

/** 为共享资料卡控件返回公开的席位身份。 */
export function getDrawGuessProfileTarget(
  state: DrawGuessState,
  seat: number,
): RoomProfileTarget | null {
  const occupant = state.realSeats[seat];
  if (occupant !== undefined)
    return {
      seat,
      userId: occupant.userId,
      occupantKind: 'human',
      rosterName: occupant.profile.displayName,
    };
  return isDrawGuessImplicitBotSeat(state, seat)
    ? {
        seat,
        userId: `drawguess-bot:${state.roomCode}:${seat}`,
        occupantKind: 'bot',
        rosterName: getDrawGuessBotDisplayName(seat),
      }
    : null;
}

function drawerStatusLabel(state: DrawGuessState, seat: number): string | null {
  const phase = state.phase;
  if ((phase.kind === 'wordSelect' || phase.kind === 'drawing') && phase.drawerSeat === seat)
    return '画手中';
  if (phase.kind === 'drawing' && phase.guessedSeats.includes(seat)) return '已猜中';
  return null;
}

/** 创建共享座位表数据源：含画手/已猜中状态徽标。 */
export function createDrawGuessSeatDataSource(
  state: DrawGuessState,
  revision: number,
  userId: string,
  controlledSeat: number | null,
): RoomSeatDataSource {
  return {
    count: state.config.numberOfPlayers,
    revision: `${revision}:${controlledSeat ?? 'self'}`,
    getSeat(seat): RoomSeatViewModel {
      if (!Number.isSafeInteger(seat) || seat < 0 || seat >= state.config.numberOfPlayers)
        throw new Error('DrawGuess seat out of range');
      const occupant = state.realSeats[seat];
      const target = getDrawGuessProfileTarget(state, seat);
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
      const statusLabel = drawerStatusLabel(state, seat);
      return {
        seat,
        player,
        isSelf: occupant?.userId === userId,
        highlight: controlledSeat === seat ? 'controlled' : 'none',
        secondaryLabel: null,
        showReadyBadge: false,
        statusBadge:
          statusLabel === null
            ? null
            : { label: statusLabel, tone: statusLabel === '已猜中' ? 'success' : 'warning' },
        isStatusEmphasized: false,
        showLevel: state.phase.kind === 'lobby',
        decorationsEnabled: state.phase.kind === 'lobby',
        disabledReason:
          player === null && state.phase.kind !== 'lobby' ? '游戏进行中不能入座' : undefined,
      };
    },
  };
}

/** 公共状态条：不含答案与题目内容。 */
export function createDrawGuessStatusRibbon(state: DrawGuessState): RoomStatusRibbonModel {
  const phase = state.phase;
  if (phase.kind === 'wordSelect')
    return { kind: 'message', icon: 'guide', text: '画手正在选词', supportingText: null };
  if (phase.kind === 'drawing')
    return { kind: 'message', icon: 'guide', text: '作画猜词中', supportingText: null };
  if (phase.kind === 'roundEnd')
    return { kind: 'message', icon: 'guide', text: '本轮结算', supportingText: null };
  if (phase.kind === 'ended')
    return { kind: 'message', icon: 'guide', text: '本局已结束', supportingText: null };
  return {
    kind: 'message',
    icon: 'guide',
    text: `等待入座 · ${getDrawGuessOccupiedSeatCount(state)}/${state.config.numberOfPlayers}`,
    supportingText: null,
  };
}
