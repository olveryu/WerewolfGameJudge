/** Strict ordinary Story Relay command and completion schemas; no manuscript logging. */

import {
  STORY_RELAY_CONFIG_SCHEMA,
  STORY_RELAY_TEXT_MAX_LENGTH,
  type StoryRelayConfig,
  type StoryRelayEffect,
  type StoryRelayInternalCommand,
  type StoryRelayPublicCommand,
} from '@game-judge/game-engine/games/storyrelay/public';
import { z } from 'zod';

import { gameCompletionPayloadSchema } from '../../features/account/settleGameRewards';
import { definePublicCommandOptions } from '../../platform/room/commandOptions';
import { ROOM_PUBLIC_COMMAND_SCHEMAS } from '../../platform/room/commandSchemas';
import { configSchemaToZod } from '../../platform/room/configSchemaZod';

export const storyRelayCreateConfigSchema: z.ZodType<StoryRelayConfig> =
  configSchemaToZod(STORY_RELAY_CONFIG_SCHEMA);

const roundTask = { roundId: z.string().min(1), stepIndex: z.int().nonnegative() };
const task = { ...roundTask, chainId: z.string().min(1) };
const revision = { phaseRevision: z.int().nonnegative() };

const commands = definePublicCommandOptions<StoryRelayPublicCommand>()([
  ...ROOM_PUBLIC_COMMAND_SCHEMAS,
  z.strictObject({
    type: z.literal('storyrelay.config.update'),
    config: storyRelayCreateConfigSchema,
  }),
  z.strictObject({
    type: z.literal([
      'storyrelay.game.begin',
      'storyrelay.game.next',
      'storyrelay.game.returnToLobby',
    ]),
  }),
  z.strictObject({ type: z.literal('storyrelay.task.ready.set'), ...task, isReady: z.boolean() }),
  z.strictObject({ type: z.literal('storyrelay.task.empty.submit'), ...task }),
  z.strictObject({
    type: z.literal('storyrelay.text.submit'),
    ...task,
    text: z
      .string()
      .max(STORY_RELAY_TEXT_MAX_LENGTH)
      .refine((text) => text.trim().length > 0),
  }),
  z.strictObject({
    type: z.literal([
      'storyrelay.game.abort',
      'storyrelay.gallery.pause',
      'storyrelay.gallery.resume',
      'storyrelay.gallery.advance',
      'storyrelay.gallery.rewind',
      'storyrelay.gallery.finish',
    ]),
    ...revision,
  }),
]);

export const storyRelayPublicCommandSchema: z.ZodType<StoryRelayPublicCommand> =
  z.discriminatedUnion('type', commands);

/**
 * Worker-originated commands: dispatched only by the settle effect
 * handler as the system actor when a scheduled deadline effect is due.
 */
export const storyRelayInternalCommandSchema: z.ZodType<StoryRelayInternalCommand> =
  z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('storyrelay.phase.settleExpired') }),
  ]);

const gameCompletedEffectSchema = z.strictObject({
  type: z.literal('storyrelay.game.completed'),
  payload: gameCompletionPayloadSchema,
});

const settleDueEffectSchema = z.strictObject({
  type: z.literal('storyrelay.settle.due'),
  payload: z.strictObject({
    roundId: z.string().min(1),
    phaseRevision: z.int().nonnegative(),
    stepIndex: z.int().nonnegative(),
    deadlineAt: z.int().nonnegative(),
  }),
});

export const storyRelayEffectSchema: z.ZodType<StoryRelayEffect> = z.union([
  gameCompletedEffectSchema,
  settleDueEffectSchema,
]);
