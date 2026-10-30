/** The Werewolf room link: authoritative GameState in, public commands out. */

import type {
  GameState,
  WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';

import type { ReadyRoomSession } from '@/features/room/controllers/useReadyRoomSession';
import type { RoomLink } from '@/platform/realtime/types';

export type WerewolfRoomSession = RoomLink<GameState, WerewolfPublicCommand>;

export type WerewolfReadyRoomSession = ReadyRoomSession<GameState, WerewolfPublicCommand>;

/** The shared single-flight submit bound to the werewolf session. */
export type WerewolfSubmit = WerewolfReadyRoomSession['submit'];
