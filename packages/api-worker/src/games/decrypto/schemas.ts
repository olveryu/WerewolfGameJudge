/** Strict external schemas for the Decrypto Worker module boundary. */

import {
  DECRYPTO_CONFIG_SCHEMA,
  type DecryptoConfig,
  type DecryptoInternalCommand,
  type DecryptoPublicCommand,
} from '@game-judge/game-engine/games/decrypto/public';
import { z } from 'zod';

import { definePublicCommandOptions } from '../../platform/room/commandOptions';
import { ROOM_PUBLIC_COMMAND_SCHEMAS } from '../../platform/room/commandSchemas';
import { configSchemaToZod } from '../../platform/room/configSchemaZod';

const decryptoConfigSchema: z.ZodType<DecryptoConfig> = configSchemaToZod(DECRYPTO_CONFIG_SCHEMA);

export const decryptoCreateConfigSchema: z.ZodType<DecryptoConfig> = decryptoConfigSchema;

const decryptoPublicCommandOptions = definePublicCommandOptions<DecryptoPublicCommand>()([
  ...ROOM_PUBLIC_COMMAND_SCHEMAS,
  z.strictObject({
    type: z.literal('decrypto.config.update'),
    config: decryptoConfigSchema,
  }),
  z.strictObject({ type: z.literal('decrypto.game.begin') }),
  z.strictObject({
    type: z.literal('decrypto.game.restart'),
    gameSequence: z.number().int().nonnegative(),
    wasEnded: z.boolean(),
  }),
  z.strictObject({ type: z.literal('decrypto.teams.move'), seat: z.number().int().nonnegative() }),
  z.strictObject({
    type: z.literal('decrypto.teams.encryptor'),
    team: z.enum(['blue', 'purple']),
    seat: z.number().int().nonnegative(),
  }),
  z.strictObject({ type: z.literal('decrypto.teams.randomize') }),
  z.strictObject({ type: z.literal('decrypto.teams.confirm') }),
  z.strictObject({
    type: z.literal('decrypto.clues.submit'),
    clues: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
  }),
  z.strictObject({
    type: z.literal('decrypto.guess.submit'),
    kind: z.enum(['decode', 'intercept']),
    guess: z.tuple([
      z.number().int().min(1).max(4),
      z.number().int().min(1).max(4),
      z.number().int().min(1).max(4),
    ]),
  }),
  z.strictObject({
    type: z.literal('decrypto.reveal.continue'),
    gameSequence: z.number().int().nonnegative(),
  }),
  z.strictObject({
    type: z.literal('decrypto.tiebreak.submit'),
    guesses: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1), z.string().min(1)]),
  }),
  z.strictObject({
    type: z.literal('decrypto.tiebreak.judge'),
    team: z.enum(['blue', 'purple']),
    correct: z.tuple([z.boolean(), z.boolean(), z.boolean(), z.boolean()]),
  }),
] as const);

export const decryptoPublicCommandSchema: z.ZodType<DecryptoPublicCommand> = z.discriminatedUnion(
  'type',
  decryptoPublicCommandOptions,
);

export const decryptoInternalCommandSchema: z.ZodType<DecryptoInternalCommand> =
  z.discriminatedUnion('type', [
    z.strictObject({
      type: z.literal('decrypto.words.selected'),
      requestId: z.string().min(1),
      keywords: z.strictObject({
        blue: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1), z.string().min(1)]),
        purple: z.tuple([
          z.string().min(1),
          z.string().min(1),
          z.string().min(1),
          z.string().min(1),
        ]),
      }),
    }),
    z.strictObject({
      type: z.literal('decrypto.reveal.advance'),
      gameSequence: z.number().int().nonnegative(),
      round: z.number().int().positive(),
      team: z.enum(['blue', 'purple']),
      revealIndex: z.number().int().nonnegative(),
      revealAt: z.number().int().nonnegative(),
    }),
  ]);
