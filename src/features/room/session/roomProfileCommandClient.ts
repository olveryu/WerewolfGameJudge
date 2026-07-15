/** Canonical profile-update command client shared by every seated room game. */

import type { RoomProfileUpdateCommand } from '@werewolf/game-engine/platform/protocol/commands';
import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type { BaseGameState } from '@werewolf/game-engine/platform/protocol/roomSnapshot';

import type { RoomOperationResult } from '@/features/room/model/RoomCapabilities';
import {
  dispatchRoomOperation,
  type RoomOperationCommandContext,
} from '@/features/room/session/roomOperationCommandClient';

export function updateRoomProfile<TState extends BaseGameState<GameType>, TProfileUpdate>(
  context: RoomOperationCommandContext<TState, RoomProfileUpdateCommand<TProfileUpdate>>,
  profile: TProfileUpdate,
): Promise<RoomOperationResult> {
  return dispatchRoomOperation(
    context,
    { type: 'room.profile.update', profile },
    'updateRoomProfile',
  );
}
