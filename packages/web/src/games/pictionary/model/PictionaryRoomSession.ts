/** Concrete Pictionary specialization of the shared room-session contract. */

import type {
  PictionaryPublicCommand,
  PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

import type { RoomLink } from '@/platform/realtime/types';

export type PictionaryRoomSession = RoomLink<PictionaryState, PictionaryPublicCommand>;
