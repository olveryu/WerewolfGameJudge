/** Worker runtime module for Pictionary. */

import {
  migratePersistedPictionaryState,
  PICTIONARY_STATE_CODEC,
  pictionaryEngine,
} from '@game-judge/game-engine/games/pictionary/public';

import { defineWorkerGameModule } from '../../platform/gameModules/workerModule';
import { handlePictionaryEffect } from './effects';
import { pictionaryMediaRoutes } from './mediaRoutes';
import {
  pictionaryCreateConfigSchema,
  pictionaryEffectSchema,
  pictionaryInternalCommandSchema,
  pictionaryPublicCommandSchema,
} from './schemas';

export const pictionaryWorkerModule = defineWorkerGameModule({
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
  handleEffect: handlePictionaryEffect,
});
