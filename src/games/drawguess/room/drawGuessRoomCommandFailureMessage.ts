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

import { getRoomCommandFailureReason } from '@/features/room/session/roomCommandResult';
import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';
import { translateReasonCode } from '@/utils/errorUtils';

/** 把房间命令的失败原因翻译成用户可读的中文。 */
export function getDrawGuessRoomCommandFailureMessage(
  result: RoomCommandDispatchOutcome<DrawGuessState>,
): string {
  const reason = getRoomCommandFailureReason(result);
  switch (reason) {
    case DRAWGUESS_REASONS.config:
      return '配置无效，请检查人数设置（4 至 12 人）';
    case DRAWGUESS_REASONS.phase:
      return '当前阶段不能执行此操作';
    case DRAWGUESS_REASONS.stale:
      return '对局已推进，请稍后重试';
    case DRAWGUESS_REASONS.notSeated:
      return '请先入座再操作';
    case DRAWGUESS_REASONS.notDrawer:
      return '只有当前画手可以操作';
    case DRAWGUESS_REASONS.notGuesser:
      return '画手不能提交猜词';
    case DRAWGUESS_REASONS.locked:
      return '本轮已猜中，请等待结算';
    case DRAWGUESS_REASONS.emptyChoices:
      return '题目准备中，请稍候再选';
    case DRAWGUESS_REASONS.invalidWord:
      return '只能选择候选词中的题目';
    case DRAWGUESS_REASONS.invalidStroke:
      return '笔画数据无效，请重试';
    case DRAWGUESS_REASONS.strokeLimit:
      return '本轮笔画已达上限';
    case DRAWGUESS_REASONS.invalidGuess:
      return '猜词内容无效，请检查输入';
    case DRAWGUESS_REASONS.reservation:
      return '画作上传预留无效，请重试';
    case DRAWGUESS_REASONS.wordsDealt:
      return '题目已下发';
    case DRAWGUESS_REASONS.full:
      return '请先坐满所有座位，或填充机器人。';
    case DRAWGUESS_REASONS.occupied:
      return '目标人数之外的座位仍有玩家入座，请先让这些玩家离座';
    case DRAWGUESS_REASONS.deadline:
      return '当前阶段尚未结束';
    case DRAWGUESS_REASONS.controlledSeatNotBot:
      return '只能接管机器人席位';
    default:
      return translateReasonCode(reason);
  }
}
