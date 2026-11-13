/** Worker runtime module for Pictionary. */

import {
  migratePersistedPictionaryState,
  parsePictionaryPublicStats,
  PICTIONARY_STATE_CODEC,
  pictionaryEngine,
} from '@game-judge/game-engine/games/pictionary/public';

import { settleDueBusinessKey, settleDueDeliveryAt } from '../../platform/gameModules/settleDue';
import { defineWorkerGameModule } from '../../platform/gameModules/workerModule';
import { handlePictionaryEffect } from './effects';
import { pictionaryMediaRoutes } from './mediaRoutes';
import { getPictionaryPublicUserStats } from './publicUserStats';
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
  parsePublicUserStats: parsePictionaryPublicStats,
  getPublicUserStats: getPictionaryPublicUserStats,
  httpRoutes: [
    {
      path: '/api/games/pictionary/rooms',
      router: pictionaryMediaRoutes,
    },
  ],
  getEffectBusinessKey: (effect) =>
    effect.type === 'pictionary.settle.due'
      ? settleDueBusinessKey('pictionary:settle', effect.payload)
      : effect.payload.roundId,
  // The settle effect is the room's wake-up for the armed stage
  // deadline: park it in the outbox until its deadline.
  getEffectDeliveryAt: (effect) =>
    effect.type === 'pictionary.settle.due' ? settleDueDeliveryAt(effect.payload) : null,
  handleEffect: handlePictionaryEffect,
});
