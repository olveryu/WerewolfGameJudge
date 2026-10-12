/** Current persisted state identity for storyrelay. */

import { STORY_RELAY_GAME_TYPE } from './types';

export const STORY_RELAY_STATE_VERSION = 2;

export const STORY_RELAY_STATE_IDENTITY = {
  gameType: STORY_RELAY_GAME_TYPE,
  stateVersion: STORY_RELAY_STATE_VERSION,
} as const;
