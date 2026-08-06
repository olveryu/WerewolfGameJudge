/** Strict external schemas for the FibKing Worker module. */

import type {
  FibConfig,
  FibInternalCommand,
  FibPublicCommand,
} from '@game-judge/game-engine/games/fibking/public';
import {
  FIB_DEFINITION_FIELD_MAX_LENGTH,
  FIB_MIN_PLAYERS,
  FIB_PREPARATION_FAILURE_CODES,
  FIB_PREPARATION_STAGES,
  FIB_WORD_MAX_LENGTH,
  FIB_WORD_MIN_LENGTH,
} from '@game-judge/game-engine/games/fibking/public';
import { z } from 'zod';

import { ROOM_PUBLIC_COMMAND_SCHEMAS } from '../../platform/room/commandSchemas';

export const fibCreateConfigSchema: z.ZodType<FibConfig> = z.strictObject({
  numberOfPlayers: z.int().min(FIB_MIN_PLAYERS),
});

function defineFibPublicCommandOptions<const TOptions extends readonly z.ZodType[]>(
  options: TOptions &
    ([FibPublicCommand] extends [z.output<TOptions[number]>] ? unknown : never) &
    ([z.output<TOptions[number]>] extends [FibPublicCommand] ? unknown : never),
): TOptions {
  return options;
}

const publicCommandOptions = defineFibPublicCommandOptions([
  ...ROOM_PUBLIC_COMMAND_SCHEMAS,
  z.strictObject({
    type: z.literal('fib.config.update'),
    numberOfPlayers: z.int().min(FIB_MIN_PLAYERS),
  }),
  z.strictObject({ type: z.literal('fib.round.start') }),
  z.strictObject({ type: z.literal('fib.round.cancelPreparing') }),
  z.strictObject({ type: z.literal('fib.round.reveal') }),
]);

export const fibPublicCommandSchema: z.ZodType<FibPublicCommand> = z.discriminatedUnion(
  'type',
  publicCommandOptions,
);

export const fibInternalCommandSchema: z.ZodType<FibInternalCommand> = z.discriminatedUnion(
  'type',
  [
    z.strictObject({
      type: z.literal('fib.round.updatePreparationStage'),
      roundId: z.string().min(1),
      stage: z.union([
        z.literal(FIB_PREPARATION_STAGES.queued),
        z.literal(FIB_PREPARATION_STAGES.selectingWord),
      ]),
    }),
    z.strictObject({
      type: z.literal('fib.round.failPreparation'),
      roundId: z.string().min(1),
      failureCode: z.enum(FIB_PREPARATION_FAILURE_CODES),
    }),
    z.strictObject({
      type: z.literal('fib.round.complete'),
      roundId: z.string().min(1),
      catalogEntryId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      catalogVersion: z.int().positive(),
      word: z
        .string()
        .min(FIB_WORD_MIN_LENGTH)
        .max(FIB_WORD_MAX_LENGTH)
        .regex(/^\p{Script=Han}+$/u),
      definition: z.strictObject({
        coreMeaning: z.string().min(1).max(FIB_DEFINITION_FIELD_MAX_LENGTH),
        usageNote: z.string().min(1).max(FIB_DEFINITION_FIELD_MAX_LENGTH),
      }),
    }),
  ],
);
