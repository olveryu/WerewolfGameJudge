/** FibKing-owned presentation for domain command rejections. */

import {
  type FibState,
  REASON_FIB_GAME_NOT_ENDED,
  REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE,
  REASON_FIB_PLAYER_COUNT_INVALID,
  REASON_FIB_ROUND_ALREADY_ONGOING,
  REASON_FIB_ROUND_MISMATCH,
  REASON_FIB_ROUND_NOT_FULL,
  REASON_FIB_ROUND_NOT_ONGOING,
  REASON_FIB_ROUND_NOT_PREPARING,
  REASON_FIB_ROUND_NOT_VIEWING,
  REASON_FIB_WORD_INVALID,
  REASON_FIB_WORD_REUSED,
} from '@game-judge/game-engine/games/fibking/public';

import { getRoomCommandFailureReason } from '@/features/room/session/roomCommandResult';
import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';
import { translateReasonCode } from '@/utils/errorUtils';

export function getFibRoomCommandFailureMessage(
  result: RoomCommandDispatchOutcome<FibState>,
): string {
  const reason = getRoomCommandFailureReason(result);

  switch (reason) {
    case REASON_FIB_GAME_NOT_ENDED:
      return '当前游戏尚未结束';
    case REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE:
      return '目标人数之外的座位仍有真人入座，请先让这些玩家离座或换到空位';
    case REASON_FIB_PLAYER_COUNT_INVALID:
      return '人数必须是 4 到 20 之间的整数';
    case REASON_FIB_ROUND_NOT_FULL:
      return '请先坐满所有座位，或填充机器人。';
    case REASON_FIB_ROUND_ALREADY_ONGOING:
      return '本轮已经开始';
    case REASON_FIB_ROUND_NOT_PREPARING:
      return '当前没有正在准备的轮次';
    case REASON_FIB_ROUND_NOT_ONGOING:
      return '当前没有进行中的轮次';
    case REASON_FIB_ROUND_NOT_VIEWING:
      return '当前不在查看身份阶段';
    case REASON_FIB_ROUND_MISMATCH:
      return '本轮状态已变化，请等待房间状态刷新';
    case REASON_FIB_WORD_REUSED:
      return '生成的词语与本房间历史词语重复，请重试';
    case REASON_FIB_WORD_INVALID:
      return '生成的词语不符合玩法要求，请重试';
    default:
      return translateReasonCode(reason);
  }
}
