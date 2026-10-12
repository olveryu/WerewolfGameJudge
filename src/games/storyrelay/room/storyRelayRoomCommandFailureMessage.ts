/** Presents shared and Story Relay command failures without exposing command payloads. */

import type { StoryRelayState } from '@game-judge/game-engine/games/storyrelay/public';

import { createRoomCommandFailureMessage } from '@/features/room/session/createRoomCommandFailureMessage';

/**
 * Translates platform errors and preserves game-owned Chinese rejection
 * messages. Story Relay owns no reason map of its own, so the shared
 * factory runs with an empty map.
 */
export const getStoryRelayRoomCommandFailureMessage =
  createRoomCommandFailureMessage<StoryRelayState>({});
