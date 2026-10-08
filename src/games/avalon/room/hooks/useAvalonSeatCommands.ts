/**
 * 把共享座位命令绑定到已认证的阿瓦隆资料。
 */

import type { AvalonState } from '@game-judge/game-engine/games/avalon/public';
import type { RoomSeatProfile } from '@game-judge/game-engine/platform/room/roster';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { User } from '@/contexts/AuthContext';
import { useRoomSeatCommands } from '@/features/room/controllers/useRoomSeatCommands';
import { createSeatProfile } from '@/features/room/model/createSeatProfile';
import type { AvalonRoomSession } from '@/games/avalon/model/AvalonRoomSession';

/** 使用标准资料字段与共享命令客户端处理全部座位变更。 */
export function useAvalonSeatCommands(session: AvalonRoomSession, user: User) {
  const queryClient = useQueryClient();
  const createProfile = useCallback(
    (identity: { readonly room: { readonly roomCode: string } }): RoomSeatProfile =>
      createSeatProfile(user, queryClient, identity.room.roomCode),
    [queryClient, user],
  );
  return useRoomSeatCommands<AvalonState, RoomSeatProfile>({
    session,
    userId: user.id,
    createProfile,
  });
}
