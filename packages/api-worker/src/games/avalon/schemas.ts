/** Strict external schemas for the Avalon (阿瓦隆) Worker module boundary. */

import type {
  AvalonConfig,
  AvalonInternalCommand,
  AvalonPublicCommand,
} from '@game-judge/game-engine/games/avalon/public';
import { AVALON_CONFIG_SCHEMA } from '@game-judge/game-engine/games/avalon/public';
import { z } from 'zod';

import { definePublicCommandOptions } from '../../platform/room/commandOptions';
import { ROOM_PUBLIC_COMMAND_SCHEMAS } from '../../platform/room/commandSchemas';
import { configSchemaToZod } from '../../platform/room/configSchemaZod';

/** Lobby config rules (board by player count, vote mode, veto limit) live in AVALON_CONFIG_SCHEMA. */
const avalonConfigSchema: z.ZodType<AvalonConfig> = configSchemaToZod(AVALON_CONFIG_SCHEMA);

export const avalonCreateConfigSchema: z.ZodType<AvalonConfig> = avalonConfigSchema;

const avalonPublicCommandOptions = definePublicCommandOptions<AvalonPublicCommand>()([
  ...ROOM_PUBLIC_COMMAND_SCHEMAS,
  z.strictObject({ type: z.literal('avalon.config.update'), config: avalonConfigSchema }),
  z.strictObject({ type: z.literal('avalon.roles.assign') }),
  z.strictObject({ type: z.literal('avalon.game.begin') }),
  z.strictObject({ type: z.literal('avalon.game.abort') }),
  z.strictObject({ type: z.literal('avalon.game.returnToLobby') }),
  z.strictObject({ type: z.literal('avalon.night.confirm') }),
  z.strictObject({ type: z.literal('avalon.role.viewed') }),
  z.strictObject({ type: z.literal('avalon.bots.markAllBotsViewed') }),
  z.strictObject({ type: z.literal('avalon.bots.markAllBotsGroupConfirmed') }),
  z.strictObject({
    type: z.literal('avalon.audio.ack'),
    audioBatchId: z.number().int().nonnegative(),
  }),
  z.strictObject({
    type: z.literal('avalon.team.preselect'),
    seats: z.array(z.number().int().nonnegative()).readonly(),
  }),
  z.strictObject({
    type: z.literal('avalon.team.propose'),
    seats: z.array(z.number().int().nonnegative()).readonly(),
  }),
  z.strictObject({
    type: z.literal('avalon.team.vote'),
    vote: z.enum(['approve', 'reject']),
  }),
  z.strictObject({ type: z.literal('avalon.phase.expire') }),
  z.strictObject({
    type: z.literal('avalon.quest.play'),
    play: z.enum(['success', 'fail']),
  }),
  z.strictObject({ type: z.literal('avalon.lady.check'), seat: z.number().int().nonnegative() }),
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

/**
 * Worker-originated commands: dispatched only by the settle effect
 * handler as the system actor when a scheduled countdown effect is due.
 */
export const avalonInternalCommandSchema: z.ZodType<AvalonInternalCommand> = z.discriminatedUnion(
  'type',
  [z.strictObject({ type: z.literal('avalon.phase.settleExpired') })],
);
