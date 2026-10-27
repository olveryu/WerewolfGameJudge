/** Strict ordinary Story Relay command and completion schemas; no manuscript logging. */

import {
  STORY_RELAY_CONFIG_SCHEMA,
  STORY_RELAY_TEXT_MAX_LENGTH,
  type StoryRelayCommand,
  type StoryRelayConfig,
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

const commands = definePublicCommandOptions<StoryRelayCommand>()([
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
      'storyrelay.phase.expire',
      'storyrelay.phase.finish',
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

export const storyRelayPublicCommandSchema: z.ZodType<StoryRelayCommand> = z.discriminatedUnion(
  'type',
  commands,
);
export const storyRelayEffectSchema = z.strictObject({
  type: z.literal('storyrelay.game.completed'),
  payload: gameCompletionPayloadSchema,
});
