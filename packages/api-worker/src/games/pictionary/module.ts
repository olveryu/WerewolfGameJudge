/** Worker runtime module for Pictionary. */

import {
  parsePictionaryState,
  PICTIONARY_STATE_CODEC,
  pictionaryEngine,
} from '@game-judge/game-engine/games/pictionary/public';
import { z } from 'zod';

import { publishGameRewards } from '../../features/account/settleGameRewards';
import { defineWorkerGameModule } from '../../platform/gameModules/workerModule';
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
  migratePersistedState: parsePictionaryState,
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
  handleEffect: (effect, context) =>
    publishGameRewards({ ...effect.payload, kind: 'completion', gameType: 'pictionary' }, context),
});
