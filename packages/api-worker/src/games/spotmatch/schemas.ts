/** Strict external schemas for the Spotmatch Worker module boundary. */

import {
  SPOTMATCH_CONFIG_SCHEMA,
  type SpotmatchConfig,
  type SpotmatchInternalCommand,
  type SpotmatchPublicCommand,
} from '@game-judge/game-engine/games/spotmatch/public';
import { z } from 'zod';

import { definePublicCommandOptions } from '../../platform/room/commandOptions';
import { ROOM_PUBLIC_COMMAND_SCHEMAS } from '../../platform/room/commandSchemas';
import { configSchemaToZod } from '../../platform/room/configSchemaZod';

const spotmatchConfigSchema: z.ZodType<SpotmatchConfig> =
  configSchemaToZod(SPOTMATCH_CONFIG_SCHEMA);

export const spotmatchCreateConfigSchema: z.ZodType<SpotmatchConfig> = spotmatchConfigSchema;

const spotmatchPublicCommandOptions = definePublicCommandOptions<SpotmatchPublicCommand>()([
  ...ROOM_PUBLIC_COMMAND_SCHEMAS,
  z.strictObject({
    type: z.literal('spotmatch.config.update'),
    config: spotmatchConfigSchema,
  }),
  z.strictObject({ type: z.literal('spotmatch.game.begin') }),
  z.strictObject({
    type: z.literal('spotmatch.game.restart'),
    gameSequence: z.int().positive(),
    expectedPhase: z.enum(['playing', 'ended']),
  }),
  z.strictObject({
    type: z.literal('spotmatch.card.claim'),
    roundId: z.string().min(1),
    centralInstanceId: z.string().min(1),
    topInstanceId: z.string().min(1),
    symbolId: z.int().min(0).max(199),
  }),
]);

export const spotmatchPublicCommandSchema: z.ZodType<SpotmatchPublicCommand> = z.discriminatedUnion(
  'type',
  spotmatchPublicCommandOptions,
);

/** The skeleton has no worker-originated commands yet (see the engine commands/types.ts). */
export const spotmatchInternalCommandSchema: z.ZodType<SpotmatchInternalCommand> = z.never();
