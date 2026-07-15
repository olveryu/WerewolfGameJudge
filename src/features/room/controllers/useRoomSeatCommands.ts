/** Canonical seat-command controller shared by every room game. */

import type { RoomSeatCommand } from '@werewolf/game-engine/platform/protocol/commands';
import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type { BaseGameState } from '@werewolf/game-engine/platform/protocol/roomSnapshot';
import { useCallback, useMemo } from 'react';

import type { RoomOperationResult } from '@/features/room/model/RoomCapabilities';
import {
  clearRoomSeats,
  fillRoomSeatsWithBots,
  kickRoomSeat,
  leaveRoomSeat,
  type RoomSeatCommandContext,
  takeRoomSeat,
} from '@/features/room/session/roomSeatCommandClient';
import type {
  ActiveRoomIdentity,
  RoomCommandDispatchOptions,
  RoomCommandDispatchOutcome,
  RoomSessionSnapshot,
} from '@/features/room/session/types';

interface RoomSeatSession<TState extends BaseGameState<GameType>, TProfile> {
  getSnapshot(): RoomSessionSnapshot<TState>;
  dispatch(
    command: RoomSeatCommand<TProfile>,
    options: RoomCommandDispatchOptions,
  ): Promise<RoomCommandDispatchOutcome<TState>>;
}

export interface RoomSeatCommandOperations {
  readonly takeSeat: (seat: number) => Promise<RoomOperationResult>;
  readonly leaveSeat: () => Promise<RoomOperationResult>;
  readonly kickSeat: (seat: number) => Promise<RoomOperationResult>;
  readonly clearSeats: () => Promise<RoomOperationResult>;
  readonly fillBots: () => Promise<RoomOperationResult>;
}

interface UseRoomSeatCommandsParams<TState extends BaseGameState<GameType>, TProfile> {
  readonly session: RoomSeatSession<TState, TProfile>;
  readonly userId: string;
  readonly createProfile: (identity: ActiveRoomIdentity) => TProfile;
}

export function useRoomSeatCommands<TState extends BaseGameState<GameType>, TProfile>({
  session,
  userId,
  createProfile,
}: UseRoomSeatCommandsParams<TState, TProfile>): RoomSeatCommandOperations {
  const sessionSnapshot = session.getSnapshot();
  if (sessionSnapshot.phase !== 'ready') {
    throw new Error('[FAIL-FAST] Room seat commands require a ready room session');
  }
  if (sessionSnapshot.identity.userId !== userId) {
    throw new Error('[FAIL-FAST] Auth profile does not match the active room identity');
  }

  const context = useMemo<RoomSeatCommandContext<TState, TProfile>>(
    () => ({ dispatch: (command, options) => session.dispatch(command, options) }),
    [session],
  );
  const identity = sessionSnapshot.identity;

  const takeSeat = useCallback(
    (seat: number) => takeRoomSeat(context, seat, createProfile(identity)),
    [context, createProfile, identity],
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
