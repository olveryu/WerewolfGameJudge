/** Canonical profile-update command client shared by every seated room game. */

import type { RoomProfileUpdateCommand } from '@game-judge/game-engine/platform/protocol/commands';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { DispatchOutcome } from '@/platform/realtime/types';

import type { RoomCommandContext } from './roomSeatCommandClient';

export function updateRoomProfile<TState extends BaseGameState<string>, TProfileUpdate>(
  context: RoomCommandContext<TState, RoomProfileUpdateCommand<TProfileUpdate>>,
  profile: TProfileUpdate,
): Promise<DispatchOutcome<TState>> {
  return context.dispatch(
    { type: 'room.profile.update', profile },
    { controlledSeat: null, label: '同步资料', durable: false },
  );
}
