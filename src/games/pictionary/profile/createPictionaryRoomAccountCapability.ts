/** Bind Pictionary account operations to the shared room session. */

import type { PictionaryState } from '@game-judge/game-engine/games/pictionary/public';

import { getUserSeat } from '@/features/room/model/getUserSeat';
import { createSessionRoomAccountCapability } from '@/features/room/session/SessionRoomAccountCapability';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';

export function createPictionaryRoomAccountCapability(session: PictionaryRoomSession) {
  return createSessionRoomAccountCapability<'pictionary', PictionaryState>({
    gameType: 'pictionary',
    session,
    isUserSeated: (state, userId) => getUserSeat(state.realSeats, userId) !== null,
    canSwitchAccount: (state) => state.phase === 'lobby',
  });
}
