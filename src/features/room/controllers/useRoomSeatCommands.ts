/** Canonical seat-command controller shared by every room game. */

import type { RoomSeatCommand } from '@game-judge/game-engine/platform/protocol/commands';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { useCallback, useMemo } from 'react';

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

interface RoomSeatSession<TState extends BaseGameState<string>, TProfile> {
  getSnapshot(): RoomSessionSnapshot<TState>;
  dispatch(
    command: RoomSeatCommand<TProfile>,
    options: RoomCommandDispatchOptions,
  ): Promise<RoomCommandDispatchOutcome<TState>>;
}

export interface RoomSeatCommandOperations<TState extends BaseGameState<string>> {
  readonly takeSeat: (seat: number) => Promise<RoomCommandDispatchOutcome<TState>>;
  readonly leaveSeat: () => Promise<RoomCommandDispatchOutcome<TState>>;
  readonly kickSeat: (seat: number) => Promise<RoomCommandDispatchOutcome<TState>>;
  readonly clearSeats: () => Promise<RoomCommandDispatchOutcome<TState>>;
  readonly fillBots: () => Promise<RoomCommandDispatchOutcome<TState>>;
}

interface UseRoomSeatCommandsParams<TState extends BaseGameState<string>, TProfile> {
  readonly session: RoomSeatSession<TState, TProfile>;
  readonly userId: string;
  readonly createProfile: (identity: ActiveRoomIdentity<TState['gameType']>) => TProfile;
}

export function useRoomSeatCommands<TState extends BaseGameState<string>, TProfile>({
  session,
  userId,
  createProfile,
}: UseRoomSeatCommandsParams<TState, TProfile>): RoomSeatCommandOperations<TState> {
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
