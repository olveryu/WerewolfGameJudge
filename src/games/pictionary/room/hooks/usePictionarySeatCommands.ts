/** Pictionary roster projection bound to the canonical shared seat-command client. */

import type {
  PictionarySeatProfile,
  PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { User } from '@/contexts/AuthContext';
import { userStatsOptions } from '@/features/account/queries/accountQueryOptions';
import { useRoomSeatCommands } from '@/features/room/controllers/useRoomSeatCommands';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';

interface UsePictionarySeatCommandsParams {
  readonly session: PictionaryRoomSession;
  readonly user: User;
}

export function usePictionarySeatCommands({ session, user }: UsePictionarySeatCommandsParams) {
  const queryClient = useQueryClient();
  const createProfile = useCallback((): PictionarySeatProfile => {
    const cachedStats = queryClient.getQueryData(userStatsOptions().queryKey);
    return {
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
  }, [queryClient, user]);

  return useRoomSeatCommands<PictionaryState, PictionarySeatProfile>({
    session,
    userId: user.id,
    createProfile,
  });
}
