// Strict external schemas for the Fashion Shadow Worker module.

import type {
  FashionConfig,
  FashionInternalCommand,
  FashionPublicCommand,
} from '@game-judge/game-engine/games/fashion-shadow/public';
import {
  FASHION_CONTRACT_ID_MAX_LENGTH,
  FASHION_CROSS_EXAM_STATEMENT_MAX_LENGTH,
  FASHION_DISCUSSION_MESSAGE_MAX_LENGTH,
  FASHION_EVIDENCE_IDS,
  FASHION_HEARING_STATEMENT_MAX_LENGTH,
  FASHION_PLAYER_COUNT,
  FASHION_ROLE_IDS,
} from '@game-judge/game-engine/games/fashion-shadow/public';
import { z } from 'zod';

import { ROOM_PUBLIC_COMMAND_SCHEMAS } from '../../platform/room/commandSchemas';

export const fashionCreateConfigSchema: z.ZodType<FashionConfig> = z.strictObject({
  numberOfPlayers: z.literal(FASHION_PLAYER_COUNT),
});

function defineFashionPublicCommandOptions<const TOptions extends readonly z.ZodType[]>(
  options: TOptions &
    ([FashionPublicCommand] extends [z.output<TOptions[number]>] ? unknown : never) &
    ([z.output<TOptions[number]>] extends [FashionPublicCommand] ? unknown : never),
): TOptions {
  return options;
}

const fashionSeatSchema = z
  .number()
  .int()
  .min(0)
  .max(FASHION_PLAYER_COUNT - 1);

const publicCommandOptions = defineFashionPublicCommandOptions([
  ...ROOM_PUBLIC_COMMAND_SCHEMAS,
  z.strictObject({ type: z.literal('fashion.game.start') }),
  z.strictObject({ type: z.literal('fashion.game.restart') }),
  z.strictObject({ type: z.literal('fashion.role.confirm') }),
  z.strictObject({ type: z.literal('fashion.event.reveal') }),
  z.strictObject({ type: z.literal('fashion.crossExam.start') }),
  z.strictObject({ type: z.literal('fashion.secret.revealSelf') }),
  z.strictObject({
    type: z.literal('fashion.crossExam.statement'),
    message: z.string().trim().min(1).max(FASHION_CROSS_EXAM_STATEMENT_MAX_LENGTH),
    evidenceId: z.enum(FASHION_EVIDENCE_IDS).optional(),
  }),
  z.strictObject({ type: z.literal('fashion.crossExam.award'), seat: fashionSeatSchema }),
  z.strictObject({ type: z.literal('fashion.crossExam.finish') }),
  z.strictObject({
    type: z.literal('fashion.discussion.speak'),
    message: z.string().trim().min(1).max(FASHION_DISCUSSION_MESSAGE_MAX_LENGTH),
  }),
  z.strictObject({ type: z.literal('fashion.discussion.finish') }),
  z.strictObject({
    type: z.literal('fashion.vote.cast'),
    vote: z.enum(['approve', 'reject']),
  }),
  z.strictObject({ type: z.literal('fashion.vote.finish') }),
  z.strictObject({ type: z.literal('fashion.round.advance') }),
  z.strictObject({ type: z.literal('fashion.hearing.start') }),
  z.strictObject({
    type: z.literal('fashion.hearing.statement'),
    message: z.string().trim().min(1).max(FASHION_HEARING_STATEMENT_MAX_LENGTH),
    evidenceId: z.enum(FASHION_EVIDENCE_IDS),
  }),
  z.strictObject({ type: z.literal('fashion.hearing.vote'), targetSeat: fashionSeatSchema }),
  z.strictObject({ type: z.literal('fashion.hearing.finish') }),
  z.strictObject({
    type: z.literal('fashion.contract.propose'),
    contractId: z.string().min(1).max(FASHION_CONTRACT_ID_MAX_LENGTH),
    buyerSeat: fashionSeatSchema,
    promise: z.enum(['compensation', 'protection', 'legalImmunity']),
  }),
  z.strictObject({
    type: z.literal('fashion.contract.accept'),
    contractId: z.string().min(1).max(FASHION_CONTRACT_ID_MAX_LENGTH),
  }),
  z.strictObject({
    type: z.literal('fashion.contract.fulfill'),
    contractId: z.string().min(1).max(FASHION_CONTRACT_ID_MAX_LENGTH),
  }),
  z.strictObject({
    type: z.literal('fashion.identityGuess.cast'),
    targetSeat: fashionSeatSchema,
    guessedRoleId: z.enum(FASHION_ROLE_IDS),
  }),
]);

export const fashionPublicCommandSchema: z.ZodType<FashionPublicCommand> = z.discriminatedUnion(
  'type',
  publicCommandOptions,
);

export const fashionInternalCommandSchema: z.ZodType<FashionInternalCommand> = z.never();
