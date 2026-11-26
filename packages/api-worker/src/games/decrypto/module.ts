/** Worker runtime module for Decrypto (解码战). */

import {
  DECRYPTO_STATE_CODEC,
  decryptoEngine,
  parseDecryptoPublicStats,
  projectDecryptoStateForUser,
} from '@game-judge/game-engine/games/decrypto/public';

import { defineWorkerGameModule } from '../../platform/gameModules/workerModule';
import { decryptoEffectSchema, handleDecryptoEffect } from './effects';
import { getDecryptoPublicUserStats } from './publicUserStats';
import {
  decryptoCreateConfigSchema,
  decryptoInternalCommandSchema,
  decryptoPublicCommandSchema,
} from './schemas';
import { decryptoWordRoutes } from './wordRoutes';

export const decryptoWorkerModule = defineWorkerGameModule({
  gameType: 'decrypto',
  engine: decryptoEngine,
  stateCodec: DECRYPTO_STATE_CODEC,
  projectStateForUser: projectDecryptoStateForUser,
  createConfigSchema: decryptoCreateConfigSchema,
  publicCommandSchema: decryptoPublicCommandSchema,
  internalCommandSchema: decryptoInternalCommandSchema,
  effectSchema: decryptoEffectSchema,
  parsePublicUserStats: parseDecryptoPublicStats,
  getPublicUserStats: getDecryptoPublicUserStats,
  httpRoutes: [
    {
      path: '/api/games/decrypto/rooms',
      router: decryptoWordRoutes,
    },
  ],
  getEffectBusinessKey: (effect, context) => {
    if (effect.type === 'decrypto.game.completed')
      return `decrypto:game-completed:${context.createdRevision}:${effect.payload.roundId}`;
    if (effect.type === 'decrypto.words.select')
      return `decrypto:words:${effect.payload.requestId}`;
    return `decrypto:reveal:${effect.payload.gameSequence}:${effect.payload.round}:${effect.payload.revealIndex}:${effect.payload.revealAt}`;
  },
  getEffectDeliveryAt: (effect) =>
    effect.type === 'decrypto.reveal.due' ? effect.payload.revealAt : null,
  handleEffect: handleDecryptoEffect,
});
