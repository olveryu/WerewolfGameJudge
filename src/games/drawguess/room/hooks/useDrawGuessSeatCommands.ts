/**
 * 把共享座位命令绑定到已认证的你画我猜资料。
 */

import type { DrawGuessState } from '@game-judge/game-engine/games/drawguess/public';
import type { RoomSeatProfile } from '@game-judge/game-engine/platform/room/roster';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { User } from '@/contexts/AuthContext';
import { useRoomSeatCommands } from '@/features/room/controllers/useRoomSeatCommands';
import { createSeatProfile } from '@/features/room/model/createSeatProfile';
import type { DrawGuessRoomSession } from '@/games/drawguess/model/DrawGuessRoomSession';

/** 使用标准资料字段与共享命令客户端处理全部座位变更。 */
export function useDrawGuessSeatCommands(session: DrawGuessRoomSession, user: User) {
  const queryClient = useQueryClient();
  const createProfile = useCallback(
    (identity: { readonly room: { readonly roomCode: string } }): RoomSeatProfile =>
      createSeatProfile(user, queryClient, identity.room.roomCode),
    [queryClient, user],
  );
  return useRoomSeatCommands<DrawGuessState, RoomSeatProfile>({
    session,
    userId: user.id,
    createProfile,
  });
}
