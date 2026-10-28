/** Strict external schemas for the Pictionary Worker module. */

import type {
  PictionaryConfig,
  PictionaryInternalCommand,
  PictionaryPublicCommand,
} from '@game-judge/game-engine/games/pictionary/public';
import {
  isValidPictionaryText,
  PICTIONARY_CONFIG_SCHEMA,
  PICTIONARY_DRAWING_HEIGHT,
  PICTIONARY_DRAWING_MAX_BYTES,
  PICTIONARY_DRAWING_WIDTH,
} from '@game-judge/game-engine/games/pictionary/public';
import { z } from 'zod';

import { gameCompletionPayloadSchema } from '../../features/account/settleGameRewards';
import { definePublicCommandOptions } from '../../platform/room/commandOptions';
import { ROOM_PUBLIC_COMMAND_SCHEMAS } from '../../platform/room/commandSchemas';
import { configSchemaToZod } from '../../platform/room/configSchemaZod';

const pictionaryConfigSchema: z.ZodType<PictionaryConfig> =
  configSchemaToZod(PICTIONARY_CONFIG_SCHEMA);

export const pictionaryCreateConfigSchema: z.ZodType<PictionaryConfig> = pictionaryConfigSchema;

const taskIdentityShape = {
  roundId: z.string().min(1),
  stepIndex: z.int().nonnegative(),
  chainId: z.string().min(1),
};
const phaseIdentityShape = {
  roundId: z.string().min(1).nullable(),
  phaseRevision: z.int().nonnegative(),
};

const publicCommandOptions = definePublicCommandOptions<PictionaryPublicCommand>()([
  ...ROOM_PUBLIC_COMMAND_SCHEMAS,
  z.strictObject({ type: z.literal('pictionary.config.update'), config: pictionaryConfigSchema }),
  z.strictObject({ type: z.literal('pictionary.game.begin') }),
  z.strictObject({
    type: z.literal('pictionary.task.ready.set'),
    ...taskIdentityShape,
    isReady: z.boolean(),
  }),
  z.strictObject({ type: z.literal('pictionary.task.empty.submit'), ...taskIdentityShape }),
  z.strictObject({
    type: z.literal('pictionary.text.submit'),
    ...taskIdentityShape,
    text: z.string().refine(isValidPictionaryText),
  }),
  z.strictObject({ type: z.literal('pictionary.drawing.reserve'), ...taskIdentityShape }),
  z.strictObject({ type: z.literal('pictionary.game.abort'), ...phaseIdentityShape }),
  z.strictObject({
    type: z.literal('pictionary.phase.expire'),
    phaseRevision: z.int().nonnegative(),
  }),
  z.strictObject({ type: z.literal('pictionary.gallery.pause'), ...phaseIdentityShape }),
  z.strictObject({ type: z.literal('pictionary.gallery.resume'), ...phaseIdentityShape }),
  z.strictObject({ type: z.literal('pictionary.gallery.advance'), ...phaseIdentityShape }),
  z.strictObject({ type: z.literal('pictionary.gallery.rewind'), ...phaseIdentityShape }),
  z.strictObject({ type: z.literal('pictionary.gallery.finish'), ...phaseIdentityShape }),
  z.strictObject({ type: z.literal('pictionary.game.next'), ...phaseIdentityShape }),
  z.strictObject({ type: z.literal('pictionary.game.returnToLobby'), ...phaseIdentityShape }),
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
  type: z.literal('pictionary.game.completed'),
  payload: gameCompletionPayloadSchema,
});
