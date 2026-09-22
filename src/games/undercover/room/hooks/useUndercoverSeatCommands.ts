/** Bind canonical seat operations to the authenticated Undercover account profile. */
import type { UndercoverState } from '@game-judge/game-engine/games/undercover/public';
import type { RoomSeatProfile } from '@game-judge/game-engine/platform/room/roster';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { User } from '@/contexts/AuthContext';
import { userStatsOptions } from '@/features/account/queries/accountQueryOptions';
import { useRoomSeatCommands } from '@/features/room/controllers/useRoomSeatCommands';

import type { UndercoverRoomSession } from '../../model/UndercoverRoomSession';

export function useUndercoverSeatCommands(session: UndercoverRoomSession, user: User) {
  const queryClient = useQueryClient();
  const createProfile = useCallback((): RoomSeatProfile => {
    const stats = queryClient.getQueryData(userStatsOptions(user.id).queryKey);
    return {
      displayName: user.displayName ?? '匿名玩家',
      avatarUrl: user.avatarUrl ?? undefined,
      avatarFrame: user.avatarFrame ?? undefined,
      seatFlair: user.seatFlair ?? undefined,
      nameStyle: user.nameStyle ?? undefined,
      level: user.isAnonymous ? undefined : stats?.level,
      revealEffect:
        user.equippedEffect === 'random' ? undefined : (user.equippedEffect ?? undefined),
      seatAnimation: user.seatAnimation ?? undefined,
    };
  }, [queryClient, user]);
  return useRoomSeatCommands<UndercoverState, RoomSeatProfile>({
    session,
    userId: user.id,
    createProfile,
  });
}
