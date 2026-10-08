/**
 * Shared seat profile builder.
 *
 * Builds the `RoomSeatProfile` for a player joining a seat, from their
 * user object and cached stats. Used by all games to ensure consistent
 * profile fields (displayName, avatar, decorations, reveal effect, level).
 */

import type { RoomSeatProfile } from '@game-judge/game-engine/platform/room/roster';
import type { QueryClient } from '@tanstack/react-query';

import { userStatsOptions } from '@/features/account/queries/accountQueryOptions';

import { resolveEquippedRevealEffect } from './resolveEquippedRevealEffect';

interface SeatProfileUser {
  readonly id: string;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  readonly avatarFrame: string | null;
  readonly seatFlair: string | null;
  readonly seatAnimation: string | null;
  readonly nameStyle: string | null;
  readonly equippedEffect: string | null;
  readonly isAnonymous: boolean;
}

export function createSeatProfile(
  user: SeatProfileUser,
  queryClient: QueryClient,
  roomCode: string,
): RoomSeatProfile {
  const cachedStats = queryClient.getQueryData(userStatsOptions(user.id).queryKey);
  const revealEffect = resolveEquippedRevealEffect(user.equippedEffect, roomCode, user.id);
  return {
    displayName: user.displayName ?? '匿名玩家',
    avatarUrl: user.avatarUrl ?? undefined,
    avatarFrame: user.avatarFrame ?? undefined,
    seatFlair: user.seatFlair ?? undefined,
    seatAnimation: user.seatAnimation ?? undefined,
    nameStyle: user.nameStyle ?? undefined,
    revealEffect: revealEffect ?? undefined,
    level: user.isAnonymous ? undefined : cachedStats?.level,
  };
}
