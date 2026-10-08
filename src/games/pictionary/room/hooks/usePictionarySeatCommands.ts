/** Pictionary roster projection bound to the canonical shared seat-command client. */

import type {
  PictionarySeatProfile,
  PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { User } from '@/contexts/AuthContext';
import { useRoomSeatCommands } from '@/features/room/controllers/useRoomSeatCommands';
import { createSeatProfile } from '@/features/room/model/createSeatProfile';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';

interface UsePictionarySeatCommandsParams {
  readonly session: PictionaryRoomSession;
  readonly user: User;
}

export function usePictionarySeatCommands({ session, user }: UsePictionarySeatCommandsParams) {
  const queryClient = useQueryClient();
  const createProfile = useCallback(
    (identity: { readonly room: { readonly roomCode: string } }): PictionarySeatProfile =>
      createSeatProfile(user, queryClient, identity.room.roomCode),
    [queryClient, user],
  );

  return useRoomSeatCommands<PictionaryState, PictionarySeatProfile>({
    session,
    userId: user.id,
    createProfile,
  });
}
