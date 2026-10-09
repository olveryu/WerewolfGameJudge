/**
 * 阿瓦隆对共享房间 session 的特化；传输与命令恢复仍归平台所有。
 */

import type { AvalonCommand, AvalonState } from '@game-judge/game-engine/games/avalon/public';

import type { RoomSessionClient } from '@/features/room/session/types';

export type AvalonRoomSession = RoomSessionClient<AvalonState, AvalonCommand>;
