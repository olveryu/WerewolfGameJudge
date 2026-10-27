/** Strict external schemas for the FibKing Worker module. */

import type {
  FibConfig,
  FibInternalCommand,
  FibPublicCommand,
} from '@game-judge/game-engine/games/fibking/public';
import {
  FIB_CONFIG_SCHEMA,
  FIB_DEFINITION_FIELD_MAX_LENGTH,
  FIB_DEFINITION_FIELD_MIN_LENGTH,
  FIB_PREPARATION_FAILURE_CODES,
  FIB_PREPARATION_STAGES,
  FIB_WORD_MAX_LENGTH,
  FIB_WORD_MIN_LENGTH,
  FIB_WORD_SOURCES,
  isValidFibConfig,
} from '@game-judge/game-engine/games/fibking/public';
import { z } from 'zod';

import { definePublicCommandOptions } from '../../platform/room/commandOptions';
import { ROOM_PUBLIC_COMMAND_SCHEMAS } from '../../platform/room/commandSchemas';
import { configSchemaToZod } from '../../platform/room/configSchemaZod';

export const fibCreateConfigSchema: z.ZodType<FibConfig> = configSchemaToZod(FIB_CONFIG_SCHEMA);

const publicCommandOptions = definePublicCommandOptions<FibPublicCommand>()([
  ...ROOM_PUBLIC_COMMAND_SCHEMAS,
  z
    .strictObject({ type: z.literal('fibking.config.update'), numberOfPlayers: z.int() })
    .refine((command) => isValidFibConfig({ numberOfPlayers: command.numberOfPlayers })),
  z.strictObject({ type: z.literal('fibking.game.returnToLobby') }),
  z.strictObject({ type: z.literal('fibking.roles.assign') }),
  z.strictObject({ type: z.literal('fibking.round.cancelPreparing') }),
  z.strictObject({ type: z.literal('fibking.role.viewed') }),
  z.strictObject({ type: z.literal('fibking.bots.markAllBotsViewed') }),
  z.strictObject({ type: z.literal('fibking.game.begin') }),
  z.strictObject({
    type: z.literal('fibking.round.guess'),
    seat: z.number().int().nonnegative(),
  }),
  z.strictObject({ type: z.literal('fibking.round.reveal') }),
]);

export const fibPublicCommandSchema: z.ZodType<FibPublicCommand> = z.discriminatedUnion(
  'type',
  publicCommandOptions,
);

export const fibInternalCommandSchema: z.ZodType<FibInternalCommand> = z.discriminatedUnion(
  'type',
  [
    z.strictObject({
      type: z.literal('fibking.round.updatePreparationStage'),
      roundId: z.string().min(1),
      stage: z.union([
        z.literal(FIB_PREPARATION_STAGES.queued),
        z.literal(FIB_PREPARATION_STAGES.selecting),
        z.literal(FIB_PREPARATION_STAGES.finalizing),
      ]),
    }),
    z.strictObject({
      type: z.literal('fibking.round.failPreparation'),
      roundId: z.string().min(1),
      failureCode: z.enum(FIB_PREPARATION_FAILURE_CODES),
    }),
    z.strictObject({
      type: z.literal('fibking.round.complete'),
      roundId: z.string().min(1),
      word: z.string().trim().min(FIB_WORD_MIN_LENGTH).max(FIB_WORD_MAX_LENGTH),
      definition: z.strictObject({
        coreMeaning: z
          .string()
          .trim()
          .min(FIB_DEFINITION_FIELD_MIN_LENGTH)
          .max(FIB_DEFINITION_FIELD_MAX_LENGTH),
        usageNote: z
          .string()
          .trim()
          .min(FIB_DEFINITION_FIELD_MIN_LENGTH)
          .max(FIB_DEFINITION_FIELD_MAX_LENGTH),
      }),
      source: z.enum(FIB_WORD_SOURCES),
    }),
  ],
);
