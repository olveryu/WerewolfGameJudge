/** Concrete FibKing specialization of the shared RoomSession contract. */

import type { FibPublicCommand, FibState } from '@game-judge/game-engine/games/fibking/public';

import type { RoomSessionClient } from '@/features/room/session/types';

export type FibRoomSession = RoomSessionClient<FibState, FibPublicCommand, never>;
