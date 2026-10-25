/** Compose standard seat, profile and host controllers; games supply lifecycle and navigation policy. */

import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import type { RoomSeatProfile } from '@game-judge/game-engine/platform/room/roster';

import type { User } from '@/contexts/AuthContext';
import {
  createRoomSetupCapabilities,
  createViewProfilesCapability,
  type RoomCapabilities,
  type RoomSetupCapabilities,
  type RoomSetupCapabilitiesInput,
} from '@/features/room/model/RoomCapabilities';

import { useRoomHostOperations } from './useRoomHostOperations';
import { type RoomProfileController, useRoomProfileController } from './useRoomProfileController';
import type { RoomSeatSession } from './useRoomSeatCommands';
import { type RoomSeatController, useRoomSeatController } from './useRoomSeatController';
import { useStandardSeatCommands } from './useStandardSeatCommands';

interface UseRoomSetupControllerParams<TState extends BaseGameState<string>> extends Pick<
  RoomSetupCapabilitiesInput,
  | 'isSetup'
  | 'isHost'
  | 'mySeat'
  | 'supportsBots'
  | 'hasOccupiedSeats'
  | 'isRoomFull'
  | 'configureGame'
  | 'shareRoom'
> {
  readonly session: RoomSeatSession<TState, RoomSeatProfile>;
  readonly user: User;
}

interface RoomSetupController {
  readonly seatController: RoomSeatController;
  readonly profile: RoomProfileController;
  readonly capabilities: RoomSetupCapabilities & Pick<RoomCapabilities, 'canViewProfiles'>;
}

/** Bind standard room mutations and their executable setup capabilities to one ready session. */
export function useRoomSetupController<TState extends BaseGameState<string>>(
  params: UseRoomSetupControllerParams<TState>,
): RoomSetupController {
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
  const capabilities = {
    ...createRoomSetupCapabilities({
      isSetup: params.isSetup,
      isHost: params.isHost,
      mySeat: params.mySeat,
      supportsBots: params.supportsBots,
      hasOccupiedSeats: params.hasOccupiedSeats,
      isRoomFull: params.isRoomFull,
      configureGame: params.configureGame,
      shareRoom: params.shareRoom,
      requestTakeSeat: seatController.requestTakeSeat,
      requestMoveSeat: seatController.requestMoveSeat,
      leaveSeat: profile.leaveSelf,
      kickSeat: profile.kick,
      clearSeats: host.requestClearSeats,
      fillBots: host.requestFillBots,
    }),
    canViewProfiles: createViewProfilesCapability(params.isSetup, profile.open),
  };
  return { seatController, profile, capabilities };
}
