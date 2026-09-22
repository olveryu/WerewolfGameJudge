/** Undercover specialization of the shared realtime room client. */
import type {
  UndercoverPublicCommand,
  UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';

import type { RoomSessionClient } from '@/features/room/session/types';

export type UndercoverRoomSession = RoomSessionClient<UndercoverState, UndercoverPublicCommand>;
