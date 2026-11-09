/** Bind standard roster controllers and actions; lifecycle permissions remain with the caller. */

import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import type { RoomSeatProfile } from '@game-judge/game-engine/platform/room/roster';

import type { User } from '@/contexts/AuthContext';
import type { RoomSetupCapabilitiesInput } from '@/features/room/model/RoomCapabilities';

import { useRoomHostOperations } from './useRoomHostOperations';
import { type RoomProfileController, useRoomProfileController } from './useRoomProfileController';
import type { RoomSeatSession } from './useRoomSeatCommands';
import { type RoomSeatController, useRoomSeatController } from './useRoomSeatController';
import { useStandardSeatCommands } from './useStandardSeatCommands';

interface RoomRosterController {
  readonly seatController: RoomSeatController;
  readonly profile: RoomProfileController;
  readonly actions: Pick<
    RoomSetupCapabilitiesInput,
    'requestTakeSeat' | 'requestMoveSeat' | 'leaveSeat' | 'kickSeat' | 'clearSeats' | 'fillBots'
  > & { readonly openProfile: RoomProfileController['open'] };
}

/** Bind roster commands without taking over game-owned phase or profile permissions. */
export function useRoomRosterController<TState extends BaseGameState<string>>(params: {
  readonly session: RoomSeatSession<TState, RoomSeatProfile>;
  readonly user: User;
  readonly mySeat: number | null;
}): RoomRosterController {
  const seats = useStandardSeatCommands(params.session, params.user);
  const seatController = useRoomSeatController({
    currentSeat: params.mySeat,
    takeSeat: seats.takeSeat,
  });
  const profile = useRoomProfileController({
    myUserId: params.user.id,
    kickSeat: seats.kickSeat,
    leaveSeat: seats.leaveSeat,
  });
  const host = useRoomHostOperations({ clearSeats: seats.clearSeats, fillBots: seats.fillBots });
  return {
    seatController,
    profile,
    actions: {
      requestTakeSeat: seatController.requestTakeSeat,
      requestMoveSeat: seatController.requestMoveSeat,
      leaveSeat: profile.leaveSelf,
      kickSeat: profile.kick,
      clearSeats: host.requestClearSeats,
      fillBots: host.requestFillBots,
      openProfile: profile.open,
    },
  };
}
