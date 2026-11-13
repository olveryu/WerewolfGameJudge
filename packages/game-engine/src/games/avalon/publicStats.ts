/** Public Avalon statistics and completion contracts. */

import { z } from 'zod';

import {
  type GameCompletionPayloadV2,
  gameCompletionPayloadV2Schema,
  type GameCompletionStatsFact,
} from '../../platform/engine/completionEffect';
import { AVALON_ROLES, type AvalonRoleId } from './state/types';

const count = z.number().refine((value) => Number.isSafeInteger(value) && value >= 0);

const roleStatsSchema = z
  .array(
    z.strictObject({
      role: z.enum(AVALON_ROLES),
      gamesPlayed: count,
      wins: count,
    }),
  )
  .superRefine((roles, context) => {
    if (
      new Set(roles.map((entry) => entry.role)).size !== roles.length ||
      roles.some((entry) => entry.wins > entry.gamesPlayed)
    ) {
      context.addIssue({ code: 'custom', message: 'Avalon role counts are inconsistent' });
    }
  });

export const avalonPublicStatsSchema = z.strictObject({
  gameType: z.literal('avalon'),
  gamesPlayed: count,
  roles: roleStatsSchema,
});

export interface AvalonPublicStats {
  readonly gameType: 'avalon';
  readonly gamesPlayed: number;
  readonly roles: readonly {
    readonly role: AvalonRoleId;
    readonly gamesPlayed: number;
    readonly wins: number;
  }[];
}

export function parseAvalonPublicStats(value: unknown): AvalonPublicStats {
  return avalonPublicStatsSchema.parse(value);
}

export interface AvalonCompletionStatsFact extends GameCompletionStatsFact {
  readonly role: AvalonRoleId;
  readonly won: boolean;
}

const avalonCompletionFactSchema = z.strictObject({
  userId: z.string().min(1),
  role: z.enum(AVALON_ROLES),
  won: z.boolean(),
});

export const avalonCompletionPayloadSchema = gameCompletionPayloadV2Schema(
  avalonCompletionFactSchema,
);

export type AvalonCompletionPayload = GameCompletionPayloadV2<AvalonCompletionStatsFact>;
