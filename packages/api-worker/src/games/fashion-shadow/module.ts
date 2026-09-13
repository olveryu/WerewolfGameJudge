// Worker runtime module for Fashion Shadow.

import {
  FASHION_STATE_CODEC,
  fashionEngine,
  getFashionPublicState,
  parseFashionPublicStats,
} from '@game-judge/game-engine/games/fashion-shadow/public';

import { defineWorkerGameModule } from '../../platform/gameModules/workerModule';
import { fashionEffectSchema, handleFashionEffect } from './effects';
import {
  fashionCreateConfigSchema,
  fashionInternalCommandSchema,
  fashionPublicCommandSchema,
} from './schemas';

export const fashionWorkerModule = defineWorkerGameModule({
  getEffectFailureCommand: () => null,
  canReplayFailedEffect: () => false,
  gameType: 'fashion-shadow',
  engine: fashionEngine,
  stateCodec: FASHION_STATE_CODEC,
  createConfigSchema: fashionCreateConfigSchema,
  publicCommandSchema: fashionPublicCommandSchema,
  internalCommandSchema: fashionInternalCommandSchema,
  effectSchema: fashionEffectSchema,
  httpRoutes: [],
  projectStateForUser: getFashionPublicState,
  parsePublicUserStats: parseFashionPublicStats,
  getPublicUserStats: () => Promise.resolve({ gameType: 'fashion-shadow' }),
  getEffectBusinessKey: () => {
    throw new Error('Fashion Shadow vertical slice does not define asynchronous effects');
  },
  handleEffect: handleFashionEffect,
});
