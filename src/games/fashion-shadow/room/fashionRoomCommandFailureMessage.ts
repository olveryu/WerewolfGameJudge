// User-facing Fashion Shadow command rejection messages.

import {
  REASON_FASHION_ACTION_TOKEN_REQUIRED,
  REASON_FASHION_ALREADY_VOTED,
  REASON_FASHION_BOTS_NOT_SUPPORTED,
  REASON_FASHION_CROSS_EXAM_NOT_FINISHED,
  REASON_FASHION_DISCUSSION_LIMIT_REACHED,
  REASON_FASHION_PHASE_INVALID,
  REASON_FASHION_ROLE_ALREADY_CONFIRMED,
  REASON_FASHION_ROLE_NOT_ASSIGNED,
  REASON_FASHION_ROLES_NOT_CONFIRMED,
  REASON_FASHION_ROOM_NOT_FULL,
  REASON_FASHION_VOTES_INCOMPLETE,
  type FashionPublicState,
} from '@game-judge/game-engine/games/fashion-shadow/public';

import { getRoomCommandFailureReason } from '@/features/room/session/roomCommandResult';
import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';
import { translateReasonCode } from '@/utils/errorUtils';

export function getFashionRoomCommandFailureMessage(
  result: RoomCommandDispatchOutcome<FashionPublicState>,
): string {
  const reason = getRoomCommandFailureReason(result);
  switch (reason) {
    case REASON_FASHION_ROOM_NOT_FULL:
      return '必须 7 个座位全部有真人入座后才能开始';
    case REASON_FASHION_PHASE_INVALID:
      return '当前游戏阶段不能执行这个操作';
    case REASON_FASHION_ROLE_NOT_ASSIGNED:
      return '你的角色尚未完成分配，请等待状态同步';
    case REASON_FASHION_ROLE_ALREADY_CONFIRMED:
      return '你已经确认过身份';
    case REASON_FASHION_ROLES_NOT_CONFIRMED:
      return '仍有玩家未确认自己的身份';
    case REASON_FASHION_ACTION_TOKEN_REQUIRED:
      return '行动代币不足';
    case REASON_FASHION_CROSS_EXAM_NOT_FINISHED:
      return '3 分钟交叉质询尚未结束';
    case REASON_FASHION_DISCUSSION_LIMIT_REACHED:
      return '你本轮的主动发言次数已达到上限';
    case REASON_FASHION_ALREADY_VOTED:
      return '你已经完成本轮投票';
    case REASON_FASHION_VOTES_INCOMPLETE:
      return '仍有玩家未完成投票';
    case REASON_FASHION_BOTS_NOT_SUPPORTED:
      return '时尚追凶正式模式不支持机器人补位';
    default:
      return translateReasonCode(reason);
  }
}
