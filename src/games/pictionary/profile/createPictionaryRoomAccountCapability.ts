/** Bind Pictionary account operations to the shared room session. */

import type { PictionaryState } from '@game-judge/game-engine/games/pictionary/public';

import { createSessionRoomAccountCapability } from '@/features/room/session/SessionRoomAccountCapability';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import { getPictionaryUserSeat } from '@/games/pictionary/model/pictionarySelectors';

export function createPictionaryRoomAccountCapability(session: PictionaryRoomSession) {
  return createSessionRoomAccountCapability<'pictionary', PictionaryState>({
    gameType: 'pictionary',
    session,
    isUserSeated: (state, userId) => getPictionaryUserSeat(state, userId) !== null,
    canSwitchAccount: (state) => state.phase === 'lobby',
  });
}
