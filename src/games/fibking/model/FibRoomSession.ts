/** Concrete FibKing specialization of the shared RoomSession contract. */

import type { FibPublicCommand, FibState } from '@werewolf/game-engine/games/fibking/public';

import type { RoomSessionClient } from '@/features/room/session/types';

export type FibRoomSession = RoomSessionClient<FibState, FibPublicCommand, never>;
