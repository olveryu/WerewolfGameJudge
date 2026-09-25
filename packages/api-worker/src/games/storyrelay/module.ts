/** Story Relay Worker registration; uses shared command processing and durable product rewards. */

import {
  migratePersistedStoryRelayState,
  STORY_RELAY_STATE_CODEC,
  storyRelayEngine,
} from '@game-judge/game-engine/games/storyrelay/public';
import { z } from 'zod';

import { publishGameRewards } from '../../features/account/settleGameRewards';
import { defineWorkerGameModule } from '../../platform/gameModules/workerModule';
import {
  storyRelayCreateConfigSchema,
  storyRelayEffectSchema,
  storyRelayPublicCommandSchema,
} from './schemas';

const publicStatsSchema = z.strictObject({ gameType: z.literal('storyrelay') });

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
  parsePublicUserStats: (value) => publicStatsSchema.parse(value),
  getPublicUserStats: () => Promise.resolve({ gameType: 'storyrelay' as const }),
  getEffectBusinessKey: (effect) => effect.payload.roundId,
  handleEffect: (effect, context) =>
    publishGameRewards({ ...effect.payload, kind: 'completion', gameType: 'storyrelay' }, context),
  getEffectFailureCommand: () => null,
  canReplayFailedEffect: () => true,
});
