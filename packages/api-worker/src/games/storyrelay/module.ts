/** Story Relay Worker registration; uses shared command processing and durable product rewards. */

import {
  migratePersistedStoryRelayState,
  STORY_RELAY_STATE_CODEC,
  storyRelayEngine,
} from '@game-judge/game-engine/games/storyrelay/public';
import { z } from 'zod';

import { defineWorkerGameModule } from '../../platform/gameModules/workerModule';
import { handleStoryRelayEffect } from './effects';
import {
  storyRelayCreateConfigSchema,
  storyRelayEffectSchema,
  storyRelayPublicCommandSchema,
} from './schemas';

export const storyRelayWorkerModule = defineWorkerGameModule({
  gameType: 'storyrelay',
  engine: storyRelayEngine,
  stateCodec: STORY_RELAY_STATE_CODEC,
  migratePersistedState: migratePersistedStoryRelayState,
  createConfigSchema: storyRelayCreateConfigSchema,
  publicCommandSchema: storyRelayPublicCommandSchema,
  internalCommandSchema: z.never(),
  effectSchema: storyRelayEffectSchema,
  httpRoutes: [],
  handleEffect: handleStoryRelayEffect,
});
