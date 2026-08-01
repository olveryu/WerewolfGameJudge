/** Canonical profile-update command client shared by every seated room game. */

import type { RoomProfileUpdateCommand } from '@game-judge/game-engine/platform/protocol/commands';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { RoomCommandContext, RoomCommandDispatchOutcome } from '@/features/room/session/types';

export function updateRoomProfile<TState extends BaseGameState<string>, TProfileUpdate>(
  context: RoomCommandContext<TState, RoomProfileUpdateCommand<TProfileUpdate>>,
  profile: TProfileUpdate,
): Promise<RoomCommandDispatchOutcome<TState>> {
  return context.dispatch(
    { type: 'room.profile.update', profile },
    { controlledSeat: null, label: 'updateRoomProfile' },
  );
}
