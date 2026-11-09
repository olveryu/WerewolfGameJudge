/** The Werewolf room link: authoritative GameState in, public commands out. */

import type {
  GameState,
  WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';

import type { RoomLink } from '@/platform/realtime/types';

export type WerewolfRoomSession = RoomLink<GameState, WerewolfPublicCommand>;
