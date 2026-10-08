/** Bind canonical seat operations to the authenticated Undercover account profile. */
import type { UndercoverState } from '@game-judge/game-engine/games/undercover/public';
import type { RoomSeatProfile } from '@game-judge/game-engine/platform/room/roster';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { User } from '@/contexts/AuthContext';
import { useRoomSeatCommands } from '@/features/room/controllers/useRoomSeatCommands';
import { createSeatProfile } from '@/features/room/model/createSeatProfile';

import type { UndercoverRoomSession } from '../../model/UndercoverRoomSession';

export function useUndercoverSeatCommands(session: UndercoverRoomSession, user: User) {
  const queryClient = useQueryClient();
  const createProfile = useCallback(
    (identity: { readonly room: { readonly roomCode: string } }): RoomSeatProfile =>
      createSeatProfile(user, queryClient, identity.room.roomCode),
    [queryClient, user],
  );
  return useRoomSeatCommands<UndercoverState, RoomSeatProfile>({
    session,
    userId: user.id,
    createProfile,
  });
}
