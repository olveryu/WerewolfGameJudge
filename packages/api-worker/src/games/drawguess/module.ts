/** Worker runtime module for DrawGuess (经典你画我猜). */

import {
  DRAWGUESS_STATE_CODEC,
  drawGuessEngine,
  migratePersistedDrawGuessState,
} from '@game-judge/game-engine/games/drawguess/public';

import { defineWorkerGameModule } from '../../platform/gameModules/workerModule';
import { drawGuessEffectSchema, handleDrawGuessEffect } from './effects';
import { drawGuessMediaRoutes } from './mediaRoutes';
import {
  drawGuessCreateConfigSchema,
  drawGuessInternalCommandSchema,
  drawGuessPublicCommandSchema,
} from './schemas';

export const drawGuessWorkerModule = defineWorkerGameModule({
  gameType: 'drawguess',
  engine: drawGuessEngine,
  stateCodec: DRAWGUESS_STATE_CODEC,
  migratePersistedState: migratePersistedDrawGuessState,
  createConfigSchema: drawGuessCreateConfigSchema,
  publicCommandSchema: drawGuessPublicCommandSchema,
  internalCommandSchema: drawGuessInternalCommandSchema,
  effectSchema: drawGuessEffectSchema,
  httpRoutes: [
    {
      path: '/api/games/drawguess/rooms',
      router: drawGuessMediaRoutes,
    },
  ],
  getEffectBusinessKey: (effect, context) =>
    effect.type === 'drawguess.words.deal'
      ? `drawguess:words-deal:${context.createdRevision}:${effect.payload.turnIndex}`
      : `drawguess:game-completed:${context.createdRevision}:${effect.payload.roundId}`,
  handleEffect: handleDrawGuessEffect,
});
