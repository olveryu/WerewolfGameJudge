/** Compile-only Worker plugin for the unregistered Pictionary engine fixture. */

import { z } from 'zod';

import {
  type PictionaryConfig,
  type PictionaryEffect,
  pictionaryEngine,
  type PictionaryInternalCommand,
  type PictionaryPublicCommand,
  pictionaryStateCodec,
  PICTURE_DICTIONARY_GAME_TYPE,
} from '../../game-engine/type-tests/pictionaryModule';
import { WORKER_GAME_CATALOG } from '../src/games/catalog';
import {
  defineWorkerGameModule,
  registerWorkerGameModule,
} from '../src/platform/gameModules/workerModule';

interface PictionaryPublicUserStats {
  readonly gameType: typeof PICTURE_DICTIONARY_GAME_TYPE;
}

const createConfigSchema: z.ZodType<PictionaryConfig> = z.strictObject({
  maxPlayers: z.number().int().positive(),
});

const publicCommandSchema: z.ZodType<PictionaryPublicCommand> = z.strictObject({
  type: z.literal('pictionary.round.start'),
});

const internalCommandSchema: z.ZodType<PictionaryInternalCommand> = z.strictObject({
  type: z.literal('pictionary.prompt.ready'),
  prompt: z.string().min(1),
});

const effectSchema: z.ZodType<PictionaryEffect> = z.strictObject({
  type: z.literal('pictionary.prompt.generate'),
  roundId: z.string().min(1),
});

const publicUserStatsSchema: z.ZodType<PictionaryPublicUserStats> = z.strictObject({
  gameType: z.literal(PICTURE_DICTIONARY_GAME_TYPE),
});

const pictionaryWorkerModule = defineWorkerGameModule({
  gameType: PICTURE_DICTIONARY_GAME_TYPE,
  engine: pictionaryEngine,
  stateCodec: pictionaryStateCodec,
  createConfigSchema,
  publicCommandSchema,
  internalCommandSchema,
  effectSchema,
  httpRoutes: [],
  parsePublicUserStats: (value) => publicUserStatsSchema.parse(value),
  getPublicUserStats: () => Promise.resolve({ gameType: PICTURE_DICTIONARY_GAME_TYPE }),
  getEffectBusinessKey: (effect) => effect.roundId,
  handleEffect: () => Promise.resolve(),
});

void pictionaryWorkerModule;

// @ts-expect-error unregistered identities cannot cross the production runtime boundary
registerWorkerGameModule(pictionaryWorkerModule);

// @ts-expect-error compile-only plugins are not members of the production Worker catalog
void WORKER_GAME_CATALOG.pictionary;
