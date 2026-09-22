/** Chinese presentation of Undercover command failures; transport failures retain shared handling. */
import {
  UNDERCOVER_REASONS,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';

import { getRoomCommandFailureReason } from '@/features/room/session/roomCommandResult';
import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';
import { translateReasonCode } from '@/utils/errorUtils';

const messages: Readonly<Record<string, string>> = {
  [UNDERCOVER_REASONS.phase]: '当前阶段不能执行此操作',
  [UNDERCOVER_REASONS.config]: '人数需为 4 至 12 人；启用白板至少需要 6 人',
  [UNDERCOVER_REASONS.occupied]: '人数之外仍有已占用座位，请先调整座位',
  [UNDERCOVER_REASONS.notFull]: '请先坐满所有座位',
  [UNDERCOVER_REASONS.round]: '对局已变化，请等待房间状态刷新',
  [UNDERCOVER_REASONS.alreadyRevealed]: '该玩家已经出局',
  [UNDERCOVER_REASONS.word]: '词对不符合当前设置，请重新准备',
  [UNDERCOVER_REASONS.reused]: '该词对已使用，请重新准备',
  [UNDERCOVER_REASONS.bot]: '只能接管当前房间的测试机器人',
  [UNDERCOVER_REASONS.failure]: '准备结果无效，请重新准备',
};

export function getUndercoverRoomCommandFailureMessage(
  result: RoomCommandDispatchOutcome<UndercoverState>,
): string {
  const reason = getRoomCommandFailureReason(result);
  return messages[reason] ?? translateReasonCode(reason);
}
