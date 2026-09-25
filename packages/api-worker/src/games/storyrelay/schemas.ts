/** Strict ordinary Story Relay command and completion schemas; no manuscript logging. */

import {
  STORY_RELAY_GALLERY_DURATIONS,
  STORY_RELAY_MAX_PLAYERS,
  STORY_RELAY_MIN_PLAYERS,
  STORY_RELAY_TEXT_MAX_LENGTH,
  STORY_RELAY_TRANSITION_DURATIONS,
  STORY_RELAY_WRITING_DURATIONS,
  type StoryRelayCommand,
  type StoryRelayConfig,
} from '@game-judge/game-engine/games/storyrelay/public';
import { z } from 'zod';

import { gameCompletionPayloadSchema } from '../../features/account/settleGameRewards';
import { ROOM_PUBLIC_COMMAND_SCHEMAS } from '../../platform/room/commandSchemas';

export const storyRelayCreateConfigSchema = z.strictObject({
  numberOfPlayers: z.int().min(STORY_RELAY_MIN_PLAYERS).max(STORY_RELAY_MAX_PLAYERS),
  writingDurationSeconds: z.literal(STORY_RELAY_WRITING_DURATIONS),
  transitionDurationSeconds: z.literal(STORY_RELAY_TRANSITION_DURATIONS),
  galleryItemDurationSeconds: z.literal(STORY_RELAY_GALLERY_DURATIONS),
}) satisfies z.ZodType<StoryRelayConfig>;

const roundTask = { roundId: z.string().min(1), stepIndex: z.int().nonnegative() };
const task = { ...roundTask, chainId: z.string().min(1) };
const revision = { phaseRevision: z.int().nonnegative() };

function defineCommands<const TOptions extends readonly z.ZodType[]>(
  options: TOptions &
    ([StoryRelayCommand] extends [z.output<TOptions[number]>] ? unknown : never) &
    ([z.output<TOptions[number]>] extends [StoryRelayCommand] ? unknown : never),
): TOptions {
  return options;
}

const commands = defineCommands([
  ...ROOM_PUBLIC_COMMAND_SCHEMAS,
  z.strictObject({
    type: z.literal('storyrelay.config.update'),
    config: storyRelayCreateConfigSchema,
  }),
  z.strictObject({
    type: z.literal([
      'storyrelay.bots.clear',
      'storyrelay.round.start',
      'storyrelay.round.next',
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
    type: z.literal('storyrelay.task.skip'),
    ...task,
    ...revision,
    seat: z.int().nonnegative(),
  }),
  z.strictObject({ type: z.literal('storyrelay.bots.skip'), ...roundTask, ...revision }),
  z.strictObject({
    type: z.literal([
      'storyrelay.phase.expire',
      'storyrelay.phase.finish',
      'storyrelay.round.abort',
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
  type: z.literal('storyrelay.round.completed'),
  payload: gameCompletionPayloadSchema,
});
