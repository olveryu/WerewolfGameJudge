/**
 * 阿瓦隆命令失败原因的中文文案（逐字照搬设计稿 §6.1）。
 *
 * 匹配走引擎导出的 `AVALON_REASONS` 常量，不手抄中文原文。
 */

import { AVALON_REASONS, type AvalonState } from '@game-judge/game-engine/games/avalon/public';

import { getRoomCommandFailureReason } from '@/features/room/session/roomCommandResult';
import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';
import { translateReasonCode } from '@/utils/errorUtils';

/** 把房间命令的失败原因翻译成用户可读的中文。 */
export function getAvalonRoomCommandFailureMessage(
  result: RoomCommandDispatchOutcome<AvalonState>,
): string {
  const reason = getRoomCommandFailureReason(result);
  switch (reason) {
    case AVALON_REASONS.config:
      return '配置无效，请检查人数（5 至 10 人）、投票模式与否决上限设置';
    case AVALON_REASONS.phase:
      return '当前阶段不能执行此操作';
    case AVALON_REASONS.notHostStart:
      return '只有房主可以开始游戏';
    case AVALON_REASONS.full:
      return '请先坐满所有座位，或填充机器人。';
    case AVALON_REASONS.notNightParticipant:
      return '你不在当前确认步骤内';
    case AVALON_REASONS.notLeader:
      return '只有当前队长可以组队';
    case AVALON_REASONS.notVotePhase:
      return '当前不在投票阶段';
    case AVALON_REASONS.notHostFinishVote:
      return '只有房主可以结束投票';
    case AVALON_REASONS.notTeamMember:
      return '你不在本轮任务队伍中';
    case AVALON_REASONS.goodMustSucceed:
      return '好人只能出成功牌';
    case AVALON_REASONS.notHostFinishQuest:
      return '只有房主可以结束任务';
    case AVALON_REASONS.notLadyHolder:
      return '只有湖仙持有人可以查验';
    case AVALON_REASONS.ladyAlreadyExamined:
      return '该玩家已担任过湖仙，不能查验';
    case AVALON_REASONS.ladyCannotCheckSelf:
      return '不能查验自己';
    case AVALON_REASONS.notLadyTarget:
      return '只有被查验者可以确认';
    case AVALON_REASONS.notAssassinAccuse:
      return '只有刺客可以指认';
    case AVALON_REASONS.cannotAccuseSelf:
      return '不能指认自己';
    case AVALON_REASONS.notAssassinStrike:
      return '只有刺客可以刺杀';
    case AVALON_REASONS.noStrikeAtNight:
      return '晚上阶段不能刺杀';
    case AVALON_REASONS.cannotStrikeSelf:
      return '不能刺杀自己';
    case AVALON_REASONS.notHostReturnToLobby:
      return '只有房主可以返回大厅';
    case AVALON_REASONS.occupied:
      return '目标人数之外的座位仍有玩家入座，请先让这些玩家离座';
    case AVALON_REASONS.invalidSeats:
      return '队员必须是已入座的玩家';
    case AVALON_REASONS.duplicateSeats:
      return '队员不能重复';
    case AVALON_REASONS.invalidVote:
      return '投票选项无效，请重试';
    case AVALON_REASONS.invalidPlay:
      return '出牌选项无效，请重试';
    case AVALON_REASONS.invalidTarget:
      return '目标座位无效，请重试';
    case AVALON_REASONS.controlledSeatNotBot:
      return '只能接管机器人席位';
    case AVALON_REASONS.audioPlaying:
      return '播报尚未结束，请稍候';
    case AVALON_REASONS.notHostAckAudio:
      return '只有房主可以确认播报';
    default:
      if (reason.startsWith('队员人数必须为')) return reason;
      return translateReasonCode(reason);
  }
}
