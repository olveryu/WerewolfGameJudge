/** Worker runtime module for Pictionary. */

import {
  migratePersistedPictionaryState,
  PICTIONARY_STATE_CODEC,
  pictionaryEngine,
} from '@game-judge/game-engine/games/pictionary/public';
import { z } from 'zod';

import { defineWorkerGameModule } from '../../platform/gameModules/workerModule';
import { handlePictionaryEffect } from './effects';
import { pictionaryMediaRoutes } from './mediaRoutes';
import {
  pictionaryCreateConfigSchema,
  pictionaryEffectSchema,
  pictionaryInternalCommandSchema,
  pictionaryPublicCommandSchema,
} from './schemas';

const pictionaryPublicStatsSchema = z.strictObject({
  gameType: z.literal('pictionary'),
});

export const pictionaryWorkerModule = defineWorkerGameModule({
  getEffectFailureCommand: () => null,
  canReplayFailedEffect: () => true,
  gameType: 'pictionary',
  engine: pictionaryEngine,
  stateCodec: PICTIONARY_STATE_CODEC,
  migratePersistedState: migratePersistedPictionaryState,
  createConfigSchema: pictionaryCreateConfigSchema,
  publicCommandSchema: pictionaryPublicCommandSchema,
  internalCommandSchema: pictionaryInternalCommandSchema,
  effectSchema: pictionaryEffectSchema,
  httpRoutes: [
    {
      path: '/api/games/pictionary/rooms',
      router: pictionaryMediaRoutes,
    },
  ],
  parsePublicUserStats: (value) => pictionaryPublicStatsSchema.parse(value),
  getPublicUserStats: () => Promise.resolve({ gameType: 'pictionary' as const }),
  getEffectBusinessKey: (effect) => effect.payload.roundId,
  handleEffect: handlePictionaryEffect,
});
