/** Werewolf profile projection bound to the shared canonical seat-command client. */

import type {
  WerewolfPublicCommand,
  WerewolfSeatProfile,
} from '@game-judge/game-engine/games/werewolf/public';
import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { User } from '@/contexts/AuthContext';
import { useRoomSeatCommands as useSharedRoomSeatCommands } from '@/features/room/controllers/useRoomSeatCommands';
import { createSeatProfile } from '@/features/room/model/createSeatProfile';
import type { ActiveRoomIdentity } from '@/features/room/session/types';
import type { RoomSessionClient } from '@/features/room/session/types';

interface UseWerewolfSeatCommandsParams {
  readonly session: RoomSessionClient<GameState, WerewolfPublicCommand>;
  readonly user: User;
}

export function useWerewolfSeatCommands({ session, user }: UseWerewolfSeatCommandsParams) {
  const queryClient = useQueryClient();
  const createProfile = useCallback(
    (identity: ActiveRoomIdentity<'werewolf'>) => {
      const profile = createSeatProfile(user, queryClient, identity.room.roomCode);
      // WerewolfSeatProfile is compatible with RoomSeatProfile
      return profile;
    },
    [queryClient, user],
  );

  return useSharedRoomSeatCommands<GameState, WerewolfSeatProfile>({
    session,
    userId: user.id,
    createProfile,
  });
}
