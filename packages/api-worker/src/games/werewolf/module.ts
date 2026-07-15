/** Worker runtime module for Werewolf. */

import {
  parseWerewolfPublicStats,
  WEREWOLF_STATE_CODEC,
  werewolfEngine,
} from '@werewolf/game-engine/games/werewolf/public';

import { defineWorkerGameModule } from '../workerModule';
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
  createConfigSchema: werewolfCreateConfigSchema,
  publicCommandSchema: werewolfPublicCommandSchema,
  internalCommandSchema: werewolfInternalCommandSchema,
  effectSchema: werewolfEffectSchema,
  parsePublicUserStats: parseWerewolfPublicStats,
  getPublicUserStats: getWerewolfPublicUserStats,
  getEffectBusinessKey: (_effect, context) => `revision:${context.createdRevision}`,
  handleEffect: handleWerewolfEffect,
});
