/**
 * Demo对共享房间 session 的特化；传输与命令恢复仍归平台所有。
 */

import type { DemoCommand, DemoState } from '@game-judge/game-engine/games/demo/public';

import type { RoomLink } from '@/platform/realtime/types';

export type DemoRoomSession = RoomLink<DemoState, DemoCommand>;
