// Strict external schemas for the Fashion Shadow Worker module.

import type {
  FashionConfig,
  FashionInternalCommand,
  FashionPublicCommand,
} from '@game-judge/game-engine/games/fashion-shadow/public';
import { FASHION_PLAYER_COUNT } from '@game-judge/game-engine/games/fashion-shadow/public';
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

const publicCommandOptions = defineFashionPublicCommandOptions([
  ...ROOM_PUBLIC_COMMAND_SCHEMAS,
  z.strictObject({ type: z.literal('fashion.game.start') }),
  z.strictObject({ type: z.literal('fashion.role.confirm') }),
  z.strictObject({ type: z.literal('fashion.event.reveal') }),
  z.strictObject({ type: z.literal('fashion.crossExam.start') }),
  z.strictObject({ type: z.literal('fashion.crossExam.finish') }),
  z.strictObject({ type: z.literal('fashion.discussion.speak') }),
  z.strictObject({ type: z.literal('fashion.discussion.finish') }),
  z.strictObject({
    type: z.literal('fashion.vote.cast'),
    vote: z.enum(['approve', 'reject']),
  }),
  z.strictObject({ type: z.literal('fashion.vote.finish') }),
]);

export const fashionPublicCommandSchema: z.ZodType<FashionPublicCommand> = z.discriminatedUnion(
  'type',
  publicCommandOptions,
);

export const fashionInternalCommandSchema: z.ZodType<FashionInternalCommand> = z.never();
