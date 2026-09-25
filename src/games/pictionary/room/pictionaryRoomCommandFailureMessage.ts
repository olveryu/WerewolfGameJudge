/** Pictionary-owned presentation for domain command rejections. */

import {
  PICTIONARY_TEXT_MAX_LENGTH,
  type PictionaryState,
  REASON_PICTIONARY_CONFIG_INVALID,
  REASON_PICTIONARY_GALLERY_MANUAL,
  REASON_PICTIONARY_OCCUPIED_SEAT_OUT_OF_RANGE,
  REASON_PICTIONARY_PHASE_INVALID,
  REASON_PICTIONARY_PHASE_NOT_EXPIRED,
  REASON_PICTIONARY_ROOM_NOT_FULL,
  REASON_PICTIONARY_TASK_ALREADY_SUBMITTED,
  REASON_PICTIONARY_TASK_INVALID,
  REASON_PICTIONARY_TEXT_INVALID,
  REASON_PICTIONARY_UPLOAD_EXPIRED,
  REASON_PICTIONARY_UPLOAD_INVALID,
} from '@game-judge/game-engine/games/pictionary/public';

import { getRoomCommandFailureReason } from '@/features/room/session/roomCommandResult';
import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';
import { translateReasonCode } from '@/utils/errorUtils';

export function getPictionaryRoomCommandFailureMessage(
  result: RoomCommandDispatchOutcome<PictionaryState>,
): string {
  const reason = getRoomCommandFailureReason(result);
  switch (reason) {
    case REASON_PICTIONARY_CONFIG_INVALID:
      return '房间设置不符合玩法范围';
    case REASON_PICTIONARY_GALLERY_MANUAL:
      return '当前结果设置为手动播放';
    case REASON_PICTIONARY_OCCUPIED_SEAT_OUT_OF_RANGE:
      return '目标人数之外仍有玩家，请先调整座位';
    case REASON_PICTIONARY_PHASE_INVALID:
      return '当前阶段不能执行这个操作';
    case REASON_PICTIONARY_PHASE_NOT_EXPIRED:
      return '当前阶段尚未到推进时间';
    case REASON_PICTIONARY_ROOM_NOT_FULL:
      return '请先让所有座位坐满';
    case REASON_PICTIONARY_TASK_ALREADY_SUBMITTED:
      return '这一棒已经提交';
    case REASON_PICTIONARY_TASK_INVALID:
      return '当前任务已变化，请按最新页面继续';
    case REASON_PICTIONARY_TEXT_INVALID:
      return `内容不能为空，且最多输入 ${PICTIONARY_TEXT_MAX_LENGTH} 个字符`;
    case REASON_PICTIONARY_UPLOAD_EXPIRED:
      return '画作上传时间已结束';
    case REASON_PICTIONARY_UPLOAD_INVALID:
      return '画作预留无法确认，请重试';
    default:
      return translateReasonCode(reason);
  }
}
