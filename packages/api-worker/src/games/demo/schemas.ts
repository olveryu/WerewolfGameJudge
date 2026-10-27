/** Strict external schemas for the Demo Worker module boundary. */

import {
  DEMO_CONFIG_SCHEMA,
  type DemoConfig,
  type DemoInternalCommand,
  type DemoPublicCommand,
} from '@game-judge/game-engine/games/demo/public';
import { z } from 'zod';

import { definePublicCommandOptions } from '../../platform/room/commandOptions';
import { ROOM_PUBLIC_COMMAND_SCHEMAS } from '../../platform/room/commandSchemas';
import { configSchemaToZod } from '../../platform/room/configSchemaZod';

const demoConfigSchema: z.ZodType<DemoConfig> = configSchemaToZod(DEMO_CONFIG_SCHEMA);

export const demoCreateConfigSchema: z.ZodType<DemoConfig> = demoConfigSchema;

const demoPublicCommandOptions = definePublicCommandOptions<DemoPublicCommand>()([
  ...ROOM_PUBLIC_COMMAND_SCHEMAS,
  z.strictObject({
    type: z.literal('demo.config.update'),
    config: demoConfigSchema,
  }),
  z.strictObject({ type: z.literal('demo.roles.assign') }),
  z.strictObject({ type: z.literal('demo.game.begin') }),
  z.strictObject({ type: z.literal('demo.role.viewed') }),
  z.strictObject({ type: z.literal('demo.bots.markAllBotsViewed') }),
  z.strictObject({ type: z.literal('demo.game.returnToLobby') }),
  z.strictObject({ type: z.literal('demo.gameplay.example') }),
]);

export const demoPublicCommandSchema: z.ZodType<DemoPublicCommand> = z.discriminatedUnion(
  'type',
  demoPublicCommandOptions,
);

/**
 * Worker-originated commands: dispatched only by the settle effect
 * handler as the system actor when a scheduled deadline effect is due.
 */
export const demoInternalCommandSchema: z.ZodType<DemoInternalCommand> = z.discriminatedUnion(
  'type',
  [z.strictObject({ type: z.literal('demo.phase.settleExpired') })],
);
