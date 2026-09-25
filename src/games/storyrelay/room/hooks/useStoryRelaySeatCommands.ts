/** Binds shared roster commands to the authenticated Story Relay profile. */

import type { StoryRelayState } from '@game-judge/game-engine/games/storyrelay/public';
import type { RoomSeatProfile } from '@game-judge/game-engine/platform/room/roster';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { User } from '@/contexts/AuthContext';
import { userStatsOptions } from '@/features/account/queries/accountQueryOptions';
import { useRoomSeatCommands } from '@/features/room/controllers/useRoomSeatCommands';
import type { StoryRelayRoomSession } from '@/games/storyrelay/model/StoryRelayRoomSession';

/** Uses canonical profile fields and the shared command client for every seat mutation. */
export function useStoryRelaySeatCommands(session: StoryRelayRoomSession, user: User) {
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
  return useRoomSeatCommands<StoryRelayState, RoomSeatProfile>({
    session,
    userId: user.id,
    createProfile,
  });
}
