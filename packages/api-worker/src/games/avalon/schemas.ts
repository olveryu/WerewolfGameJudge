/** Strict external schemas for the Avalon (阿瓦隆) Worker module boundary. */

import type {
  AvalonConfig,
  AvalonPublicCommand,
} from '@game-judge/game-engine/games/avalon/public';
import {
  AVALON_PLAYER_COUNTS,
  AVALON_VOTE_MODES,
} from '@game-judge/game-engine/games/avalon/public';
import { z } from 'zod';

import { ROOM_PUBLIC_COMMAND_SCHEMAS } from '../../platform/room/commandSchemas';

/**
 * Lobby config: 5-10 players select the fixed board (D6-Q2); vote mode (D7) and
 * veto limit (D8) are required fields — the D7/D8 defaults (public / 5) are
 * applied by the client ConfigScreen, mirroring the other five games which all
 * require full configs. Unknown fields are rejected.
 */
const avalonConfigSchema = z.strictObject({
  numberOfPlayers: z.literal(AVALON_PLAYER_COUNTS),
  voteMode: z.enum(AVALON_VOTE_MODES),
  vetoLimit: z.literal([3, 4, 5] as const),
}) satisfies z.ZodType<AvalonConfig>;

export const avalonCreateConfigSchema: z.ZodType<AvalonConfig> = avalonConfigSchema;

function defineAvalonPublicCommandOptions<const TOptions extends readonly z.ZodType[]>(
  options: TOptions &
    ([AvalonPublicCommand] extends [z.output<TOptions[number]>] ? unknown : never) &
    ([z.output<TOptions[number]>] extends [AvalonPublicCommand] ? unknown : never),
): TOptions {
  return options;
}

const avalonPublicCommandOptions = defineAvalonPublicCommandOptions([
  ...ROOM_PUBLIC_COMMAND_SCHEMAS,
  z.strictObject({ type: z.literal('avalon.config.update'), config: avalonConfigSchema }),
  z.strictObject({ type: z.literal('avalon.game.start') }),
  z.strictObject({ type: z.literal('avalon.game.returnToLobby') }),
  z.strictObject({ type: z.literal('avalon.night.confirm') }),
  z.strictObject({ type: z.literal('avalon.audio.ack') }),
  z.strictObject({
    type: z.literal('avalon.team.propose'),
    seats: z.array(z.number().int().nonnegative()).readonly(),
  }),
  z.strictObject({
    type: z.literal('avalon.team.vote'),
    vote: z.enum(['approve', 'reject']),
  }),
  z.strictObject({ type: z.literal('avalon.vote.finish') }),
  z.strictObject({ type: z.literal('avalon.vote.timeout') }),
  z.strictObject({ type: z.literal('avalon.quest.timeout') }),
  z.strictObject({
    type: z.literal('avalon.quest.play'),
    play: z.enum(['success', 'fail']),
  }),
  z.strictObject({ type: z.literal('avalon.quest.finish') }),
  z.strictObject({
    type: z.literal('avalon.lady.check'),
    seat: z.number().int().nonnegative(),
  }),
  z.strictObject({ type: z.literal('avalon.lady.acknowledge') }),
  z.strictObject({
    type: z.literal('avalon.assassin.accuse'),
    seat: z.number().int().nonnegative(),
  }),
  z.strictObject({
    type: z.literal('avalon.assassin.earlyStrike'),
    seat: z.number().int().nonnegative(),
  }),
]);

export const avalonPublicCommandSchema: z.ZodType<AvalonPublicCommand> = z.discriminatedUnion(
  'type',
  avalonPublicCommandOptions,
);
