/** Worker runtime module for Werewolf. */

import { WEREWOLF_STATE_CODEC, werewolfEngine } from '@werewolf/game-engine/games/werewolf/public';

import { defineWorkerGameModule } from '../workerModule';
import { handleWerewolfEffect, werewolfEffectSchema } from './effects';
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
  handleEffect: handleWerewolfEffect,
});
