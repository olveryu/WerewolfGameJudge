/** Worker runtime module for Secrethitler (秘密希特勒). */

import {
  parseSecrethitlerPublicStats,
  SECRETHITLER_STATE_CODEC,
  secrethitlerEngine,
} from '@game-judge/game-engine/games/secrethitler/public';

import { settleDueBusinessKey, settleDueDeliveryAt } from '../../platform/gameModules/settleDue';
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
  createConfigSchema: secrethitlerCreateConfigSchema,
  publicCommandSchema: secrethitlerPublicCommandSchema,
  internalCommandSchema: secrethitlerInternalCommandSchema,
  effectSchema: secrethitlerEffectSchema,
  parsePublicUserStats: parseSecrethitlerPublicStats,
  getPublicUserStats: getSecrethitlerPublicUserStats,
  httpRoutes: [],
  getEffectBusinessKey: (effect, context) =>
    effect.type === 'secrethitler.settle.due'
      ? settleDueBusinessKey('secrethitler:settle', effect.payload)
      : `secrethitler:game-completed:${context.createdRevision}:${effect.payload.roundId}`,
  getEffectDeliveryAt: (effect) =>
    effect.type === 'secrethitler.settle.due' ? settleDueDeliveryAt(effect.payload) : null,
  handleEffect: handleSecrethitlerEffect,
});
