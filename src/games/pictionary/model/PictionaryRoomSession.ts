/** Concrete Pictionary specialization of the shared room-session contract. */

import type {
  PictionaryPublicCommand,
  PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

import type { RoomSessionClient } from '@/features/room/session/types';

export type PictionaryRoomSession = RoomSessionClient<
  PictionaryState,
  PictionaryPublicCommand,
  never
>;
