/** Story Relay Worker registration; uses shared command processing and durable product rewards. */

import {
  migratePersistedStoryRelayState,
  STORY_RELAY_STATE_CODEC,
  storyRelayEngine,
} from '@game-judge/game-engine/games/storyrelay/public';

import { settleDueBusinessKey, settleDueDeliveryAt } from '../../platform/gameModules/settleDue';
import { defineWorkerGameModule } from '../../platform/gameModules/workerModule';
import { handleStoryRelayEffect } from './effects';
import {
  storyRelayCreateConfigSchema,
  storyRelayEffectSchema,
  storyRelayInternalCommandSchema,
  storyRelayPublicCommandSchema,
} from './schemas';

export const storyRelayWorkerModule = defineWorkerGameModule({
  gameType: 'storyrelay',
  engine: storyRelayEngine,
  stateCodec: STORY_RELAY_STATE_CODEC,
  migratePersistedState: migratePersistedStoryRelayState,
  createConfigSchema: storyRelayCreateConfigSchema,
  publicCommandSchema: storyRelayPublicCommandSchema,
  internalCommandSchema: storyRelayInternalCommandSchema,
  effectSchema: storyRelayEffectSchema,
  httpRoutes: [],
  getEffectBusinessKey: (effect) =>
    effect.type === 'storyrelay.settle.due'
      ? settleDueBusinessKey('storyrelay:settle', effect.payload)
      : effect.payload.roundId,
  // The settle effect is the room's wake-up for the armed stage
  // deadline: park it in the outbox until its deadline.
  getEffectDeliveryAt: (effect) =>
    effect.type === 'storyrelay.settle.due' ? settleDueDeliveryAt(effect.payload) : null,
  handleEffect: handleStoryRelayEffect,
});
