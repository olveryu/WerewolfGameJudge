/** Worker runtime module for Werewolf. */

import {
  migratePersistedWerewolfState,
  parseWerewolfPublicStats,
  WEREWOLF_STATE_CODEC,
  werewolfEngine,
} from '@game-judge/game-engine/games/werewolf/public';

import { settleDueBusinessKey, settleDueDeliveryAt } from '../../platform/gameModules/settleDue';
import { defineWorkerGameModule } from '../../platform/gameModules/workerModule';
import { werewolfAiChatRoutes } from './aiChat/routes';
import { handleWerewolfEffect, werewolfEffectSchema } from './effects';
import { getWerewolfPublicUserStats } from './publicUserStats';
import {
  werewolfCreateConfigSchema,
  werewolfInternalCommandSchema,
  werewolfPublicCommandSchema,
} from './schemas';

export const werewolfWorkerModule = defineWorkerGameModule({
  gameType: 'werewolf',
  engine: werewolfEngine,
  stateCodec: WEREWOLF_STATE_CODEC,
  migratePersistedState: migratePersistedWerewolfState,
  createConfigSchema: werewolfCreateConfigSchema,
  publicCommandSchema: werewolfPublicCommandSchema,
  internalCommandSchema: werewolfInternalCommandSchema,
  effectSchema: werewolfEffectSchema,
  httpRoutes: [
    {
      path: '/api/games/werewolf/ai-chat',
      router: werewolfAiChatRoutes,
    },
  ],
  parsePublicUserStats: parseWerewolfPublicStats,
  getPublicUserStats: getWerewolfPublicUserStats,
  getEffectBusinessKey: (effect, context) => {
    switch (effect.type) {
      case 'werewolf.mvp.awarded':
        return effect.payload.roundId;
      case 'werewolf.settle.due':
        return settleDueBusinessKey('werewolf:settle', effect.payload);
      case 'werewolf.game.ended':
        return `revision:${context.createdRevision}`;
    }
  },
  // The settle effect is the room's wake-up for an armed deadline:
  // park it in the outbox until its deadline.
  getEffectDeliveryAt: (effect) =>
    effect.type === 'werewolf.settle.due' ? settleDueDeliveryAt(effect.payload) : null,
  handleEffect: handleWerewolfEffect,
});
