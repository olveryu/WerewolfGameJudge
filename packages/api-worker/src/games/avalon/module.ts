/** Worker runtime module for Avalon (阿瓦隆). */

import {
  AVALON_STATE_CODEC,
  avalonEngine,
  migratePersistedAvalonState,
} from '@game-judge/game-engine/games/avalon/public';
import { z } from 'zod';

import { defineWorkerGameModule } from '../../platform/gameModules/workerModule';
import { avalonEffectSchema, handleAvalonEffect } from './effects';
import { avalonCreateConfigSchema, avalonPublicCommandSchema } from './schemas';

const avalonPublicStatsSchema = z.strictObject({
  gameType: z.literal('avalon'),
});

export const avalonWorkerModule = defineWorkerGameModule({
  gameType: 'avalon',
  engine: avalonEngine,
  stateCodec: AVALON_STATE_CODEC,
  migratePersistedState: migratePersistedAvalonState,
  createConfigSchema: avalonCreateConfigSchema,
  publicCommandSchema: avalonPublicCommandSchema,
  internalCommandSchema: z.never(),
  effectSchema: avalonEffectSchema,
  httpRoutes: [],
  parsePublicUserStats: (value) => avalonPublicStatsSchema.parse(value),
  getPublicUserStats: () => Promise.resolve({ gameType: 'avalon' as const }),
  getEffectBusinessKey: (effect) => effect.payload.roundId,
  getEffectFailureCommand: () => null,
  canReplayFailedEffect: () => true,
  handleEffect: handleAvalonEffect,
});
