/**
 * Demo命令失败文案的唯一来源。
 *
 * 引擎只发稳定英文码（`DEMO_REASONS`），匹配走常量引用、不手抄码原文。
 */

import { DEMO_REASONS, type DemoState } from '@game-judge/game-engine/games/demo/public';

import {
  createRoomCommandFailureMessage,
  ROOM_COMMAND_FAILURE_OCCUPIED_OUT_OF_RANGE,
  ROOM_COMMAND_FAILURE_SEATS_NOT_FULL,
  ROOM_COMMAND_FAILURE_WRONG_PHASE,
} from '@/features/room/session/createRoomCommandFailureMessage';

/** 把房间命令的失败原因翻译成用户可读的中文。 */
export const getDemoRoomCommandFailureMessage = createRoomCommandFailureMessage<DemoState>({
  [DEMO_REASONS.config]: '配置无效，请检查人数设置',
  [DEMO_REASONS.phase]: ROOM_COMMAND_FAILURE_WRONG_PHASE,
  [DEMO_REASONS.notHostStart]: '只有房主可以开始游戏',
  [DEMO_REASONS.full]: ROOM_COMMAND_FAILURE_SEATS_NOT_FULL,
  [DEMO_REASONS.occupied]: ROOM_COMMAND_FAILURE_OCCUPIED_OUT_OF_RANGE,
  [DEMO_REASONS.notHostReturnToLobby]: '只有房主可以返回大厅',
  [DEMO_REASONS.notImplemented]: '该玩法尚未实现',
  [DEMO_REASONS.notHostBegin]: '只有房主可以开始游戏',
  [DEMO_REASONS.notAllViewed]: '还有玩家未查看身份',
  [DEMO_REASONS.notHostMarkBots]: '只有房主可以标记机器人已查看',
  [DEMO_REASONS.noBotSeats]: '当前没有机器人座位',
});
