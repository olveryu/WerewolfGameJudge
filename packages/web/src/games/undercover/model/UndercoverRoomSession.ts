/** Undercover specialization of the shared realtime room client. */
import type {
  UndercoverPublicCommand,
  UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';

import type { RoomLink } from '@/platform/realtime/types';

export type UndercoverRoomSession = RoomLink<UndercoverState, UndercoverPublicCommand>;
