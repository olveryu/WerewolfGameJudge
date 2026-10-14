/**
 * 阿瓦隆命令失败文案的唯一来源（逐字照搬设计稿 §6.1）。
 *
 * 引擎只发稳定英文码（`AVALON_REASONS`），匹配走常量引用、不手抄码原文。
 */

import { AVALON_REASONS, type AvalonState } from '@game-judge/game-engine/games/avalon/public';

import {
  createRoomCommandFailureMessage,
  ROOM_COMMAND_FAILURE_OCCUPIED_OUT_OF_RANGE,
  ROOM_COMMAND_FAILURE_SEATS_NOT_FULL,
  ROOM_COMMAND_FAILURE_WRONG_PHASE,
} from '@/features/room/session/createRoomCommandFailureMessage';

/** 把房间命令的失败原因翻译成用户可读的中文。 */
export const getAvalonRoomCommandFailureMessage = createRoomCommandFailureMessage<AvalonState>(
  {
    [AVALON_REASONS.config]: '配置无效，请检查人数（5 至 10 人）、投票模式与否决上限设置',
    [AVALON_REASONS.phase]: ROOM_COMMAND_FAILURE_WRONG_PHASE,
    [AVALON_REASONS.notHostStart]: '只有房主可以开始游戏',
    [AVALON_REASONS.notHostBegin]: '只有房主可以开始游戏',
    [AVALON_REASONS.notAllViewed]: '还有玩家未查看身份',
    [AVALON_REASONS.full]: ROOM_COMMAND_FAILURE_SEATS_NOT_FULL,
    [AVALON_REASONS.notNightParticipant]: '你不在当前确认步骤内',
    [AVALON_REASONS.notLeader]: '只有当前队长可以组队',
    [AVALON_REASONS.notVotePhase]: '当前不在投票阶段',
    [AVALON_REASONS.notHostFinishVote]: '只有房主可以结束投票',
    [AVALON_REASONS.notTeamMember]: '你不在本轮任务队伍中',
    [AVALON_REASONS.goodMustSucceed]: '好人只能出成功牌',
    [AVALON_REASONS.notHostFinishQuest]: '只有房主可以结束任务',
    [AVALON_REASONS.notLadyHolder]: '只有湖仙持有人可以查验',
    [AVALON_REASONS.ladyAlreadyExamined]: '该玩家已担任过湖仙，不能查验',
    [AVALON_REASONS.ladyCannotCheckSelf]: '不能查验自己',
    [AVALON_REASONS.notLadyTarget]: '只有被查验者可以确认',
    [AVALON_REASONS.notAssassinAccuse]: '只有刺客可以指认',
    [AVALON_REASONS.cannotAccuseSelf]: '不能指认自己',
    [AVALON_REASONS.notAssassinStrike]: '只有刺客可以刺杀',
    [AVALON_REASONS.noStrikeAtNight]: '晚上阶段不能刺杀',
    [AVALON_REASONS.cannotStrikeSelf]: '不能刺杀自己',
    [AVALON_REASONS.notHostReturnToLobby]: '只有房主可以返回大厅',
    [AVALON_REASONS.occupied]: ROOM_COMMAND_FAILURE_OCCUPIED_OUT_OF_RANGE,
    [AVALON_REASONS.invalidSeats]: '队员必须是已入座的玩家',
    [AVALON_REASONS.duplicateSeats]: '队员不能重复',
    [AVALON_REASONS.invalidVote]: '投票选项无效，请重试',
    [AVALON_REASONS.invalidPlay]: '出牌选项无效，请重试',
    [AVALON_REASONS.invalidTarget]: '目标座位无效，请重试',
    [AVALON_REASONS.audioPlaying]: '播报尚未结束，请稍候',
    [AVALON_REASONS.notHostAckAudio]: '只有房主可以确认播报',
    [AVALON_REASONS.notHostMarkBots]: '只有房主可以标记机器人已查看',
    [AVALON_REASONS.deadline]: '尚未到截止时间',
  },
  // 队员人数原因带人数参数（avalon_team_size_invalid:<n>），在此拼回 §6.1 文案。
  (reason) => {
    const prefix = 'avalon_team_size_invalid:';
    return reason.startsWith(prefix)
      ? `队员人数必须为 ${reason.slice(prefix.length)} 人`
      : undefined;
  },
);
