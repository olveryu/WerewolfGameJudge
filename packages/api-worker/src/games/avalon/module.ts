/** Worker runtime module for Avalon (阿瓦隆). */

import {
  AVALON_STATE_CODEC,
  avalonEngine,
  migratePersistedAvalonState,
} from '@game-judge/game-engine/games/avalon/public';
import { z } from 'zod';

import { defineWorkerGameModule } from '../../platform/gameModules/workerModule';
import { avalonEffectSchema, handleAvalonEffect } from './effects';
import {
  avalonCreateConfigSchema,
  avalonInternalCommandSchema,
  avalonPublicCommandSchema,
} from './schemas';

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
  internalCommandSchema: avalonInternalCommandSchema,
  effectSchema: avalonEffectSchema,
  httpRoutes: [],
  parsePublicUserStats: (value) => avalonPublicStatsSchema.parse(value),
  getPublicUserStats: () => Promise.resolve({ gameType: 'avalon' as const }),
  getEffectBusinessKey: (effect) =>
    effect.type === 'avalon.settle.due'
      ? `avalon:settle:${effect.payload.gameSequence}:${effect.payload.phase}:` +
        `${effect.payload.round}:${effect.payload.deadlineAt}`
      : effect.payload.roundId,
  // The settle effect is the room's wake-up for the armed reveal
  // countdown: park it in the outbox until its deadline.
  getEffectDeliveryAt: (effect) =>
    effect.type === 'avalon.settle.due' ? effect.payload.deadlineAt : null,
  getEffectFailureCommand: () => null,
  canReplayFailedEffect: () => true,
  handleEffect: handleAvalonEffect,
});
