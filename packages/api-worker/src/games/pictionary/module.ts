/** Worker runtime module for Pictionary. */

import {
  PICTIONARY_STATE_CODEC,
  pictionaryEngine,
} from '@game-judge/game-engine/games/pictionary/public';
import { z } from 'zod';

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
  gameType: 'pictionary',
  engine: pictionaryEngine,
  stateCodec: PICTIONARY_STATE_CODEC,
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
  getEffectBusinessKey: (_effect, context) => `revision:${context.createdRevision}`,
  handleEffect: (effect) => {
    const exhaustive: never = effect;
    throw new Error(`Pictionary emitted an unsupported effect: ${String(exhaustive)}`);
  },
});
