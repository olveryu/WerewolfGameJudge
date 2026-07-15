/** FibKing roster projection bound to the canonical shared seat-command client. */

import { useQueryClient } from '@tanstack/react-query';
import type { FibSeatProfile, FibState } from '@werewolf/game-engine/games/fibking/public';
import { useCallback } from 'react';

import type { User } from '@/contexts/AuthContext';
import { useRoomSeatCommands as useSharedRoomSeatCommands } from '@/features/room/controllers/useRoomSeatCommands';
import type { FibRoomSession } from '@/games/fibking/model/FibRoomSession';
import { userStatsOptions } from '@/hooks/queries/queryOptions';

interface UseFibSeatCommandsParams {
  readonly session: FibRoomSession;
  readonly user: User;
}

export function useFibSeatCommands({ session, user }: UseFibSeatCommandsParams) {
  const queryClient = useQueryClient();
  const createProfile = useCallback(() => {
    const cachedStats = queryClient.getQueryData(userStatsOptions().queryKey);
    const profile: FibSeatProfile = {
      displayName: user.displayName ?? '匿名玩家',
      avatarUrl: user.avatarUrl ?? undefined,
      avatarFrame: user.avatarFrame ?? undefined,
      seatFlair: user.seatFlair ?? undefined,
      nameStyle: user.nameStyle ?? undefined,
      level: user.isAnonymous ? undefined : cachedStats?.level,
      revealEffect:
        user.equippedEffect === 'random' ? undefined : (user.equippedEffect ?? undefined),
      seatAnimation: user.seatAnimation ?? undefined,
    };
    return profile;
  }, [queryClient, user]);

  return useSharedRoomSeatCommands<FibState, FibSeatProfile>({
    session,
    userId: user.id,
    createProfile,
  });
}
