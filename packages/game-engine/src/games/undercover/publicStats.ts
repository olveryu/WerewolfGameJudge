/** Public Undercover statistics and completion contracts. */

import { z } from 'zod';

import {
  type GameCompletionPayloadV2,
  gameCompletionPayloadV2Schema,
  type GameCompletionStatsFact,
} from '../../platform/engine/completionEffect';
import { UNDERCOVER_ROLES, type UndercoverRole } from './domain/rules';

const count = z.number().refine((value) => Number.isSafeInteger(value) && value >= 0);

const roleStatsSchema = z
  .array(
    z.strictObject({
      role: z.enum(UNDERCOVER_ROLES),
      gamesPlayed: count,
      wins: count,
    }),
  )
  .superRefine((roles, context) => {
    if (
      new Set(roles.map((entry) => entry.role)).size !== roles.length ||
      roles.some((entry) => entry.wins > entry.gamesPlayed)
    ) {
      context.addIssue({ code: 'custom', message: 'Undercover role counts are inconsistent' });
    }
  });

export const undercoverPublicStatsSchema = z.strictObject({
  gameType: z.literal('undercover'),
  gamesPlayed: count,
  roles: roleStatsSchema,
});

export interface UndercoverPublicStats {
  readonly gameType: 'undercover';
  readonly gamesPlayed: number;
  readonly roles: readonly {
    readonly role: UndercoverRole;
    readonly gamesPlayed: number;
    readonly wins: number;
  }[];
}

export function parseUndercoverPublicStats(value: unknown): UndercoverPublicStats {
  return undercoverPublicStatsSchema.parse(value);
}

export interface UndercoverCompletionStatsFact extends GameCompletionStatsFact {
  readonly role: UndercoverRole;
  readonly won: boolean;
}

const undercoverCompletionFactSchema = z.strictObject({
  userId: z.string().min(1),
  role: z.enum(UNDERCOVER_ROLES),
  won: z.boolean(),
});

export const undercoverCompletionPayloadSchema = gameCompletionPayloadV2Schema(
  undercoverCompletionFactSchema,
);

export type UndercoverCompletionPayload = GameCompletionPayloadV2<UndercoverCompletionStatsFact>;
