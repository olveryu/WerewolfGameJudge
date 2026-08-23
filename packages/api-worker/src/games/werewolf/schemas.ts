/** Strict external schemas for the Werewolf Worker module. */

import type {
  WerewolfConfig,
  WerewolfInternalCommand,
  WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import {
  isValidRoleId,
  isValidSchemaId,
  type RoleId,
  type SchemaId,
} from '@game-judge/game-engine/games/werewolf/public';
import { validateTemplateRoles } from '@game-judge/game-engine/games/werewolf/public';
import { z } from 'zod';

import { ROOM_PUBLIC_COMMAND_SCHEMAS } from '../../platform/room/commandSchemas';

const roleIdSchema = z.custom<RoleId>(
  (value): value is RoleId => typeof value === 'string' && isValidRoleId(value),
);

const schemaIdSchema = z.custom<SchemaId>(
  (value): value is SchemaId => typeof value === 'string' && isValidSchemaId(value),
);

const expectedStepSchema = z.strictObject({
  currentStepId: schemaIdSchema,
  currentStepIndex: z.number().int().nonnegative(),
  roleRevealRandomNonce: z.string().min(1).max(128).nullable(),
});

const ruleOverridesSchema = z.strictObject({
  isPlagueMode: z.boolean().optional(),
  witchCanSelfHeal: z.boolean().optional(),
});

export const werewolfCreateConfigSchema: z.ZodType<WerewolfConfig> = z
  .strictObject({
    templateRoles: z.array(roleIdSchema).readonly(),
    rules: ruleOverridesSchema.optional(),
  })
  .superRefine((config, context) => {
    const reason = validateTemplateRoles(config.templateRoles);
    if (reason !== null) {
      context.addIssue({ code: 'custom', path: ['templateRoles'], message: reason });
    }
  });

function defineWerewolfPublicCommandOptions<const TOptions extends readonly z.ZodType[]>(
  options: TOptions &
    ([WerewolfPublicCommand] extends [z.output<TOptions[number]>] ? unknown : never) &
    ([z.output<TOptions[number]>] extends [WerewolfPublicCommand] ? unknown : never),
): TOptions {
  return options;
}

const publicCommandOptions = defineWerewolfPublicCommandOptions([
  ...ROOM_PUBLIC_COMMAND_SCHEMAS,
  z.strictObject({ type: z.literal('werewolf.roles.assign') }),
  z.strictObject({ type: z.literal('werewolf.game.restart') }),
  z.strictObject({ type: z.literal('werewolf.bots.markRolesViewed') }),
  z.strictObject({
    type: z.literal('werewolf.action.submit'),
    input: z.discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('target'),
        target: z.number().int().nonnegative().nullable(),
      }),
      z.strictObject({
        kind: z.literal('multiTarget'),
        targets: z.array(z.number().int().nonnegative()).readonly(),
      }),
      z.strictObject({ kind: z.literal('confirm') }),
      z.strictObject({
        kind: z.literal('witch'),
        saveTarget: z.number().int().nonnegative().nullable(),
        poisonTarget: z.number().int().nonnegative().nullable(),
      }),
      z.strictObject({ kind: z.literal('card'), cardIndex: z.number().int().nonnegative() }),
      z.strictObject({ kind: z.literal('skip') }),
    ]),
    expectedStep: expectedStepSchema.optional(),
  }),
  z.strictObject({ type: z.literal('werewolf.role.view') }),
  z.strictObject({
    type: z.literal('werewolf.config.update'),
    templateRoles: z.array(roleIdSchema).readonly(),
    rules: ruleOverridesSchema.optional(),
  }),
  z.strictObject({
    type: z.literal('werewolf.review.share'),
    allowedSeats: z.array(z.number().int().nonnegative()).readonly(),
  }),
  z.strictObject({
    type: z.literal('werewolf.board.nominate'),
    displayName: z.string().min(1),
    roles: z.array(roleIdSchema).readonly(),
  }),
  z.strictObject({
    type: z.literal('werewolf.board.upvote'),
    targetUserId: z.string().min(1),
  }),
  z.strictObject({ type: z.literal('werewolf.board.withdraw') }),
  z.strictObject({ type: z.literal('werewolf.night.start') }),
  z.strictObject({ type: z.literal('werewolf.audio.ack') }),
  z.strictObject({ type: z.literal('werewolf.progress.request') }),
  z.strictObject({ type: z.literal('werewolf.reveal.ack') }),
  z.strictObject({ type: z.literal('werewolf.wolfRobot.ackHunterStatus') }),
  z.strictObject({ type: z.literal('werewolf.groupConfirm.ack') }),
  z.strictObject({ type: z.literal('werewolf.groupConfirm.ackBots') }),
]);

export const werewolfPublicCommandSchema: z.ZodType<WerewolfPublicCommand> = z.discriminatedUnion(
  'type',
  publicCommandOptions,
);

export const werewolfInternalCommandSchema: z.ZodType<WerewolfInternalCommand> = z.strictObject({
  type: z.literal('werewolf.growth.applyRosterLevels'),
  levels: z.record(z.string().min(1), z.number().int().nonnegative()),
});
