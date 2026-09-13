// Bind Fashion Shadow account operations to the redacted room session.

import type { FashionPublicState } from '@game-judge/game-engine/games/fashion-shadow/public';

import { createSessionRoomAccountCapability } from '@/features/room/session/SessionRoomAccountCapability';
import type { FashionRoomSession } from '@/games/fashion-shadow/model/FashionRoomSession';

function isUserSeated(state: FashionPublicState, userId: string): boolean {
  return Object.values(state.realSeats).some((occupant) => occupant?.userId === userId);
}

export function createFashionRoomAccountCapability(session: FashionRoomSession) {
  return createSessionRoomAccountCapability<'fashion-shadow', FashionPublicState>({
    gameType: 'fashion-shadow',
    session,
    isUserSeated,
    canSwitchAccount: (state) => state.phase === 'lobby',
  });
}
