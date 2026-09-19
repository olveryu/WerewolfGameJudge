/** Strict external schemas for the Pictionary Worker module. */

import type {
  PictionaryConfig,
  PictionaryInternalCommand,
  PictionaryPublicCommand,
} from '@game-judge/game-engine/games/pictionary/public';
import {
  isValidPictionaryText,
  PICTIONARY_DRAWING_DURATIONS,
  PICTIONARY_DRAWING_HEIGHT,
  PICTIONARY_DRAWING_MAX_BYTES,
  PICTIONARY_DRAWING_WIDTH,
  PICTIONARY_GALLERY_ITEM_DURATIONS,
  PICTIONARY_GUESS_DURATIONS,
  PICTIONARY_MAX_PLAYERS,
  PICTIONARY_MIN_PLAYERS,
  PICTIONARY_TRANSITION_DURATIONS,
} from '@game-judge/game-engine/games/pictionary/public';
import { z } from 'zod';

import { gameCompletionPayloadSchema } from '../../features/account/settleGameRewards';
import { ROOM_PUBLIC_COMMAND_SCHEMAS } from '../../platform/room/commandSchemas';

const pictionaryConfigSchema = z.strictObject({
  numberOfPlayers: z.int().min(PICTIONARY_MIN_PLAYERS).max(PICTIONARY_MAX_PLAYERS),
  drawingDurationSeconds: z.literal(PICTIONARY_DRAWING_DURATIONS),
  guessDurationSeconds: z.literal(PICTIONARY_GUESS_DURATIONS),
  transitionDurationSeconds: z.literal(PICTIONARY_TRANSITION_DURATIONS),
  galleryItemDurationSeconds: z.literal(PICTIONARY_GALLERY_ITEM_DURATIONS),
}) satisfies z.ZodType<PictionaryConfig>;

export const pictionaryCreateConfigSchema: z.ZodType<PictionaryConfig> = pictionaryConfigSchema;

function definePictionaryPublicCommandOptions<const TOptions extends readonly z.ZodType[]>(
  options: TOptions &
    ([PictionaryPublicCommand] extends [z.output<TOptions[number]>] ? unknown : never) &
    ([z.output<TOptions[number]>] extends [PictionaryPublicCommand] ? unknown : never),
): TOptions {
  return options;
}

const publicCommandOptions = definePictionaryPublicCommandOptions([
  ...ROOM_PUBLIC_COMMAND_SCHEMAS,
  z.strictObject({ type: z.literal('pictionary.config.update'), config: pictionaryConfigSchema }),
  z.strictObject({ type: z.literal('pictionary.round.start') }),
  z.strictObject({ type: z.literal('pictionary.task.ready.set'), isReady: z.boolean() }),
  z.strictObject({ type: z.literal('pictionary.task.empty.submit') }),
  z.strictObject({
    type: z.literal('pictionary.text.submit'),
    text: z.string().refine(isValidPictionaryText),
  }),
  z.strictObject({ type: z.literal('pictionary.drawing.reserve') }),
  z.strictObject({
    type: z.literal('pictionary.phase.expire'),
    phaseRevision: z.int().nonnegative(),
  }),
  z.strictObject({ type: z.literal('pictionary.phase.finish') }),
  z.strictObject({ type: z.literal('pictionary.gallery.pause') }),
  z.strictObject({ type: z.literal('pictionary.gallery.resume') }),
  z.strictObject({ type: z.literal('pictionary.gallery.advance') }),
  z.strictObject({ type: z.literal('pictionary.gallery.rewind') }),
  z.strictObject({ type: z.literal('pictionary.round.next') }),
  z.strictObject({ type: z.literal('pictionary.game.returnToLobby') }),
]);

export const pictionaryPublicCommandSchema: z.ZodType<PictionaryPublicCommand> =
  z.discriminatedUnion('type', publicCommandOptions);

const pictionaryMediaSchema = z.strictObject({
  objectKey: z.string().min(1),
  contentType: z.literal('image/png'),
  width: z.literal(PICTIONARY_DRAWING_WIDTH),
  height: z.literal(PICTIONARY_DRAWING_HEIGHT),
  byteLength: z.int().positive().max(PICTIONARY_DRAWING_MAX_BYTES),
  sha256: z.string().min(1),
});

export const pictionaryInternalCommandSchema: z.ZodType<PictionaryInternalCommand> = z.strictObject(
  {
    type: z.literal('pictionary.drawing.commit'),
    submissionId: z.string().min(1),
    media: pictionaryMediaSchema,
  },
);

export const pictionaryEffectSchema = z.strictObject({
  type: z.literal('pictionary.round.completed'),
  payload: gameCompletionPayloadSchema,
});
