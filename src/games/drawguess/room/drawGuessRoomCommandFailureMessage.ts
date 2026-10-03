/**
 * 你画我猜命令失败原因的中文文案。
 */

import type { DrawGuessState } from '@game-judge/game-engine/games/drawguess/public';

import { getRoomCommandFailureReason } from '@/features/room/session/roomCommandResult';
import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';
import { translateReasonCode } from '@/utils/errorUtils';

/** 把房间命令的失败原因翻译成用户可读的中文。 */
export function getDrawGuessRoomCommandFailureMessage(
  result: RoomCommandDispatchOutcome<DrawGuessState>,
): string {
  const reason = getRoomCommandFailureReason(result);
  switch (reason) {
    case '你画我猜配置无效':
      return '配置无效，请检查人数设置（4 至 12 人）';
    case '当前阶段不能执行此操作':
      return '当前阶段不能执行此操作';
    case '对局已推进，请刷新后重试':
      return '对局已推进，请稍后重试';
    case '请先入座':
      return '请先入座再操作';
    case '只有当前画手可以操作':
      return '只有当前画手可以操作';
    case '画手不能提交猜词':
      return '画手不能提交猜词';
    case '本轮已猜中，等待结算':
      return '本轮已猜中，请等待结算';
    case '题目准备中，请稍候':
      return '题目准备中，请稍候再选';
    case '请选择候选词中的题目':
      return '只能选择候选词中的题目';
    case '笔画数据无效':
      return '笔画数据无效，请重试';
    case '本轮笔画已达上限':
      return '本轮笔画已达上限';
    case '猜词内容无效':
      return '猜词内容无效，请检查输入';
    case 'PNG 预留无效或已存在':
      return '画作上传预留无效，请重试';
    case '题目已下发':
      return '题目已下发';
    case '请先坐满所有座位，或填充机器人。':
      return '请先坐满所有座位，或填充机器人。';
    case '目标人数之外的座位仍有玩家入座，请先让这些玩家离座':
      return '目标人数之外的座位仍有玩家入座，请先让这些玩家离座';
    case '当前阶段尚未到推进时间':
      return '当前阶段尚未结束';
    case '只能接管机器人席位':
      return '只能接管机器人席位';
    default:
      return translateReasonCode(reason);
  }
}
