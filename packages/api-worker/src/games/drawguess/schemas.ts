/** Strict external schemas for the DrawGuess (经典你画我猜) Worker module. */

import type {
  DrawGuessConfig,
  DrawGuessInternalCommand,
  DrawGuessPublicCommand,
  DrawGuessStroke,
  DrawGuessWordChoice,
} from '@game-judge/game-engine/games/drawguess/public';
import {
  DRAWGUESS_DRAWING_DURATION_SECONDS,
  DRAWGUESS_HINT_REVEAL_INTERVAL_SECONDS,
  DRAWGUESS_MAX_PLAYERS,
  DRAWGUESS_MIN_PLAYERS,
  DRAWGUESS_ROUND_END_SECONDS,
  DRAWGUESS_ROUNDS_PER_DRAWER,
  DRAWGUESS_WORD_SELECT_SECONDS,
  isValidGuessText,
} from '@game-judge/game-engine/games/drawguess/public';
import { z } from 'zod';

import { ROOM_PUBLIC_COMMAND_SCHEMAS } from '../../platform/room/commandSchemas';

const drawGuessConfigSchema = z.strictObject({
  numberOfPlayers: z.int().min(DRAWGUESS_MIN_PLAYERS).max(DRAWGUESS_MAX_PLAYERS),
  drawingDurationSeconds: z.literal(DRAWGUESS_DRAWING_DURATION_SECONDS),
  roundsPerDrawer: z.literal(DRAWGUESS_ROUNDS_PER_DRAWER),
  wordSelectSeconds: z.literal(DRAWGUESS_WORD_SELECT_SECONDS),
  roundEndSeconds: z.literal(DRAWGUESS_ROUND_END_SECONDS),
  hintRevealIntervalSeconds: z.literal(DRAWGUESS_HINT_REVEAL_INTERVAL_SECONDS),
}) satisfies z.ZodType<DrawGuessConfig>;

export const drawGuessCreateConfigSchema: z.ZodType<DrawGuessConfig> = drawGuessConfigSchema;

function defineDrawGuessPublicCommandOptions<const TOptions extends readonly z.ZodType[]>(
  options: TOptions &
    ([DrawGuessPublicCommand] extends [z.output<TOptions[number]>] ? unknown : never) &
    ([z.output<TOptions[number]>] extends [DrawGuessPublicCommand] ? unknown : never),
): TOptions {
  return options;
}

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

const publicCommandOptions = defineDrawGuessPublicCommandOptions([
  ...ROOM_PUBLIC_COMMAND_SCHEMAS,
  z.strictObject({ type: z.literal('drawguess.config.update'), config: drawGuessConfigSchema }),
  z.strictObject({ type: z.literal('drawguess.round.start') }),
  z.strictObject({ type: z.literal('drawguess.game.returnToLobby') }),
  z.strictObject({ type: z.literal('drawguess.drawing.reserve') }),
  z.strictObject({ type: z.literal('drawguess.round.finish') }),
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

function defineDrawGuessInternalCommandOptions<const TOptions extends readonly z.ZodType[]>(
  options: TOptions &
    ([DrawGuessInternalCommand] extends [z.output<TOptions[number]>] ? unknown : never) &
    ([z.output<TOptions[number]>] extends [DrawGuessInternalCommand] ? unknown : never),
): TOptions {
  return options;
}

const internalCommandOptions = defineDrawGuessInternalCommandOptions([
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
