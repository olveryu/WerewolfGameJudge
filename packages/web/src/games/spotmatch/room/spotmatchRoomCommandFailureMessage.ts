/**
 * 一眼成对命令失败文案的唯一来源。
 *
 * 引擎只发稳定英文码（`SPOTMATCH_REASONS`），匹配走常量引用、不手抄码原文。
 */

import {
  SPOTMATCH_REASONS,
  type SpotmatchState,
} from '@game-judge/game-engine/games/spotmatch/public';

import {
  createRoomCommandFailureMessage,
  ROOM_COMMAND_FAILURE_OCCUPIED_OUT_OF_RANGE,
  ROOM_COMMAND_FAILURE_SEATS_NOT_FULL,
  ROOM_COMMAND_FAILURE_WRONG_PHASE,
} from '@/features/room/link/createRoomCommandFailureMessage';

/** 把房间命令的失败原因翻译成用户可读的中文。 */
export const getSpotmatchRoomCommandFailureMessage =
  createRoomCommandFailureMessage<SpotmatchState>({
    [SPOTMATCH_REASONS.config]: '配置无效，请检查人数设置',
    [SPOTMATCH_REASONS.phase]: ROOM_COMMAND_FAILURE_WRONG_PHASE,
    [SPOTMATCH_REASONS.notHostStart]: '只有房主可以开始游戏',
    [SPOTMATCH_REASONS.full]: ROOM_COMMAND_FAILURE_SEATS_NOT_FULL,
    [SPOTMATCH_REASONS.occupied]: ROOM_COMMAND_FAILURE_OCCUPIED_OUT_OF_RANGE,
    [SPOTMATCH_REASONS.notHostReturnToLobby]: '只有房主可以返回大厅',
    [SPOTMATCH_REASONS.stale]: '中央牌或手牌已更新，再找一次（不计误点）',
    [SPOTMATCH_REASONS.wrong]: '没有匹配，1 秒后再试',
    [SPOTMATCH_REASONS.cooldown]: '稍等一下再试',
    [SPOTMATCH_REASONS.paused]: '出牌成功，全桌稍等 3 秒',
    [SPOTMATCH_REASONS.symbol]: '操作无效，请同步后重试',
  });
