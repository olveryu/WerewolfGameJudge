/** Werewolf profile projection bound to the shared canonical seat-command client. */

import { useQueryClient } from '@tanstack/react-query';
import type {
  WerewolfPublicCommand,
  WerewolfSeatProfile,
} from '@werewolf/game-engine/games/werewolf/public';
import type { GameState } from '@werewolf/game-engine/games/werewolf/public';
import { resolveRandomAnimation } from '@werewolf/game-engine/growth/revealEffect';
import { useCallback } from 'react';

import type { User } from '@/contexts/AuthContext';
import { useRoomSeatCommands as useSharedRoomSeatCommands } from '@/features/room/controllers/useRoomSeatCommands';
import type { ActiveRoomIdentity } from '@/features/room/session/types';
import type { RoomSessionClient } from '@/features/room/session/types';
import { createWerewolfDefaultDisplayName } from '@/games/werewolf/profile/createWerewolfDefaultDisplayName';
import type { WerewolfUserEvent } from '@/games/werewolf/realtime/werewolfUserEventCodec';
import { userStatsOptions } from '@/hooks/queries/queryOptions';

interface UseWerewolfSeatCommandsParams {
  readonly session: RoomSessionClient<GameState, WerewolfPublicCommand, WerewolfUserEvent>;
  readonly user: User;
}

export function useWerewolfSeatCommands({ session, user }: UseWerewolfSeatCommandsParams) {
  const queryClient = useQueryClient();
  const createProfile = useCallback(
    (identity: ActiveRoomIdentity) => {
      const cachedStats = queryClient.getQueryData(userStatsOptions().queryKey);
      const equippedEffect =
        user.equippedEffect === 'random'
          ? resolveRandomAnimation(identity.room.roomCode + identity.userId)
          : (user.equippedEffect ?? undefined);
      const profile: WerewolfSeatProfile = {
        displayName:
          user.displayName ??
          createWerewolfDefaultDisplayName(`${identity.room.roomId}:${identity.userId}`),
        avatarUrl: user.avatarUrl ?? undefined,
        avatarFrame: user.avatarFrame ?? undefined,
        seatFlair: user.seatFlair ?? undefined,
        nameStyle: user.nameStyle ?? undefined,
        level: user.isAnonymous ? undefined : cachedStats?.level,
        revealEffect: equippedEffect,
        seatAnimation: user.seatAnimation ?? undefined,
      };
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
