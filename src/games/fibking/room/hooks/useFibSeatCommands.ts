/** FibKing roster projection bound to the canonical shared seat-command client. */

import type { FibSeatProfile, FibState } from '@game-judge/game-engine/games/fibking/public';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { User } from '@/contexts/AuthContext';
import { useRoomSeatCommands as useSharedRoomSeatCommands } from '@/features/room/controllers/useRoomSeatCommands';
import { createSeatProfile } from '@/features/room/model/createSeatProfile';
import type { FibRoomSession } from '@/games/fibking/model/FibRoomSession';

interface UseFibSeatCommandsParams {
  readonly session: FibRoomSession;
  readonly user: User;
}

export function useFibSeatCommands({ session, user }: UseFibSeatCommandsParams) {
  const queryClient = useQueryClient();
  const createProfile = useCallback(
    (identity: { readonly room: { readonly roomCode: string } }): FibSeatProfile =>
      createSeatProfile(user, queryClient, identity.room.roomCode),
    [queryClient, user],
  );

  return useSharedRoomSeatCommands<FibState, FibSeatProfile>({
    session,
    userId: user.id,
    createProfile,
  });
}
