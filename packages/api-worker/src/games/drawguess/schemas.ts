/** Strict external schemas for the DrawGuess (经典你画我猜) Worker module. */

import type {
  DrawGuessConfig,
  DrawGuessInternalCommand,
  DrawGuessPublicCommand,
  DrawGuessStroke,
  DrawGuessWordChoice,
} from '@game-judge/game-engine/games/drawguess/public';
import {
  DRAWGUESS_CONFIG_SCHEMA,
  isValidGuessText,
} from '@game-judge/game-engine/games/drawguess/public';
import { z } from 'zod';

import { definePublicCommandOptions } from '../../platform/room/commandOptions';
import { ROOM_PUBLIC_COMMAND_SCHEMAS } from '../../platform/room/commandSchemas';
import { configSchemaToZod } from '../../platform/room/configSchemaZod';

const drawGuessConfigSchema: z.ZodType<DrawGuessConfig> =
  configSchemaToZod(DRAWGUESS_CONFIG_SCHEMA);

export const drawGuessCreateConfigSchema: z.ZodType<DrawGuessConfig> = drawGuessConfigSchema;

const strokePointSchema = z.strictObject({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

const strokeBaseShape = {
  id: z.string().min(1),
  color: z.string().regex(/^#[\da-f]{6}$/i),
  width: z.int(),
  authorSeat: z.int().nonnegative(),
};

const drawGuessStrokeSchema: z.ZodType<DrawGuessStroke> = z.discriminatedUnion('kind', [
  z.strictObject({
    ...strokeBaseShape,
    kind: z.literal('brush'),
    points: z.array(strokePointSchema).readonly(),
  }),
  z.strictObject({
    ...strokeBaseShape,
    kind: z.literal('eraser'),
    points: z.array(strokePointSchema).readonly(),
  }),
  z.strictObject({
    ...strokeBaseShape,
    kind: z.literal('line'),
    start: strokePointSchema,
    end: strokePointSchema,
  }),
  z.strictObject({
    ...strokeBaseShape,
    kind: z.literal('rectangle'),
    start: strokePointSchema,
    end: strokePointSchema,
  }),
  z.strictObject({
    ...strokeBaseShape,
    kind: z.literal('ellipse'),
    start: strokePointSchema,
    end: strokePointSchema,
  }),
  z.strictObject({
    ...strokeBaseShape,
    kind: z.literal('fill'),
    rectangles: z
      .array(
        z.strictObject({
          x: z.int(),
          y: z.int(),
          width: z.int(),
          height: z.int(),
        }),
      )
      .readonly(),
  }),
]);

const phaseIdentityShape = {
  phaseRevision: z.int().nonnegative(),
  turnIndex: z.int().nonnegative(),
};

const publicCommandOptions = definePublicCommandOptions<DrawGuessPublicCommand>()([
  ...ROOM_PUBLIC_COMMAND_SCHEMAS,
  z.strictObject({ type: z.literal('drawguess.config.update'), config: drawGuessConfigSchema }),
  z.strictObject({ type: z.literal('drawguess.game.begin') }),
  z.strictObject({
    type: z.literal('drawguess.game.abort'),
    gameSequence: z.int().nonnegative(),
  }),
  z.strictObject({ type: z.literal('drawguess.game.returnToLobby') }),
  z.strictObject({ type: z.literal('drawguess.drawing.reserve') }),
  z.strictObject({
    type: z.literal('drawguess.word.choose'),
    ...phaseIdentityShape,
    word: z.string().min(1),
  }),
  z.strictObject({
    type: z.literal('drawguess.stroke.add'),
    ...phaseIdentityShape,
    stroke: drawGuessStrokeSchema,
  }),
  z.strictObject({
    type: z.literal(['drawguess.stroke.undo', 'drawguess.stroke.clear'] as const),
    ...phaseIdentityShape,
  }),
  z.strictObject({
    type: z.literal('drawguess.guess.submit'),
    ...phaseIdentityShape,
    text: z.string().refine(isValidGuessText),
  }),
  z.strictObject({ type: z.literal('drawguess.phase.expire'), ...phaseIdentityShape }),
]);

export const drawGuessPublicCommandSchema: z.ZodType<DrawGuessPublicCommand> = z.discriminatedUnion(
  'type',
  publicCommandOptions,
);

const drawGuessWordChoiceSchema = z.strictObject({
  word: z.string().min(1),
  pinyinInitials: z.string().min(1),
}) satisfies z.ZodType<DrawGuessWordChoice>;

const internalCommandOptions = definePublicCommandOptions<DrawGuessInternalCommand>()([
  z.strictObject({
    type: z.literal('drawguess.words.dealt'),
    turnIndex: z.int().nonnegative(),
    choices: z.array(drawGuessWordChoiceSchema).min(1).readonly(),
  }),
  z.strictObject({
    type: z.literal('drawguess.drawing.committed'),
    turnIndex: z.int().nonnegative(),
    submissionId: z.string().min(1),
    objectKey: z.string().min(1),
    byteLength: z.int().positive(),
    sha256: z.string().min(1),
  }),
]);

export const drawGuessInternalCommandSchema: z.ZodType<DrawGuessInternalCommand> =
  z.discriminatedUnion('type', internalCommandOptions);
