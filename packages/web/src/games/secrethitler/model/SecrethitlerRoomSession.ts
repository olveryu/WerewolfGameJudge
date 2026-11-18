/**
 * 秘密希特勒对共享房间 session 的特化；传输与命令恢复仍归平台所有。
 */

import type {
  SecrethitlerCommand,
  SecrethitlerState,
} from '@game-judge/game-engine/games/secrethitler/public';

import type { RoomLink } from '@/platform/realtime/types';

export type SecrethitlerRoomSession = RoomLink<SecrethitlerState, SecrethitlerCommand>;
