/** Undercover Worker module; domain state and command authority remain in the pure engine. */

import {
  migratePersistedUndercoverState,
  UNDERCOVER_STATE_CODEC,
  undercoverEngine,
} from '@game-judge/game-engine/games/undercover/public';

import { defineWorkerGameModule } from '../../platform/gameModules/workerModule';
import { getUndercoverEffectFailureCommand, handleUndercoverEffect } from './effects';
import { undercoverInventoryRoutes } from './routes';
import {
  undercoverCreateConfigSchema,
  undercoverEffectSchema,
  undercoverInternalCommandSchema,
  undercoverPublicCommandSchema,
} from './schemas';

export const undercoverWorkerModule = defineWorkerGameModule({
  gameType: 'undercover',
  engine: undercoverEngine,
  stateCodec: UNDERCOVER_STATE_CODEC,
  migratePersistedState: migratePersistedUndercoverState,
  createConfigSchema: undercoverCreateConfigSchema,
  publicCommandSchema: undercoverPublicCommandSchema,
  internalCommandSchema: undercoverInternalCommandSchema,
  effectSchema: undercoverEffectSchema,
  httpRoutes: [{ path: '/api/games/undercover/inventory', router: undercoverInventoryRoutes }],
  handleEffect: handleUndercoverEffect,
  getEffectFailureCommand: getUndercoverEffectFailureCommand,
  canReplayFailedEffect: (effect) => effect.type === 'undercover.game.completed',
});
