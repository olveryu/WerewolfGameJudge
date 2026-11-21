/** Story Relay runtime state codec shared by persistence and network boundaries. */

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import { parseStoryRelayState } from './parseState';
import type { StoryRelayState } from './types';
import { STORY_RELAY_STATE_IDENTITY } from './version';

export const STORY_RELAY_STATE_CODEC = {
  ...STORY_RELAY_STATE_IDENTITY,
  parse: parseStoryRelayState,
} satisfies GameStateCodec<StoryRelayState>;
