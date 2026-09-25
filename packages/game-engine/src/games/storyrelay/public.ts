/** Public pure Story Relay API for transport, persistence and the client game module. */

export type { StoryRelayCommand, StoryRelayTaskIdentity } from './commands/types';
export { STORY_RELAY_REASONS, type StoryRelayEffect } from './domain/decision';
export { decideStoryRelayCommand, getStoryRelayLifecycle, storyRelayEngine } from './engine';
export {
  parseStoryRelayState as migratePersistedStoryRelayState,
  parseStoryRelayConfig,
  parseStoryRelayState,
  STORY_RELAY_STATE_CODEC,
} from './state/codec';
export {
  DEFAULT_STORY_RELAY_CONFIG,
  getStoryRelayOccupiedSeatCount,
  getStoryRelayTaskForSeat,
  isValidStoryRelayConfig,
  STORY_RELAY_GALLERY_DURATIONS,
  STORY_RELAY_GAME_TYPE,
  STORY_RELAY_MAX_PLAYERS,
  STORY_RELAY_MIN_PLAYERS,
  STORY_RELAY_STATE_VERSION,
  STORY_RELAY_TEXT_MAX_LENGTH,
  STORY_RELAY_TRANSITION_DURATIONS,
  STORY_RELAY_WRITING_DURATIONS,
  type StoryRelayChain,
  type StoryRelayConfig,
  type StoryRelayEntry,
  type StoryRelayGallery,
  type StoryRelayHumanSeat,
  type StoryRelayState,
  type StoryRelayTask,
} from './state/types';
