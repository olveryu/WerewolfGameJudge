/**
 * 你画我猜命令失败原因的中文文案。
 *
 * 匹配走引擎导出的 `DRAWGUESS_REASONS` 常量，不手抄中文原文。
 * 若引擎修改文案，此处自动同步，无 drift。
 */

import {
  DRAWGUESS_REASONS,
  type DrawGuessState,
} from '@game-judge/game-engine/games/drawguess/public';

import {
  createRoomCommandFailureMessage,
  ROOM_COMMAND_FAILURE_BOT_SEAT_ONLY,
  ROOM_COMMAND_FAILURE_OCCUPIED_OUT_OF_RANGE,
  ROOM_COMMAND_FAILURE_SEATS_NOT_FULL,
  ROOM_COMMAND_FAILURE_WRONG_PHASE,
} from '@/features/room/session/createRoomCommandFailureMessage';

/** 把房间命令的失败原因翻译成用户可读的中文。 */
export const getDrawGuessRoomCommandFailureMessage =
  createRoomCommandFailureMessage<DrawGuessState>({
    [DRAWGUESS_REASONS.config]: '配置无效，请检查人数设置（4 至 12 人）',
    [DRAWGUESS_REASONS.phase]: ROOM_COMMAND_FAILURE_WRONG_PHASE,
    [DRAWGUESS_REASONS.stale]: '对局已推进，请稍后重试',
    [DRAWGUESS_REASONS.notSeated]: '请先入座再操作',
    [DRAWGUESS_REASONS.notDrawer]: '只有当前画手可以操作',
    [DRAWGUESS_REASONS.notGuesser]: '画手不能提交猜词',
    [DRAWGUESS_REASONS.locked]: '本轮已猜中，请等待结算',
    [DRAWGUESS_REASONS.emptyChoices]: '题目准备中，请稍候再选',
    [DRAWGUESS_REASONS.invalidWord]: '只能选择候选词中的题目',
    [DRAWGUESS_REASONS.invalidStroke]: '笔画数据无效，请重试',
    [DRAWGUESS_REASONS.strokeLimit]: '本轮笔画已达上限',
    [DRAWGUESS_REASONS.invalidGuess]: '猜词内容无效，请检查输入',
    [DRAWGUESS_REASONS.reservation]: '画作上传预留无效，请重试',
    [DRAWGUESS_REASONS.wordsDealt]: '题目已下发',
    [DRAWGUESS_REASONS.full]: ROOM_COMMAND_FAILURE_SEATS_NOT_FULL,
    [DRAWGUESS_REASONS.occupied]: ROOM_COMMAND_FAILURE_OCCUPIED_OUT_OF_RANGE,
    [DRAWGUESS_REASONS.deadline]: '当前阶段尚未结束',
    [DRAWGUESS_REASONS.controlledSeatNotBot]: ROOM_COMMAND_FAILURE_BOT_SEAT_ONLY,
  });
