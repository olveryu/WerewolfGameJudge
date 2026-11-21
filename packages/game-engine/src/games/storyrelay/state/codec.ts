/** Story Relay runtime state codec shared by persistence and network boundaries. */

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import { parseStoryRelayState } from './parseState';
import type { StoryRelayState } from './types';

export const STORY_RELAY_STATE_CODEC = {
  gameType: 'storyrelay',
  parse: parseStoryRelayState,
} satisfies GameStateCodec<StoryRelayState>;
