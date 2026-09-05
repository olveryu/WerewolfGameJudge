// Client session type for the redacted Fashion Shadow room state.

import type {
  FashionPublicCommand,
  FashionPublicState,
} from '@game-judge/game-engine/games/fashion-shadow/public';

import type { RoomSessionClient } from '@/features/room/session/types';

export type FashionRoomSession = RoomSessionClient<FashionPublicState, FashionPublicCommand, never>;
