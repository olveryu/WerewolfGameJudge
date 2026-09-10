// Fashion Shadow roster projection bound to the shared seat command controller.

import type {
  FashionPublicState,
  FashionSeatProfile,
} from '@game-judge/game-engine/games/fashion-shadow/public';
import { useCallback } from 'react';

import type { User } from '@/contexts/AuthContext';
import { useRoomSeatCommands } from '@/features/room/controllers/useRoomSeatCommands';
import type { FashionRoomSession } from '@/games/fashion-shadow/model/FashionRoomSession';

interface UseFashionSeatCommandsParams {
  readonly session: FashionRoomSession;
  readonly user: User;
}

export function useFashionSeatCommands({ session, user }: UseFashionSeatCommandsParams) {
  const createProfile = useCallback(
    (): FashionSeatProfile => ({
      displayName: user.displayName ?? '匿名玩家',
      avatarUrl: user.avatarUrl ?? undefined,
      avatarFrame: user.avatarFrame ?? undefined,
      seatFlair: user.seatFlair ?? undefined,
      nameStyle: user.nameStyle ?? undefined,
      revealEffect:
        user.equippedEffect === 'random' ? undefined : (user.equippedEffect ?? undefined),
      seatAnimation: user.seatAnimation ?? undefined,
    }),
    [user],
  );

  return useRoomSeatCommands<FashionPublicState, FashionSeatProfile>({
    session,
    userId: user.id,
    createProfile,
  });
}
