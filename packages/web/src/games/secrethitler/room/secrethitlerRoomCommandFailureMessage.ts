/**
 * 秘密希特勒命令失败文案的唯一来源。
 *
 * 引擎只发稳定英文码（`SECRETHITLER_REASONS`），匹配走常量引用、不手抄码原文。
 */

import {
  SECRETHITLER_REASONS,
  type SecrethitlerState,
} from '@game-judge/game-engine/games/secrethitler/public';
import { REASON_STEP_STALE } from '@game-judge/game-engine/platform/steps';

import {
  createRoomCommandFailureMessage,
  ROOM_COMMAND_FAILURE_OCCUPIED_OUT_OF_RANGE,
  ROOM_COMMAND_FAILURE_SEATS_NOT_FULL,
  ROOM_COMMAND_FAILURE_WRONG_PHASE,
} from '@/features/room/link/createRoomCommandFailureMessage';

/** 把房间命令的失败原因翻译成用户可读的中文。 */
export const getSecrethitlerRoomCommandFailureMessage =
  createRoomCommandFailureMessage<SecrethitlerState>({
    [SECRETHITLER_REASONS.config]: '配置无效，请检查人数设置',
    [SECRETHITLER_REASONS.phase]: ROOM_COMMAND_FAILURE_WRONG_PHASE,
    [SECRETHITLER_REASONS.notHostStart]: '只有房主可以开始游戏',
    [SECRETHITLER_REASONS.full]: ROOM_COMMAND_FAILURE_SEATS_NOT_FULL,
    [SECRETHITLER_REASONS.occupied]: ROOM_COMMAND_FAILURE_OCCUPIED_OUT_OF_RANGE,
    [REASON_STEP_STALE]: '当前行动步骤已变化，请重新选择',
    [SECRETHITLER_REASONS.notPresident]: '只有当前总统可以执行此操作',
    [SECRETHITLER_REASONS.notLiving]: '当前不能由你的座位执行此操作',
    [SECRETHITLER_REASONS.nomination]: '该玩家不符合总理任期限制，请重新选择',
    [SECRETHITLER_REASONS.preselection]: '预选状态已改变，请按当前提示操作',
    [SECRETHITLER_REASONS.notEligibleVote]: '只有存活玩家可以投票',
    [SECRETHITLER_REASONS.handChoice]: '请选择当前手牌中的政策',
    [SECRETHITLER_REASONS.veto]: '当前不能请求否决，请选择一张政策施行',
    [SECRETHITLER_REASONS.power]: '当前没有这项总统权力',
    [SECRETHITLER_REASONS.target]: '该目标不符合行动条件，请重新选择',
    [SECRETHITLER_REASONS.notHostBegin]: '只有房主可以开始游戏',
    [SECRETHITLER_REASONS.notHostAbort]: '只有房主可以中止本局',
    [SECRETHITLER_REASONS.notHostRetrySettle]: '只有房主可以重新推进阶段',
    [SECRETHITLER_REASONS.notHostMarkBots]: '只有房主可以标记机器人',
    [SECRETHITLER_REASONS.noBotSeats]: '当前没有符合条件的机器人座位',
    [SECRETHITLER_REASONS.notAllViewed]: '还有玩家未查看身份',
    [SECRETHITLER_REASONS.audioPlaying]: '播报尚未结束，请稍候',
    [SECRETHITLER_REASONS.notHostAckAudio]: '只有房主可以确认播报',
    [SECRETHITLER_REASONS.unknownAudioBatch]: '播报批次不存在，请刷新房间',
  });
