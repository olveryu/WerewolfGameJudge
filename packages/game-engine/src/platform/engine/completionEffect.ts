/**
 * Settlement completion payloads (AU-42).
 *
 * Every game's terminal decision emits one completion effect whose
 * payload is `{ roundId, completedAt, participantUserIds }`; the
 * worker settles XP and rewards from it. This builder is the one
 * assembly point: the caller supplies its human seats in seat order
 * (from the live roster, or from a round's frozen participant list
 * where the game keeps one), and the builder applies the game's
 * optional authorship filter (pictionary and storyrelay reward
 * actual authors only — a registered product difference, injected
 * as includeSeat) and assembles the payload.
 *
 * Exactly-once: each game emits the effect from behind a one-way
 * phase transition into its terminal phase, so the emitting branch
 * is unreachable twice. Avalon is the registered exception: its
 * terminal event can be produced by several converging end paths
 * (quests, veto limit, assassination), so it carries an explicit
 * xpSettled state flag and checks it at every emission site.
 */

import { z } from 'zod';

export interface GameCompletionPayload {
  readonly roundId: string;
  readonly completedAt: number;
  readonly participantUserIds: readonly string[];
}

export interface GameCompletionStatsFact {
  readonly userId: string;
}

export interface GameCompletionPayloadV2<
  TFact extends GameCompletionStatsFact,
> extends GameCompletionPayload {
  readonly completionVersion: 2;
  readonly stats: readonly TFact[];
}

export function gameCompletionPayloadV2Schema<TFact extends GameCompletionStatsFact>(
  factSchema: z.ZodType<TFact>,
) {
  return z
    .strictObject({
      roundId: z.string().min(1),
      completedAt: z.number().refine((value) => Number.isSafeInteger(value) && value >= 0),
      participantUserIds: z.array(z.string().min(1)),
      completionVersion: z.literal(2),
      stats: z.array(factSchema),
    })
    .superRefine((payload, context) => {
      const participantUserIds = payload.participantUserIds;
      const statsUserIds = payload.stats.map((fact) => fact.userId);
      if (
        new Set(participantUserIds).size !== participantUserIds.length ||
        new Set(statsUserIds).size !== statsUserIds.length ||
        participantUserIds.length !== statsUserIds.length ||
        participantUserIds.some((userId, index) => statsUserIds[index] !== userId)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'stats users must match participantUserIds in seat order',
          path: ['stats'],
        });
      }
    });
}

export function buildGameCompletionPayloadV2<
  TSeat extends { readonly seat: number; readonly userId: string },
  TFact extends GameCompletionStatsFact,
>(input: {
  readonly roundId: string;
  readonly completedAt: number;
  readonly humans: readonly TSeat[];
  readonly minimumHumanPlayers: number;
  readonly includeSeat?: (seat: TSeat) => boolean;
  readonly stats: readonly TFact[];
}): GameCompletionPayloadV2<TFact> | null {
  const payload = buildGameCompletionPayload(input);
  if (payload === null) return null;
  const statsUserIds = input.stats.map((fact) => fact.userId);
  if (
    payload.participantUserIds.length !== statsUserIds.length ||
    payload.participantUserIds.some((userId, index) => statsUserIds[index] !== userId)
  ) {
    throw new Error('Completion stats users must match the filtered participants in seat order');
  }
  return { ...payload, completionVersion: 2, stats: input.stats };
}

export function buildGameCompletionPayload<
  TSeat extends { readonly seat: number; readonly userId: string },
>(input: {
  readonly roundId: string;
  readonly completedAt: number;
  /** The game's human seats, in seat order. */
  readonly humans: readonly TSeat[];
  readonly minimumHumanPlayers: number;
  /** Narrows the rewarded humans (authorship filters); defaults to every supplied human. */
  readonly includeSeat?: (seat: TSeat) => boolean;
}): GameCompletionPayload | null {
  if (!Number.isSafeInteger(input.minimumHumanPlayers) || input.minimumHumanPlayers < 0) {
    throw new Error('Minimum human player count must be a non-negative safe integer');
  }
  if (input.humans.length < input.minimumHumanPlayers) return null;
  const participantUserIds = input.humans
    .filter((seat) => input.includeSeat === undefined || input.includeSeat(seat))
    .map((seat) => seat.userId);
  return { roundId: input.roundId, completedAt: input.completedAt, participantUserIds };
}
