// User-facing Fashion Shadow command rejection messages.

import {
  type FashionPublicState,
  REASON_FASHION_ACTION_TOKEN_REQUIRED,
  REASON_FASHION_ALREADY_VOTED,
  REASON_FASHION_CROSS_EXAM_AWARD_ALREADY_SET,
  REASON_FASHION_CROSS_EXAM_AWARD_INVALID,
  REASON_FASHION_CROSS_EXAM_AWARD_VOTES_INCOMPLETE,
  REASON_FASHION_CROSS_EXAM_EVIDENCE_UNAVAILABLE,
  REASON_FASHION_CROSS_EXAM_NOT_FINISHED,
  REASON_FASHION_CROSS_EXAM_STATEMENT_CLOSED,
  REASON_FASHION_CROSS_EXAM_STATEMENT_INVALID,
  REASON_FASHION_CROSS_EXAM_STATEMENT_LIMIT_REACHED,
  REASON_FASHION_CROSS_EXAM_STATEMENT_NOT_PARTICIPANT,
  REASON_FASHION_DISCUSSION_LIMIT_REACHED,
  REASON_FASHION_DISCUSSION_MESSAGE_INVALID,
  REASON_FASHION_HEARING_EVIDENCE_UNAVAILABLE,
  REASON_FASHION_HEARING_STATEMENT_ALREADY_SET,
  REASON_FASHION_HEARING_STATEMENT_INVALID,
  REASON_FASHION_IDENTITY_GUESS_ROUND_LIMIT,
  REASON_FASHION_IDENTITY_GUESS_TARGET_REPEATED,
  REASON_FASHION_PHASE_INVALID,
  REASON_FASHION_ROLE_ALREADY_CONFIRMED,
  REASON_FASHION_ROLE_NOT_ASSIGNED,
  REASON_FASHION_ROLES_NOT_CONFIRMED,
  REASON_FASHION_ROOM_NOT_FULL,
  REASON_FASHION_VOTES_INCOMPLETE,
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
      return '必须 7 个座位全部入座后才能开始';
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
      return '本组 3 分钟交叉质询尚未结束';
    case REASON_FASHION_CROSS_EXAM_STATEMENT_INVALID:
      return '质询论点不能为空或超过长度限制';
    case REASON_FASHION_CROSS_EXAM_STATEMENT_LIMIT_REACHED:
      return '你在本组质询中的论点次数已达到上限';
    case REASON_FASHION_CROSS_EXAM_STATEMENT_NOT_PARTICIPANT:
      return '只有当前攻防双方可以提交质询论点';
    case REASON_FASHION_CROSS_EXAM_EVIDENCE_UNAVAILABLE:
      return '这张证据当前不可引用';
    case REASON_FASHION_CROSS_EXAM_STATEMENT_CLOSED:
      return '本组质询时间已经结束';
    case REASON_FASHION_CROSS_EXAM_AWARD_INVALID:
      return '只能从本轮实际参加交叉质询的玩家中评选';
    case REASON_FASHION_CROSS_EXAM_AWARD_ALREADY_SET:
      return '你已经提交过本轮最佳攻防者选票';
    case REASON_FASHION_CROSS_EXAM_AWARD_VOTES_INCOMPLETE:
      return '仍有玩家未完成最佳攻防者评选';
    case REASON_FASHION_DISCUSSION_LIMIT_REACHED:
      return '你本轮的主动发言次数已达到上限';
    case REASON_FASHION_DISCUSSION_MESSAGE_INVALID:
      return '发言内容不能为空或超过长度限制';
    case REASON_FASHION_HEARING_STATEMENT_INVALID:
      return '结案陈词不能为空或超过长度限制';
    case REASON_FASHION_HEARING_STATEMENT_ALREADY_SET:
      return '你已经提交过正式结案陈词';
    case REASON_FASHION_HEARING_EVIDENCE_UNAVAILABLE:
      return '正式结案陈词只能引用已公开证据';
    case REASON_FASHION_IDENTITY_GUESS_ROUND_LIMIT:
      return '你本轮已经进行过身份猜测';
    case REASON_FASHION_IDENTITY_GUESS_TARGET_REPEATED:
      return '不能连续对同一位玩家进行身份猜测';
    case REASON_FASHION_ALREADY_VOTED:
      return '你已经完成本轮投票';
    case REASON_FASHION_VOTES_INCOMPLETE:
      return '仍有玩家未完成投票';
    default:
      return translateReasonCode(reason);
  }
}
