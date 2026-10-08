/**
 * 你画我猜对共享房间 session 的特化；传输与命令恢复仍归平台所有。
 */

import type {
  DrawGuessCommand,
  DrawGuessState,
} from '@game-judge/game-engine/games/drawguess/public';

import type { RoomSessionClient } from '@/features/room/session/types';

export type DrawGuessRoomSession = RoomSessionClient<DrawGuessState, DrawGuessCommand>;
