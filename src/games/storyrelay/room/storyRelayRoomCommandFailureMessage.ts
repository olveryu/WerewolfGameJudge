/** Presents shared and Story Relay command failures without exposing command payloads. */

import type { StoryRelayState } from '@game-judge/game-engine/games/storyrelay/public';

import { getRoomCommandFailureReason } from '@/features/room/session/roomCommandResult';
import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';
import { translateReasonCode } from '@/utils/errorUtils';

/** Translates platform errors and preserves game-owned Chinese rejection messages. */
export function getStoryRelayRoomCommandFailureMessage(
  result: RoomCommandDispatchOutcome<StoryRelayState>,
): string {
  return translateReasonCode(getRoomCommandFailureReason(result));
}
