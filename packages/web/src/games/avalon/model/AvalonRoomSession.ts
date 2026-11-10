/**
 * 阿瓦隆对共享房间 session 的特化；传输与命令恢复仍归平台所有。
 */

import type { AvalonPublicCommand, AvalonState } from '@game-judge/game-engine/games/avalon/public';

import type { RoomLink } from '@/platform/realtime/types';

export type AvalonRoomSession = RoomLink<AvalonState, AvalonPublicCommand>;
