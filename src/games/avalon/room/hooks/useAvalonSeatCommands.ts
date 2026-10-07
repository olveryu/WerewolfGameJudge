/**
 * 把共享座位命令绑定到已认证的阿瓦隆资料。
 */

import type { AvalonState } from '@game-judge/game-engine/games/avalon/public';
import type { RoomSeatProfile } from '@game-judge/game-engine/platform/room/roster';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { User } from '@/contexts/AuthContext';
import { userStatsOptions } from '@/features/account/queries/accountQueryOptions';
import { useRoomSeatCommands } from '@/features/room/controllers/useRoomSeatCommands';
import type { AvalonRoomSession } from '@/games/avalon/model/AvalonRoomSession';

/** 使用标准资料字段与共享命令客户端处理全部座位变更。 */
export function useAvalonSeatCommands(session: AvalonRoomSession, user: User) {
  const queryClient = useQueryClient();
  const createProfile = useCallback(
    (): RoomSeatProfile => ({
      displayName: user.displayName ?? '匿名玩家',
      avatarUrl: user.avatarUrl ?? undefined,
      avatarFrame: user.avatarFrame ?? undefined,
      seatFlair: user.seatFlair ?? undefined,
      seatAnimation: user.seatAnimation ?? undefined,
      nameStyle: user.nameStyle ?? undefined,
      revealEffect:
        user.equippedEffect === 'random' ? undefined : (user.equippedEffect ?? undefined),
      level: user.isAnonymous
        ? undefined
        : queryClient.getQueryData(userStatsOptions(user.id).queryKey)?.level,
    }),
    [queryClient, user],
  );
  return useRoomSeatCommands<AvalonState, RoomSeatProfile>({
    session,
    userId: user.id,
    createProfile,
  });
}
