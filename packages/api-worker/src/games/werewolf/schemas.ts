/** Strict external schemas for the Werewolf Worker module. */

import type {
  WerewolfConfig,
  WerewolfInternalCommand,
  WerewolfProfileUpdate,
  WerewolfPublicCommand,
  WerewolfSeatProfile,
} from '@werewolf/game-engine/games/werewolf/public';
import { isValidRoleId, type RoleId } from '@werewolf/game-engine/models/roles';
import { validateTemplateRoles } from '@werewolf/game-engine/models/Template';
import { z } from 'zod';

const roleIdSchema = z.custom<RoleId>(
  (value): value is RoleId => typeof value === 'string' && isValidRoleId(value),
);

const ruleOverridesSchema = z.strictObject({
  isPlagueMode: z.boolean().optional(),
  witchCanSelfHeal: z.boolean().optional(),
});

const seatProfileSchema: z.ZodType<WerewolfSeatProfile> = z.strictObject({
  displayName: z.string().min(1),
  avatarUrl: z.string().optional(),
  avatarFrame: z.string().optional(),
  seatFlair: z.string().optional(),
  nameStyle: z.string().optional(),
  roleRevealEffect: z.string().optional(),
  seatAnimation: z.string().optional(),
  level: z.number().int().nonnegative().optional(),
});

const profileUpdateSchema: z.ZodType<WerewolfProfileUpdate> = z.strictObject({
  displayName: z.string().min(1).optional(),
  avatarUrl: z.string().optional(),
  avatarFrame: z.string().optional(),
  seatFlair: z.string().optional(),
  nameStyle: z.string().optional(),
  roleRevealEffect: z.string().optional(),
  seatAnimation: z.string().optional(),
});

export const werewolfCreateConfigSchema: z.ZodType<WerewolfConfig> = z
  .strictObject({
    templateRoles: z.array(roleIdSchema),
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
  z.strictObject({
    type: z.literal('room.seat.take'),
    seat: z.number().int().nonnegative(),
    profile: seatProfileSchema,
  }),
  z.strictObject({ type: z.literal('room.seat.leave') }),
  z.strictObject({
    type: z.literal('room.seat.kick'),
    seat: z.number().int().nonnegative(),
  }),
  z.strictObject({ type: z.literal('room.seat.clear') }),
  z.strictObject({ type: z.literal('room.seat.fillBots') }),
  z.strictObject({
    type: z.literal('room.profile.update'),
    profile: profileUpdateSchema,
  }),
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
        targets: z.array(z.number().int().nonnegative()),
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
  }),
  z.strictObject({ type: z.literal('werewolf.role.view') }),
  z.strictObject({
    type: z.literal('werewolf.config.update'),
    templateRoles: z.array(roleIdSchema),
    rules: ruleOverridesSchema.optional(),
  }),
  z.strictObject({
    type: z.literal('werewolf.review.share'),
    allowedSeats: z.array(z.number().int().nonnegative()),
  }),
  z.strictObject({
    type: z.literal('werewolf.board.nominate'),
    displayName: z.string().min(1),
    roles: z.array(roleIdSchema),
  }),
  z.strictObject({
    type: z.literal('werewolf.board.upvote'),
    targetUserId: z.string().min(1),
  }),
  z.strictObject({ type: z.literal('werewolf.board.withdraw') }),
  z.strictObject({ type: z.literal('werewolf.night.start') }),
  z.strictObject({ type: z.literal('werewolf.audio.ack') }),
  z.strictObject({ type: z.literal('werewolf.audio.gate'), isPlaying: z.boolean() }),
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

export const WEREWOLF_PUBLIC_COMMAND_SCHEMA_OPTION_COUNT = publicCommandOptions.length;
