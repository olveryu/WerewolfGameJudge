/** Undercover Worker module; domain state and command authority remain in the pure engine. */

import {
  UNDERCOVER_STATE_CODEC,
  undercoverEngine,
} from '@game-judge/game-engine/games/undercover/public';
import { z } from 'zod';

import { defineWorkerGameModule } from '../../platform/gameModules/workerModule';
import { getUndercoverEffectFailureCommand, handleUndercoverEffect } from './effects';
import { undercoverInventoryRoutes } from './routes';
import {
  undercoverCreateConfigSchema,
  undercoverEffectSchema,
  undercoverInternalCommandSchema,
  undercoverPublicCommandSchema,
} from './schemas';

const publicStatsSchema = z.strictObject({ gameType: z.literal('undercover') });

export const undercoverWorkerModule = defineWorkerGameModule({
  gameType: 'undercover',
  engine: undercoverEngine,
  stateCodec: UNDERCOVER_STATE_CODEC,
  createConfigSchema: undercoverCreateConfigSchema,
  publicCommandSchema: undercoverPublicCommandSchema,
  internalCommandSchema: undercoverInternalCommandSchema,
  effectSchema: undercoverEffectSchema,
  httpRoutes: [{ path: '/api/games/undercover/inventory', router: undercoverInventoryRoutes }],
  parsePublicUserStats: (value) => publicStatsSchema.parse(value),
  getPublicUserStats: () => Promise.resolve({ gameType: 'undercover' as const }),
  getEffectBusinessKey: (effect) => effect.payload.roundId,
  handleEffect: handleUndercoverEffect,
  getEffectFailureCommand: getUndercoverEffectFailureCommand,
  canReplayFailedEffect: () => false,
});
