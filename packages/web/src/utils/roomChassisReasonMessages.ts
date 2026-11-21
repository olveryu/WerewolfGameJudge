/**
 * roomChassisReasonMessages - the one copy table for platform room reasons.
 *
 * The engine emits the stable codes defined in
 * `@game-judge/game-engine/platform/protocol/reasons`; this table is the
 * only place their user-facing Chinese copy is defined (audit item B-2).
 * Game presenter maps must carry gameplay reasons only: the shared
 * presenter factory resolves chassis codes from here before any game
 * map, and `translateReasonCode` spreads this table into its map, so
 * every surface (presenters, host/seat/profile controllers) shows the
 * same sentence for the same chassis code.
 *
 * Three platform codes have no established copy and are deliberately
 * absent: `user_actor_required` and `system_actor_required` are
 * engine-internal actor-kind guards unreachable from player UI, and
 * `room_instance_mismatch` is an api-worker routing response handled by
 * the API error surface. They fall through to the generic fallback
 * until a copy ruling adds them here.
 */

import {
  REASON_COMMAND_ID_CONFLICT,
  REASON_CONTROLLED_SEAT_NOT_ALLOWED,
  REASON_CONTROLLED_SEAT_NOT_BOT,
  REASON_GAME_IN_PROGRESS,
  REASON_INVALID_SEAT,
  REASON_NO_STATE,
  REASON_NOT_AUTHENTICATED,
  REASON_NOT_HOST,
  REASON_NOT_SEATED,
  REASON_ROOM_EFFECTS_PENDING,
  REASON_ROOM_INITIALIZATION_CONFLICT,
  REASON_SEAT_EMPTY,
  REASON_SEAT_TAKEN,
} from '@game-judge/game-engine/platform/protocol/reasons';

/** User-facing copy for the platform room-operation reason codes. */
export const ROOM_CHASSIS_REASON_MESSAGES: Readonly<Record<string, string>> = {
  [REASON_NOT_AUTHENTICATED]: '身份验证失败',
  [REASON_NO_STATE]: '房间不存在或已解散',
  [REASON_INVALID_SEAT]: '座位不存在',
  [REASON_SEAT_TAKEN]: '座位已被占用',
  [REASON_GAME_IN_PROGRESS]: '游戏进行中，无法操作',
  [REASON_NOT_SEATED]: '你还没有入座',
  [REASON_NOT_HOST]: '仅房主可以执行此操作',
  [REASON_SEAT_EMPTY]: '该座位没有玩家',
  [REASON_CONTROLLED_SEAT_NOT_ALLOWED]: '当前操作不支持接管座位',
  [REASON_CONTROLLED_SEAT_NOT_BOT]: '只能接管机器人座位',
  [REASON_COMMAND_ID_CONFLICT]: '操作标识冲突，请重试',
  [REASON_ROOM_INITIALIZATION_CONFLICT]: '房间初始化冲突，请重新创建',
  [REASON_ROOM_EFFECTS_PENDING]: '房间操作仍在处理中，请稍后重试',
};
