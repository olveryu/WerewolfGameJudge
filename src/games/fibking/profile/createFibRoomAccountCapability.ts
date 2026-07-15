/** Bind FibKing account operations to the shared room session. */

import type { FibState } from '@werewolf/game-engine/games/fibking/public';
import { getFibUserSeat } from '@werewolf/game-engine/games/fibking/public';

import { createSessionRoomAccountCapability } from '@/features/room/session/SessionRoomAccountCapability';
import type { FibRoomSession } from '@/games/fibking/model/FibRoomSession';

export function createFibRoomAccountCapability(session: FibRoomSession) {
  return createSessionRoomAccountCapability<'fibking', FibState>({
    gameType: 'fibking',
    session,
    isUserSeated: (state, userId) => getFibUserSeat(state, userId) !== null,
    canSwitchAccount: (state) => state.phase === 'lobby',
  });
}
