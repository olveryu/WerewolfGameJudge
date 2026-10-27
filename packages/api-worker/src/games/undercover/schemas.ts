/** Strict Undercover boundary schemas; public callers cannot submit internal word effects. */

import {
  isValidUndercoverWordPair,
  UNDERCOVER_CATEGORIES,
  UNDERCOVER_CONFIG_SCHEMA,
  UNDERCOVER_MAX_PLAYERS,
  type UndercoverConfig,
  type UndercoverEffect,
  type UndercoverInternalCommand,
  type UndercoverPublicCommand,
  type UndercoverWordPair,
} from '@game-judge/game-engine/games/undercover/public';
import { z } from 'zod';

import { gameCompletionPayloadSchema } from '../../features/account/settleGameRewards';
import { definePublicCommandOptions } from '../../platform/room/commandOptions';
import { ROOM_PUBLIC_COMMAND_SCHEMAS } from '../../platform/room/commandSchemas';
import { configSchemaToZod } from '../../platform/room/configSchemaZod';

export const undercoverCreateConfigSchema: z.ZodType<UndercoverConfig> =
  configSchemaToZod(UNDERCOVER_CONFIG_SCHEMA);

export const undercoverWordPairSchema: z.ZodType<UndercoverWordPair> = z
  .strictObject({
    id: z.string().min(1),
    wordA: z.string().min(1),
    wordB: z.string().min(1),
    category: z.enum(UNDERCOVER_CATEGORIES),
  })
  .refine(isValidUndercoverWordPair);

const undercoverPublicCommandOptions = definePublicCommandOptions<UndercoverPublicCommand>()([
  ...ROOM_PUBLIC_COMMAND_SCHEMAS,
  z.strictObject({
    type: z.literal('undercover.config.update'),
    config: undercoverCreateConfigSchema,
  }),
  z.strictObject({ type: z.literal('undercover.roles.assign'), shouldAllowRepeated: z.boolean() }),
  z.strictObject({
    type: z.literal('undercover.game.redeal'),
    roundId: z.string().min(1).nullable(),
  }),
  z.strictObject({ type: z.literal('undercover.round.retry'), roundId: z.string().min(1) }),
  z.strictObject({ type: z.literal('undercover.role.viewed'), roundId: z.string().min(1) }),
  z.strictObject({ type: z.literal('undercover.game.begin'), roundId: z.string().min(1) }),
  z.strictObject({
    type: z.literal('undercover.bots.markAllBotsViewed'),
    roundId: z.string().min(1),
  }),
  z.strictObject({
    type: z.literal('undercover.round.reveal'),
    roundId: z.string().min(1),
    seat: z
      .int()
      .min(0)
      .max(UNDERCOVER_MAX_PLAYERS - 1),
  }),
  z.strictObject({ type: z.literal('undercover.game.abort'), roundId: z.string().min(1) }),
  z.strictObject({ type: z.literal('undercover.game.returnToLobby') }),
]);

export const undercoverPublicCommandSchema: z.ZodType<UndercoverPublicCommand> =
  z.discriminatedUnion('type', undercoverPublicCommandOptions);

const undercoverInternalCommandOptions = definePublicCommandOptions<UndercoverInternalCommand>()([
  z.strictObject({
    type: z.literal('undercover.round.complete'),
    roundId: z.string().min(1),
    wordPair: undercoverWordPairSchema,
  }),
  z.strictObject({
    type: z.literal('undercover.round.failPreparation'),
    roundId: z.string().min(1),
    failureCode: z.enum(['selectionFailed', 'inventoryEmpty', 'inventoryExhausted']),
  }),
]);

export const undercoverInternalCommandSchema: z.ZodType<UndercoverInternalCommand> =
  z.discriminatedUnion('type', undercoverInternalCommandOptions);

export const undercoverEffectSchema: z.ZodType<UndercoverEffect> = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('undercover.word.select'),
    payload: z.strictObject({
      roundId: z.string().min(1),
      category: z.union([z.literal('all'), z.enum(UNDERCOVER_CATEGORIES)]),
      avoidWordPairIds: z.array(z.string().min(1)).readonly(),
      shouldAllowRepeated: z.boolean(),
    }),
  }),
  z.strictObject({
    type: z.literal('undercover.game.completed'),
    payload: gameCompletionPayloadSchema,
  }),
]);
