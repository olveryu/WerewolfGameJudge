/** Strict external schemas for the Werewolf Worker module. */

import type {
  WerewolfConfig,
  WerewolfInternalCommand,
  WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import {
  isValidRoleId,
  isWerewolfStepId,
  type RoleId,
} from '@game-judge/game-engine/games/werewolf/public';
import { validateTemplateRoles } from '@game-judge/game-engine/games/werewolf/public';
import { z } from 'zod';

import { definePublicCommandOptions } from '../../platform/room/commandOptions';
import { ROOM_PUBLIC_COMMAND_SCHEMAS } from '../../platform/room/commandSchemas';

const roleIdSchema = z.custom<RoleId>(
  (value): value is RoleId => typeof value === 'string' && isValidRoleId(value),
);

const stepIdSchema = z.string().refine(isWerewolfStepId);

const ruleOverridesSchema = z.strictObject({
  isPlagueMode: z.boolean().optional(),
  isSheriffElectionEnabled: z.boolean().optional(),
  witchCanSelfHeal: z.boolean().optional(),
});

const seatSchema = z.coerce.number().int().min(0);

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

const publicCommandOptions = definePublicCommandOptions<WerewolfPublicCommand>()([
  ...ROOM_PUBLIC_COMMAND_SCHEMAS,
  z.strictObject({ type: z.literal('werewolf.roles.assign') }),
  z.strictObject({
    type: z.literal('werewolf.game.restart'),
    gameSequence: z.number().int().nonnegative(),
    wasEnded: z.boolean(),
  }),
  z.strictObject({
    type: z.literal('werewolf.mvp.select'),
    selection: z.strictObject({
      roleRevealRandomNonce: z.string().nullable(),
      mvpUserId: z.string().min(1),
    }),
  }),
  z.strictObject({ type: z.literal('werewolf.bots.markAllBotsViewed') }),
  z.strictObject({
    type: z.literal('werewolf.step.submit'),
    gameSequence: z.number().int().nonnegative(),
    submission: z.strictObject({
      stepId: stepIdSchema,
      serial: z.number().int().nonnegative(),
      actionKey: z.string().min(1).max(128),
      seats: z.array(z.number().int().nonnegative()).readonly().optional(),
      cardIndex: z.number().int().nonnegative().optional(),
    }),
  }),
  z.strictObject({
    type: z.literal('werewolf.step.ackBots'),
    gameSequence: z.number().int().nonnegative(),
    stepId: stepIdSchema,
    serial: z.number().int().nonnegative(),
  }),
  z.strictObject({ type: z.literal('werewolf.role.viewed') }),
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
    type: z.literal('werewolf.lastNightInfo.confirm'),
    gameSequence: z.number().int().nonnegative(),
  }),
  z.strictObject({
    type: z.literal('werewolf.review.complete'),
    gameSequence: z.number().int().nonnegative(),
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
  z.strictObject({ type: z.literal('werewolf.game.begin') }),
  z.strictObject({ type: z.literal('werewolf.sheriff.register') }),
  z.strictObject({ type: z.literal('werewolf.sheriff.cancelRegistration') }),
  z.strictObject({ type: z.literal('werewolf.sheriff.withdraw') }),
  z.strictObject({
    type: z.literal('werewolf.sheriff.vote'),
    targetSeat: seatSchema.nullable(),
  }),
  z.strictObject({ type: z.literal('werewolf.sheriff.advance') }),
  z.strictObject({ type: z.literal('werewolf.sheriff.endBySelfDestruct') }),
  z.strictObject({
    type: z.literal('werewolf.audio.ack'),
    audioBatchId: z.number().int().nonnegative(),
  }),
  z.strictObject({ type: z.literal('werewolf.phase.retrySettle') }),
]);

export const werewolfPublicCommandSchema: z.ZodType<WerewolfPublicCommand> = z.discriminatedUnion(
  'type',
  publicCommandOptions,
);

export const werewolfInternalCommandSchema: z.ZodType<WerewolfInternalCommand> =
  z.discriminatedUnion('type', [
    z.strictObject({
      type: z.literal('werewolf.growth.applyRosterLevels'),
      levels: z.record(z.string().min(1), z.number().int().nonnegative()),
    }),
    z.strictObject({ type: z.literal('werewolf.phase.settleExpired') }),
  ]);
