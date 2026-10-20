/** Worker runtime module for Demo (Demo). */

import {
  DEMO_STATE_CODEC,
  demoEngine,
  migratePersistedDemoState,
} from '@game-judge/game-engine/games/demo/public';

import { settleDueBusinessKey, settleDueDeliveryAt } from '../../platform/gameModules/settleDue';
import { defineWorkerGameModule } from '../../platform/gameModules/workerModule';
import { demoEffectSchema, handleDemoEffect } from './effects';
import {
  demoCreateConfigSchema,
  demoInternalCommandSchema,
  demoPublicCommandSchema,
} from './schemas';

export const demoWorkerModule = defineWorkerGameModule({
  gameType: 'demo',
  engine: demoEngine,
  stateCodec: DEMO_STATE_CODEC,
  migratePersistedState: migratePersistedDemoState,
  createConfigSchema: demoCreateConfigSchema,
  publicCommandSchema: demoPublicCommandSchema,
  internalCommandSchema: demoInternalCommandSchema,
  effectSchema: demoEffectSchema,
  httpRoutes: [],
  getEffectBusinessKey: (effect, context) =>
    effect.type === 'demo.settle.due'
      ? settleDueBusinessKey('demo:settle', effect.payload)
      : `demo:game-completed:${context.createdRevision}:${effect.payload.roundId}`,
  // The settle effect is the room's wake-up for the armed stage
  // deadline: park it in the outbox until its deadline.
  getEffectDeliveryAt: (effect) =>
    effect.type === 'demo.settle.due' ? settleDueDeliveryAt(effect.payload) : null,
  handleEffect: handleDemoEffect,
});
