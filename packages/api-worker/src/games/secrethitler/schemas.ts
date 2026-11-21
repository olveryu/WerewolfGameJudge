/** Strict external schemas for the Secrethitler Worker module boundary. */

import {
  SECRETHITLER_CONFIG_SCHEMA,
  type SecrethitlerConfig,
  type SecrethitlerInternalCommand,
  type SecrethitlerPublicCommand,
} from '@game-judge/game-engine/games/secrethitler/public';
import { z } from 'zod';

import { definePublicCommandOptions } from '../../platform/room/commandOptions';
import { ROOM_PUBLIC_COMMAND_SCHEMAS } from '../../platform/room/commandSchemas';
import { configSchemaToZod } from '../../platform/room/configSchemaZod';

const secrethitlerConfigSchema: z.ZodType<SecrethitlerConfig> = configSchemaToZod(
  SECRETHITLER_CONFIG_SCHEMA,
);

export const secrethitlerCreateConfigSchema: z.ZodType<SecrethitlerConfig> =
  secrethitlerConfigSchema;

const secrethitlerPublicCommandOptions = definePublicCommandOptions<SecrethitlerPublicCommand>()([
  ...ROOM_PUBLIC_COMMAND_SCHEMAS,
  z.strictObject({
    type: z.literal('secrethitler.config.update'),
    config: secrethitlerConfigSchema,
  }),
  z.strictObject({ type: z.literal('secrethitler.roles.assign') }),
  z.strictObject({ type: z.literal('secrethitler.game.begin') }),
  z.strictObject({
    type: z.literal('secrethitler.game.restart'),
    gameSequence: z.number().int().nonnegative(),
    wasEnded: z.boolean(),
  }),
  z.strictObject({ type: z.literal('secrethitler.bots.markAllBotsViewed') }),
  z.strictObject({ type: z.literal('secrethitler.bots.markAllBotsGroupConfirmed') }),
  z.strictObject({ type: z.literal('secrethitler.role.viewed') }),
  z.strictObject({
    type: z.literal('secrethitler.audio.ack'),
    audioBatchId: z.number().int().nonnegative(),
  }),
  z.strictObject({
    type: z.literal('secrethitler.night.replay'),
    step: z.number().int().min(0).max(3),
  }),
  z.strictObject({
    type: z.literal('secrethitler.night.confirm'),
    step: z.number().int().min(1).max(1),
  }),
  z.strictObject({
    type: z.literal('secrethitler.government.nominate'),
    chancellorSeatId: z.number().int().min(0).max(9),
  }),
  z.strictObject({
    type: z.literal('secrethitler.government.castVote'),
    vote: z.enum(['ja', 'nein']),
  }),
  z.strictObject({
    type: z.literal('secrethitler.policy.presidentDiscard'),
    policy: z.enum(['liberal', 'fascist']),
  }),
  z.discriminatedUnion('action', [
    z.strictObject({
      type: z.literal('secrethitler.policy.chancellorResolve'),
      action: z.literal('enact'),
      policy: z.enum(['liberal', 'fascist']),
    }),
    z.strictObject({
      type: z.literal('secrethitler.policy.chancellorResolve'),
      action: z.literal('veto'),
    }),
  ]),
  z.strictObject({ type: z.literal('secrethitler.policy.vetoRespond'), approve: z.boolean() }),
  z.strictObject({
    type: z.literal('secrethitler.action.investigate'),
    targetSeatId: z.number().int().min(0).max(9),
  }),
  z.strictObject({
    type: z.literal('secrethitler.action.specialElection'),
    targetSeatId: z.number().int().min(0).max(9),
  }),
  z.strictObject({
    type: z.literal('secrethitler.action.execute'),
    targetSeatId: z.number().int().min(0).max(9),
  }),
  z.strictObject({ type: z.literal('secrethitler.action.acknowledgePolicyPeek') }),
]);

export const secrethitlerPublicCommandSchema: z.ZodType<SecrethitlerPublicCommand> =
  z.discriminatedUnion('type', secrethitlerPublicCommandOptions);

/** The skeleton has no worker-originated commands yet (see the engine commands/types.ts). */
export const secrethitlerInternalCommandSchema: z.ZodType<SecrethitlerInternalCommand> = z.never();
