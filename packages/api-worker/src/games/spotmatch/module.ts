/** Worker runtime module for Spotmatch (一眼成对). */

import {
  migratePersistedSpotmatchState,
  parseSpotmatchPublicStats,
  projectSpotmatchStateForUser,
  SPOTMATCH_STATE_CODEC,
  spotmatchEngine,
} from '@game-judge/game-engine/games/spotmatch/public';

import { defineWorkerGameModule } from '../../platform/gameModules/workerModule';
import { handleSpotmatchEffect, spotmatchEffectSchema } from './effects';
import { getSpotmatchPublicUserStats } from './publicUserStats';
import {
  spotmatchCreateConfigSchema,
  spotmatchInternalCommandSchema,
  spotmatchPublicCommandSchema,
} from './schemas';

export const spotmatchWorkerModule = defineWorkerGameModule({
  gameType: 'spotmatch',
  engine: spotmatchEngine,
  stateCodec: SPOTMATCH_STATE_CODEC,
  projectStateForUser: projectSpotmatchStateForUser,
  migratePersistedState: migratePersistedSpotmatchState,
  createConfigSchema: spotmatchCreateConfigSchema,
  publicCommandSchema: spotmatchPublicCommandSchema,
  internalCommandSchema: spotmatchInternalCommandSchema,
  effectSchema: spotmatchEffectSchema,
  parsePublicUserStats: parseSpotmatchPublicStats,
  getPublicUserStats: getSpotmatchPublicUserStats,
  httpRoutes: [],
  getEffectBusinessKey: (effect, context) =>
    `spotmatch:game-completed:${context.createdRevision}:${effect.payload.roundId}`,
  handleEffect: handleSpotmatchEffect,
});
