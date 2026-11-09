/**
 * 在 realSeats 中查找某个真实账号的座位号。
 *
 * 6 个 realSeats 型游戏（avalon/drawguess/fibking/pictionary/storyrelay/undercover）
 * 逻辑完全一致，此前各写一份。狼人杀不用 realSeats（走 players），不适用。
 */

export interface UserSeatOccupant {
  readonly userId: string;
  readonly seat: number;
}

export function getUserSeat(
  realSeats: Readonly<Record<number, UserSeatOccupant | null | undefined>>,
  userId: string,
): number | null {
  for (const occupant of Object.values(realSeats)) {
    if (occupant?.userId === userId) return occupant.seat;
  }
  return null;
}
