/** Worker runtime module for Secrethitler (秘密希特勒). */

import {
  migratePersistedSecrethitlerState,
  parseSecrethitlerPublicStats,
  SECRETHITLER_STATE_CODEC,
  secrethitlerEngine,
} from '@game-judge/game-engine/games/secrethitler/public';

import { defineWorkerGameModule } from '../../platform/gameModules/workerModule';
import { handleSecrethitlerEffect, secrethitlerEffectSchema } from './effects';
import { getSecrethitlerPublicUserStats } from './publicUserStats';
import {
  secrethitlerCreateConfigSchema,
  secrethitlerInternalCommandSchema,
  secrethitlerPublicCommandSchema,
} from './schemas';

export const secrethitlerWorkerModule = defineWorkerGameModule({
  gameType: 'secrethitler',
  engine: secrethitlerEngine,
  stateCodec: SECRETHITLER_STATE_CODEC,
  migratePersistedState: migratePersistedSecrethitlerState,
  createConfigSchema: secrethitlerCreateConfigSchema,
  publicCommandSchema: secrethitlerPublicCommandSchema,
  internalCommandSchema: secrethitlerInternalCommandSchema,
  effectSchema: secrethitlerEffectSchema,
  parsePublicUserStats: parseSecrethitlerPublicStats,
  getPublicUserStats: getSecrethitlerPublicUserStats,
  httpRoutes: [],
  getEffectBusinessKey: (effect, context) =>
    `secrethitler:game-completed:${context.createdRevision}:${effect.payload.roundId}`,
  handleEffect: handleSecrethitlerEffect,
});
