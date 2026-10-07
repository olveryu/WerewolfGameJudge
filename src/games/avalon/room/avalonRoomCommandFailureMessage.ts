/**
 * 阿瓦隆命令失败原因的中文文案（逐字照搬设计稿 §6.1）。
 */

import type { AvalonState } from '@game-judge/game-engine/games/avalon/public';

import { getRoomCommandFailureReason } from '@/features/room/session/roomCommandResult';
import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';
import { translateReasonCode } from '@/utils/errorUtils';

/** 把房间命令的失败原因翻译成用户可读的中文。 */
export function getAvalonRoomCommandFailureMessage(
  result: RoomCommandDispatchOutcome<AvalonState>,
): string {
  const reason = getRoomCommandFailureReason(result);
  switch (reason) {
    case '阿瓦隆配置无效':
      return '配置无效，请检查人数（5 至 10 人）、投票模式与否决上限设置';
    case '当前阶段不能执行此操作':
      return '当前阶段不能执行此操作';
    case '只有房主可以开始游戏':
      return '只有房主可以开始游戏';
    case '请先坐满所有座位，或填充机器人。':
      return '请先坐满所有座位，或填充机器人。';
    case '你不在当前确认步骤内':
      return '你不在当前确认步骤内';
    case '只有当前队长可以组队':
      return '只有当前队长可以组队';
    case '当前不在投票阶段':
      return '当前不在投票阶段';
    case '只有房主可以结束投票':
      return '只有房主可以结束投票';
    case '你不在本轮任务队伍中':
      return '你不在本轮任务队伍中';
    case '好人只能出成功牌':
      return '好人只能出成功牌';
    case '只有房主可以结束任务':
      return '只有房主可以结束任务';
    case '只有湖仙持有人可以查验':
      return '只有湖仙持有人可以查验';
    case '该玩家已担任过湖仙，不能查验':
      return '该玩家已担任过湖仙，不能查验';
    case '不能查验自己':
      return '不能查验自己';
    case '只有被查验者可以确认':
      return '只有被查验者可以确认';
    case '只有刺客可以指认':
      return '只有刺客可以指认';
    case '不能指认自己':
      return '不能指认自己';
    case '只有刺客可以刺杀':
      return '只有刺客可以刺杀';
    case '晚上阶段不能刺杀':
      return '晚上阶段不能刺杀';
    case '不能刺杀自己':
      return '不能刺杀自己';
    case '只有房主可以返回大厅':
      return '只有房主可以返回大厅';
    case '目标人数之外的座位仍有玩家入座，请先让这些玩家离座':
      return '目标人数之外的座位仍有玩家入座，请先让这些玩家离座';
    case '队员必须是已入座的玩家':
      return '队员必须是已入座的玩家';
    case '队员不能重复':
      return '队员不能重复';
    case '投票选项无效':
      return '投票选项无效，请重试';
    case '出牌选项无效':
      return '出牌选项无效，请重试';
    case '目标座位无效':
      return '目标座位无效，请重试';
    case '只能接管机器人席位':
      return '只能接管机器人席位';
    default:
      if (reason.startsWith('队员人数必须为')) return reason;
      return translateReasonCode(reason);
  }
}
