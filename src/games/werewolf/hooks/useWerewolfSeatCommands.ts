/** Werewolf profile projection bound to the shared canonical seat-command client. */

import { useQueryClient } from '@tanstack/react-query';
import type { WerewolfPublicCommand, WerewolfSeatProfile } from '@werewolf/game-engine';
import type { GameState } from '@werewolf/game-engine/protocol/types';
import { resolveRandomAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';
import { useCallback, useMemo } from 'react';

import type { User } from '@/contexts/AuthContext';
import type { RoomOperationResult } from '@/features/room/model/RoomCapabilities';
import {
  clearRoomSeats,
  fillRoomSeatsWithBots,
  kickRoomSeat,
  leaveRoomSeat,
  type RoomSeatCommandContext,
  takeRoomSeat,
} from '@/features/room/session/roomSeatCommandClient';
import type { RoomSessionClient } from '@/features/room/session/types';
import { createWerewolfDefaultDisplayName } from '@/games/werewolf/profile/createWerewolfDefaultDisplayName';
import type { WerewolfUserEvent } from '@/games/werewolf/realtime/werewolfUserEventCodec';
import { userStatsOptions } from '@/hooks/queries/queryOptions';

export interface WerewolfSeatCommands {
  readonly takeSeat: (seat: number) => Promise<RoomOperationResult>;
  readonly leaveSeat: () => Promise<RoomOperationResult>;
  readonly kickSeat: (seat: number) => Promise<RoomOperationResult>;
  readonly clearSeats: () => Promise<RoomOperationResult>;
  readonly fillBots: () => Promise<RoomOperationResult>;
}

interface UseWerewolfSeatCommandsParams {
  readonly session: RoomSessionClient<GameState, WerewolfPublicCommand, WerewolfUserEvent>;
  readonly user: User;
}

export function useWerewolfSeatCommands({
  session,
  user,
}: UseWerewolfSeatCommandsParams): WerewolfSeatCommands {
  const queryClient = useQueryClient();
  const sessionSnapshot = session.getSnapshot();
  if (sessionSnapshot.phase !== 'ready') {
    throw new Error('[FAIL-FAST] Werewolf seat commands require a ready room session');
  }
  if (sessionSnapshot.identity.userId !== user.id) {
    throw new Error('[FAIL-FAST] Auth profile does not match the active room identity');
  }

  const context = useMemo<RoomSeatCommandContext<GameState, WerewolfSeatProfile>>(
    () => ({
      dispatch: (command, options) => session.dispatch(command, options),
    }),
    [session],
  );
  const identity = sessionSnapshot.identity;

  const takeSeat = useCallback(
    (seat: number) => {
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
        roleRevealEffect: equippedEffect,
        seatAnimation: user.seatAnimation ?? undefined,
      };
      return takeRoomSeat(context, seat, profile);
    },
    [context, identity, queryClient, user],
  );

  return useMemo(
    () => ({
      takeSeat,
      leaveSeat: () => leaveRoomSeat(context),
      kickSeat: (seat: number) => kickRoomSeat(context, seat),
      clearSeats: () => clearRoomSeats(context),
      fillBots: () => fillRoomSeatsWithBots(context),
    }),
    [context, takeSeat],
  );
}
