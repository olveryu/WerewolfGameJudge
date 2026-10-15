/**
 * Demo对共享房间 session 的特化；传输与命令恢复仍归平台所有。
 */

import type { DemoCommand, DemoState } from '@game-judge/game-engine/games/demo/public';

import type { RoomSessionClient } from '@/features/room/session/types';

export type DemoRoomSession = RoomSessionClient<DemoState, DemoCommand>;
