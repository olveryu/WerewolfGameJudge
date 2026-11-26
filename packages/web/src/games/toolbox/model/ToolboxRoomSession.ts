/** 聚会工具对共享房间 session 的特化；传输与命令恢复仍归平台所有。 */

import type {
  ToolboxPublicCommand,
  ToolboxView,
} from '@game-judge/game-engine/games/toolbox/public';

import type { RoomLink } from '@/platform/realtime/types';

export type ToolboxRoomSession = RoomLink<ToolboxView, ToolboxPublicCommand>;
