/** Worker runtime module for FibKing. */

import {
  FIB_STATE_CODEC,
  fibEngine,
  parseFibPublicStats,
} from '@game-judge/game-engine/games/fibking/public';

import { defineWorkerGameModule } from '../../platform/gameModules/workerModule';
import { fibEffectSchema, handleFibEffect } from './effects';
import { fibCreateConfigSchema, fibInternalCommandSchema, fibPublicCommandSchema } from './schemas';

export const fibWorkerModule = defineWorkerGameModule({
  gameType: 'fibking',
  engine: fibEngine,
  stateCodec: FIB_STATE_CODEC,
  createConfigSchema: fibCreateConfigSchema,
  publicCommandSchema: fibPublicCommandSchema,
  internalCommandSchema: fibInternalCommandSchema,
  effectSchema: fibEffectSchema,
  httpRoutes: [],
  parsePublicUserStats: parseFibPublicStats,
  getPublicUserStats: () => Promise.resolve({ gameType: 'fibking' }),
  getEffectBusinessKey: (effect) => effect.payload.roundId,
  handleEffect: handleFibEffect,
});
