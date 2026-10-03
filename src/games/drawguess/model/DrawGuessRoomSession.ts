/**
 * 你画我猜对共享房间 session 的特化；传输与命令恢复仍归平台所有。
 */

import type {
  DrawGuessCommand,
  DrawGuessState,
} from '@game-judge/game-engine/games/drawguess/public';

import type { RoomSessionClient } from '@/features/room/session/types';

export type DrawGuessRoomSession = RoomSessionClient<DrawGuessState, DrawGuessCommand>;

/** 找到当前用户的真实席位；被接管的机器人席位不计入用户身份。 */
export function getDrawGuessUserSeat(state: DrawGuessState, userId: string): number | null {
  return (
    Object.values(state.realSeats).find((occupant) => occupant?.userId === userId)?.seat ?? null
  );
}
