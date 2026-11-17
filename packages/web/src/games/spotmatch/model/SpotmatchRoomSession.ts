/**
 * 一眼成对对共享房间 session 的特化；传输与命令恢复仍归平台所有。
 */

import type {
  SpotmatchCommand,
  SpotmatchState,
} from '@game-judge/game-engine/games/spotmatch/public';

import type { RoomLink } from '@/platform/realtime/types';

export type SpotmatchRoomSession = RoomLink<SpotmatchState, SpotmatchCommand>;
