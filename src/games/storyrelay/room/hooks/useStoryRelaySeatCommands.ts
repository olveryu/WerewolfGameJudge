/** Binds shared roster commands to the authenticated Story Relay profile. */

import type { StoryRelayState } from '@game-judge/game-engine/games/storyrelay/public';
import type { RoomSeatProfile } from '@game-judge/game-engine/platform/room/roster';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { User } from '@/contexts/AuthContext';
import { useRoomSeatCommands } from '@/features/room/controllers/useRoomSeatCommands';
import { createSeatProfile } from '@/features/room/model/createSeatProfile';
import type { StoryRelayRoomSession } from '@/games/storyrelay/model/StoryRelayRoomSession';

/** Uses canonical profile fields and the shared command client for every seat mutation. */
export function useStoryRelaySeatCommands(session: StoryRelayRoomSession, user: User) {
  const queryClient = useQueryClient();
  const createProfile = useCallback(
    (identity: { readonly room: { readonly roomCode: string } }): RoomSeatProfile =>
      createSeatProfile(user, queryClient, identity.room.roomCode),
    [queryClient, user],
  );
  return useRoomSeatCommands<StoryRelayState, RoomSeatProfile>({
    session,
    userId: user.id,
    createProfile,
  });
}
