/**
 * 阿瓦隆对共享房间 session 的特化；传输与命令恢复仍归平台所有。
 */

import type { AvalonCommand, AvalonState } from '@game-judge/game-engine/games/avalon/public';

import type { RoomSessionClient } from '@/features/room/session/types';

export type AvalonRoomSession = RoomSessionClient<AvalonState, AvalonCommand>;

/** 找到当前用户的真实席位；被接管的机器人席位不计入用户身份。 */
export function getAvalonUserSeat(state: AvalonState, userId: string): number | null {
  return (
    Object.values(state.realSeats).find((occupant) => occupant?.userId === userId)?.seat ?? null
  );
}
