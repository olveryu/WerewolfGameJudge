/**
 * fibRoomView — Fib-specific adapters from FibState to shared room view models.
 */
import type { FibRole, FibState } from '@werewolf/game-engine/fibking/types';
import type { RosterEntry } from '@werewolf/game-engine/protocol/common';

import type { RoomSeatViewModel } from '@/components/room/RoomSeatBoard';
import type { User } from '@/contexts/AuthContext';
import { colors } from '@/theme';

const ROLE_LABEL: Record<FibRole, string> = {
  guesser: '大聪明',
  honest: '老实人',
  fibber: '瞎掰王',
};

const ROLE_BADGE_COLOR: Record<FibRole, string> = {
  guesser: colors.primary,
  honest: colors.success,
  fibber: colors.warning,
};

const FIB_REASON_TEXT: Record<string, string> = {
  NOT_LOBBY: '当前阶段不能调整座位',
  BAD_SEAT: '座位不存在',
  SEAT_TAKEN: '这个座位已经有人了',
  NOT_SEATED: '你还没有入座',
  SEAT_EMPTY: '这个座位是空的',
  NOT_FULL: '还有空位未入座',
  BAD_PLAYER_COUNT: '人数至少需要 4 人',
  SEAT_OCCUPIED_ABOVE_LIMIT: '缩小人数前请先移出超出范围的座位',
  NOT_PLAYING: '当前阶段不能执行这个操作',
  WORD_GEN_FAILED: '出题失败，请稍后重试',
};

export function getFibReasonMessage(reason: string | undefined): string {
  if (!reason) return '请稍后重试';
  return FIB_REASON_TEXT[reason] ?? '请稍后重试';
}

export function userToFibRosterProfile(user: User): RosterEntry {
  return {
    displayName: user.displayName ?? '玩家',
    avatarUrl: user.customAvatarUrl ?? user.avatarUrl ?? undefined,
    avatarFrame: user.avatarFrame ?? undefined,
    seatFlair: user.seatFlair ?? undefined,
    nameStyle: user.nameStyle ?? undefined,
    roleRevealEffect: user.equippedEffect ?? undefined,
    seatAnimation: user.seatAnimation ?? undefined,
  };
}

export function countFibSeatedPlayers(state: FibState): number {
  return Object.keys(state.seats).length;
}

export function findFibSeatByUserId(state: FibState | null, userId: string | null): number | null {
  if (!state || !userId) return null;
  for (const [seat, occupant] of Object.entries(state.seats)) {
    if (occupant.userId === userId) return Number(seat);
  }
  return null;
}

function getFibGuesserSeat(state: FibState): number | null {
  if (!state.roleBySeat) return null;
  for (const [seat, role] of Object.entries(state.roleBySeat)) {
    if (role === 'guesser') return Number(seat);
  }
  return null;
}

export function getFibDisplayName(state: FibState, seat: number, userId: string): string {
  return state.roster[userId]?.displayName ?? `玩家${seat + 1}`;
}

export function createFibSeatViewModels(
  state: FibState,
  mySeat: number | null,
): RoomSeatViewModel[] {
  const revealed = state.phase === 'Revealed';
  return Array.from({ length: state.numberOfPlayers }, (_, seat) => {
    const occupant = state.seats[seat] ?? null;
    const role = state.roleBySeat?.[seat];
    const showRole = role !== undefined && (revealed || role === 'guesser');
    const roster = occupant ? state.roster[occupant.userId] : undefined;
    return {
      seat,
      player: occupant
        ? {
            userId: occupant.userId,
            displayName: roster?.displayName ?? `玩家${seat + 1}`,
            avatarUrl: roster?.avatarUrl,
            avatarFrame: roster?.avatarFrame,
            seatFlair: roster?.seatFlair,
            seatAnimation: roster?.seatAnimation,
            nameStyle: roster?.nameStyle,
            roleRevealEffect: roster?.roleRevealEffect,
          }
        : null,
      isMySpot: mySeat === seat,
      statusBadgeText: showRole ? ROLE_LABEL[role] : undefined,
      statusBadgeColor: showRole ? ROLE_BADGE_COLOR[role] : undefined,
    };
  });
}

export function getFibSummaryTitle(state: FibState, filled: number): string {
  if (state.phase === 'Lobby') return `等待入座 · ${filled}/${state.numberOfPlayers}`;
  if (state.phase === 'Starting') return '出题中';
  if (state.phase === 'Playing') {
    const guesserSeat = getFibGuesserSeat(state);
    return `本轮进行中${guesserSeat !== null ? ` · 大聪明 ${guesserSeat + 1} 号` : ''}`;
  }
  return '答案已公布';
}

export function getFibSummaryBody(state: FibState): string {
  if (state.phase === 'Lobby') return '坐满后房主开始本轮。可以点空位入座或换座。';
  if (state.phase === 'Starting') return '正在抽生僻词并分配身份。';
  if (state.phase === 'Playing') return '轮流口头解释词义，大聪明听完后指认老实人。';
  return '查看真词、真释义和全部身份。';
}
