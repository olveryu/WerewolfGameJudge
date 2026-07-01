import {
  buildInitialWerewolfState,
  type WerewolfCreateConfig,
} from '@werewolf/game-engine/engine/state/buildInitialState';
import { fibEngine } from '@werewolf/game-engine/fibking/engine';
import { FIB_GAME_TYPE } from '@werewolf/game-engine/fibking/types';
import { isValidRoleId } from '@werewolf/game-engine/models/roles';
import {
  type GameTemplate,
  getPlayerCount,
  validateTemplateRoles,
} from '@werewolf/game-engine/models/Template';
import { WEREWOLF_GAME_TYPE } from '@werewolf/game-engine/protocol/gameTypes';
import { z } from 'zod';

import { fibCreateConfigSchema } from '../schemas/fib';

interface CreateStateContext {
  roomCode: string;
  hostUserId: string;
}

export type CreateInitialRoomStateResult =
  | { success: true; state: unknown }
  | { success: false; reason: 'UNKNOWN_GAME_TYPE' | 'INVALID_CONFIG' };

interface RoomCreateRegistryEntry {
  createInitialState(config: unknown, ctx: CreateStateContext): CreateInitialRoomStateResult;
}

const roleIdSchema = z.string().min(1).refine(isValidRoleId, { message: 'invalid role id' });

const gameRuleOverridesSchema = z.strictObject({
  isPlagueMode: z.boolean().optional(),
  witchCanSelfHeal: z.boolean().optional(),
});

const gameTemplateSchema: z.ZodType<GameTemplate> = z
  .strictObject({
    name: z.string(),
    numberOfPlayers: z.number().int().min(1),
    roles: z.array(roleIdSchema).min(1),
    rules: gameRuleOverridesSchema.optional(),
  })
  .superRefine((template, ctx) => {
    const validationError = validateTemplateRoles(template.roles);
    if (validationError) {
      ctx.addIssue({ code: 'custom', path: ['roles'], message: validationError });
    }

    const playerCount = getPlayerCount(template.roles);
    if (template.numberOfPlayers !== playerCount) {
      ctx.addIssue({
        code: 'custom',
        path: ['numberOfPlayers'],
        message: 'numberOfPlayers must match roles player count',
      });
    }
  });

const werewolfCreateConfigSchema: z.ZodType<WerewolfCreateConfig> = z.strictObject({
  template: gameTemplateSchema,
});

const ROOM_CREATE_REGISTRY: Record<string, RoomCreateRegistryEntry> = {
  [WEREWOLF_GAME_TYPE]: {
    createInitialState(config, ctx) {
      const result = werewolfCreateConfigSchema.safeParse(config);
      if (!result.success) return { success: false, reason: 'INVALID_CONFIG' };

      return {
        success: true,
        state: buildInitialWerewolfState(ctx.roomCode, ctx.hostUserId, result.data),
      };
    },
  },
  [FIB_GAME_TYPE]: {
    createInitialState(config, ctx) {
      const result = fibCreateConfigSchema.safeParse(config);
      if (!result.success) return { success: false, reason: 'INVALID_CONFIG' };

      return {
        success: true,
        state: fibEngine.createInitialState(result.data, ctx),
      };
    },
  },
};

export function createInitialRoomState(
  gameType: string,
  config: unknown,
  ctx: CreateStateContext,
): CreateInitialRoomStateResult {
  const creator = ROOM_CREATE_REGISTRY[gameType];
  if (!creator) return { success: false, reason: 'UNKNOWN_GAME_TYPE' };

  return creator.createInitialState(config, ctx);
}
