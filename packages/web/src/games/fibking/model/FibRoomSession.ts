/** Concrete FibKing specialization of the shared RoomSession contract. */

import type { FibPublicCommand, FibState } from '@game-judge/game-engine/games/fibking/public';

import type { RoomLink } from '@/platform/realtime/types';

export type FibRoomSession = RoomLink<FibState, FibPublicCommand>;
