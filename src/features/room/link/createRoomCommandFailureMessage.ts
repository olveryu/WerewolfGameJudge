/** Builds a game's command-failure presenter from its reason map. */

import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { DispatchOutcome } from '@/platform/realtime/types';
import { translateReasonCode } from '@/utils/errorUtils';
import { ROOM_CHASSIS_REASON_MESSAGES } from '@/utils/roomChassisReasonMessages';

import { getRoomCommandFailureReason } from './roomCommandResult';

/** Failure copy shared verbatim by several games' reason maps. */
export const ROOM_COMMAND_FAILURE_SEATS_NOT_FULL = '请先坐满所有座位。';
export const ROOM_COMMAND_FAILURE_WRONG_PHASE = '当前阶段不能执行此操作';
export const ROOM_COMMAND_FAILURE_OCCUPIED_OUT_OF_RANGE =
  '目标人数之外的座位仍有玩家入座，请先让这些玩家离座';
export const ROOM_COMMAND_FAILURE_OCCUPIED_OUT_OF_RANGE_WITH_MOVE =
  '目标人数之外的座位仍有玩家入座，请先让这些玩家离座或换到空位';

export type RoomCommandFailureMessageMap = Readonly<Record<string, string>>;

/** Game-specific escape hatch consulted before the shared code translation. */
export type RoomCommandFailureFallback = (reason: string) => string | undefined;

/**
 * The one failure-presentation shape: platform (chassis) reason codes resolve from the shared
 * chassis table first — game maps carry gameplay reasons only. Then the game's map, then the
 * game's fallback, then the shared reason-code translation.
 */
export function createRoomCommandFailureMessage<TState extends BaseGameState<string>>(
  messages: RoomCommandFailureMessageMap,
  fallback?: RoomCommandFailureFallback,
): (result: DispatchOutcome<TState>) => string {
  return (result) => {
    const reason = getRoomCommandFailureReason(result);
    return (
      ROOM_CHASSIS_REASON_MESSAGES[reason] ??
      messages[reason] ??
      fallback?.(reason) ??
      translateReasonCode(reason)
    );
  };
}
