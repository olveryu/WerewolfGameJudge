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

import type { RoomCommandSubmission } from './useRoomCommandSubmission';
import type { RoomProfileController } from './useRoomProfileController';
import { useRoomRosterController } from './useRoomRosterController';
import type { RoomSeating } from './useRoomSeatCommands';
import type { RoomSeatController } from './useRoomSeatController';

type UseRoomSetupControllerParams<TState extends BaseGameState<string>> = Pick<
  RoomSetupCapabilitiesInput,
  | 'isSetup'
  | 'isHost'
  | 'mySeat'
  | 'hasOccupiedSeats'
  | 'isRoomFull'
  | 'configureGame'
  | 'shareRoom'
> &
  RoomSeating<TState, RoomSeatProfile> & {
    readonly user: User;
    readonly submitOperation: RoomCommandSubmission<TState>['submit'];
  };

interface RoomSetupController {
  readonly seatController: RoomSeatController;
  readonly profile: RoomProfileController;
  readonly capabilities: RoomSetupCapabilities & Pick<RoomCapabilities, 'canViewProfiles'>;
}

/** Bind standard room mutations and their executable setup capabilities to one ready session. */
export function useRoomSetupController<TState extends BaseGameState<string>>(
  params: UseRoomSetupControllerParams<TState>,
): RoomSetupController {
  const { seatController, profile, actions } = useRoomRosterController(params);
  const capabilities = {
    ...createRoomSetupCapabilities({
      ...actions,
      isSetup: params.isSetup,
      isHost: params.isHost,
      mySeat: params.mySeat,
      supportsBots: params.supportsBots,
      hasOccupiedSeats: params.hasOccupiedSeats,
      isRoomFull: params.isRoomFull,
      configureGame: params.configureGame,
      shareRoom: params.shareRoom,
    }),
    canViewProfiles: createViewProfilesCapability(params.isSetup, profile.open),
  };
  return { seatController, profile, capabilities };
}
