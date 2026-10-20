/** Worker runtime module for Avalon (阿瓦隆). */

import {
  AVALON_STATE_CODEC,
  avalonEngine,
  migratePersistedAvalonState,
} from '@game-judge/game-engine/games/avalon/public';

import { settleDueBusinessKey, settleDueDeliveryAt } from '../../platform/gameModules/settleDue';
import { defineWorkerGameModule } from '../../platform/gameModules/workerModule';
import { avalonEffectSchema, handleAvalonEffect } from './effects';
import {
  avalonCreateConfigSchema,
  avalonInternalCommandSchema,
  avalonPublicCommandSchema,
} from './schemas';

export const avalonWorkerModule = defineWorkerGameModule({
  gameType: 'avalon',
  engine: avalonEngine,
  stateCodec: AVALON_STATE_CODEC,
  migratePersistedState: migratePersistedAvalonState,
  createConfigSchema: avalonCreateConfigSchema,
  publicCommandSchema: avalonPublicCommandSchema,
  internalCommandSchema: avalonInternalCommandSchema,
  effectSchema: avalonEffectSchema,
  httpRoutes: [],
  getEffectBusinessKey: (effect) =>
    effect.type === 'avalon.settle.due'
      ? settleDueBusinessKey('avalon:settle', effect.payload)
      : effect.payload.roundId,
  // The settle effect is the room's wake-up for the armed reveal
  // countdown: park it in the outbox until its deadline.
  getEffectDeliveryAt: (effect) =>
    effect.type === 'avalon.settle.due' ? settleDueDeliveryAt(effect.payload) : null,
  handleEffect: handleAvalonEffect,
});
