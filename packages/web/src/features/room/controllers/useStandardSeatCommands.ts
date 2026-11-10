/**
 * Standard seat-command binding shared by every room game.
 *
 * Binds the canonical seat-command controller to the authenticated user:
 * builds the createProfile callback from the user and the active room
 * identity, and passes user.id through as the expected identity. Games
 * differ only in the state type argument; the binding itself lives here
 * exactly once.
 */

import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import type { RoomSeatProfile } from '@game-judge/game-engine/platform/room/roster';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { User } from '@/contexts/AuthContext';
import {
  type RoomSeatCommandOperations,
  type RoomSeatSession,
  useRoomSeatCommands,
} from '@/features/room/controllers/useRoomSeatCommands';
import { createSeatProfile } from '@/features/room/model/createSeatProfile';
import type { RoomIdentity } from '@/platform/realtime/types';

/** Handles every seat mutation through the shared command client with the standard profile fields. */
export function useStandardSeatCommands<TState extends BaseGameState<string>>(
  session: RoomSeatSession<TState, RoomSeatProfile>,
  user: User,
): RoomSeatCommandOperations<TState> {
  const queryClient = useQueryClient();
  const createProfile = useCallback(
    (identity: RoomIdentity<TState['gameType']>): RoomSeatProfile => {
      const profile = createSeatProfile(user, queryClient, identity.room.roomCode);
      return profile;
    },
    [queryClient, user],
  );
  return useRoomSeatCommands<TState, RoomSeatProfile>({
    session,
    userId: user.id,
    createProfile,
  });
}
