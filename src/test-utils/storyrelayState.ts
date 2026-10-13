/** Canonical minimal StoryRelay state for client tests (AU-46). */

import type { StoryRelayState } from '@game-judge/game-engine/games/storyrelay/public';
import {
  DEFAULT_STORY_RELAY_CONFIG,
  storyRelayEngine,
} from '@game-judge/game-engine/games/storyrelay/public';

export function buildStoryRelayTestState(
  overrides: Partial<StoryRelayState> = {},
): StoryRelayState {
  return {
    ...storyRelayEngine.createInitialState(DEFAULT_STORY_RELAY_CONFIG, {
      roomCode: 'ABCD',
      hostUserId: 'host-1',
      nowMs: 0,
      commandId: 'create',
    }),
    ...overrides,
  };
}
