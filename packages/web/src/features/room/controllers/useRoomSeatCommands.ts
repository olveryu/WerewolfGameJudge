/** Canonical seat-command controller shared by every room game. */

import type {
  RoomHumanSeatCommand,
  RoomSeatCommand,
} from '@game-judge/game-engine/platform/protocol/commands';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { useCallback, useMemo } from 'react';

import {
  clearRoomSeats,
  fillRoomSeatsWithBots,
  kickRoomSeat,
  leaveRoomSeat,
  type RoomHumanSeatCommandContext,
  takeRoomSeat,
} from '@/features/room/link/roomSeatCommandClient';
import type {
  DispatchOptions,
  DispatchOutcome,
  LinkSnapshot,
  RoomIdentity,
} from '@/platform/realtime/types';

/** Ready session of a game with bots: accepts every seat command, including `room.seat.fillBots`. */
export interface RoomSeatSession<TState extends BaseGameState<string>, TProfile> {
  getSnapshot(): LinkSnapshot<TState>;
  dispatch(
    command: RoomSeatCommand<TProfile>,
    options: DispatchOptions,
  ): Promise<DispatchOutcome<TState>>;
}

/** Ready session of a game without bots: its command vocabulary has no `room.seat.fillBots`. */
export interface RoomHumanSeatSession<TState extends BaseGameState<string>, TProfile> {
  getSnapshot(): LinkSnapshot<TState>;
  dispatch(
    command: RoomHumanSeatCommand<TProfile>,
    options: DispatchOptions,
  ): Promise<DispatchOutcome<TState>>;
}

/** Ties the bot-support declaration to the session that can (or cannot) dispatch bot filling. */
export type RoomSeating<TState extends BaseGameState<string>, TProfile> =
  | { readonly supportsBots: true; readonly session: RoomSeatSession<TState, TProfile> }
  | { readonly supportsBots: false; readonly session: RoomHumanSeatSession<TState, TProfile> };

export interface RoomSeatCommandOperations<TState extends BaseGameState<string>> {
  readonly takeSeat: (seat: number) => Promise<DispatchOutcome<TState>>;
  readonly leaveSeat: () => Promise<DispatchOutcome<TState>>;
  readonly kickSeat: (seat: number) => Promise<DispatchOutcome<TState>>;
  readonly clearSeats: () => Promise<DispatchOutcome<TState>>;
  readonly fillBots: () => Promise<DispatchOutcome<TState>>;
}

type UseRoomSeatCommandsParams<TState extends BaseGameState<string>, TProfile> = RoomSeating<
  TState,
  TProfile
> & {
  readonly userId: string;
  readonly createProfile: (identity: RoomIdentity<TState['gameType']>) => TProfile;
};

function failBotFillWithoutBots(): never {
  throw new Error('[FAIL-FAST] room.seat.fillBots requested in a game without bots');
}

export function useRoomSeatCommands<TState extends BaseGameState<string>, TProfile>(
  params: UseRoomSeatCommandsParams<TState, TProfile>,
): RoomSeatCommandOperations<TState> {
  const { session, userId, createProfile } = params;
  const sessionSnapshot = session.getSnapshot();
  if (sessionSnapshot.phase !== 'ready') {
    throw new Error('[FAIL-FAST] Room seat commands require a ready room session');
  }
  if (sessionSnapshot.identity.userId !== userId) {
    throw new Error('[FAIL-FAST] Auth profile does not match the active room identity');
  }

  const context = useMemo<RoomHumanSeatCommandContext<TState, TProfile>>(
    () => ({ dispatch: (command, options) => session.dispatch(command, options) }),
    [session],
  );
  const fillBots = useMemo(() => {
    if (!params.supportsBots) return failBotFillWithoutBots;
    const botSession = params.session;
    return () =>
      fillRoomSeatsWithBots<TState, TProfile>({
        dispatch: (command, options) => botSession.dispatch(command, options),
      });
  }, [params.supportsBots, params.session]);
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
      fillBots,
    }),
    [context, takeSeat, fillBots],
  );
}
