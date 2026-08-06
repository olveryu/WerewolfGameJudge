/** Persistent, bounded FibKing word exposure history for current human participants. */

import {
  FIB_WORD_MAX_LENGTH,
  FIB_WORD_MIN_LENGTH,
  type FibState,
} from '@game-judge/game-engine/games/fibking/public';
import { z } from 'zod';

import type { fibWordExposures } from './dbSchema';

export const FIB_WORD_HISTORY_LIMIT = 200;

type FibWordExposure = typeof fibWordExposures.$inferSelect;

const fibWordSchema = z.string().trim().min(FIB_WORD_MIN_LENGTH).max(FIB_WORD_MAX_LENGTH);
const fibWordExposureRowSchema = z.strictObject({
  word: fibWordSchema,
}) satisfies z.ZodType<Pick<FibWordExposure, 'word'>>;
const fibWordExposureRowsSchema = z.array(fibWordExposureRowSchema);

function normalizeUserIds(userIds: readonly string[]): readonly string[] {
  const uniqueUserIds = new Set<string>();
  for (const userId of userIds) {
    if (userId.length === 0) throw new Error('Fib word history user ID must be non-empty');
    uniqueUserIds.add(userId);
  }
  if (uniqueUserIds.size === 0) {
    throw new Error('Fib word history requires at least one participant');
  }
  return [...uniqueUserIds].sort();
}

function serializeUserIds(userIds: readonly string[]): string {
  return JSON.stringify(normalizeUserIds(userIds));
}

function assertCanonicalTimestamp(value: string): void {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error(`Fib word exposure timestamp must be canonical ISO: ${value}`);
  }
}

export function getFibWordHistoryUserIds(state: FibState): readonly string[] {
  return normalizeUserIds([
    state.hostUserId,
    ...Object.values(state.realSeats).flatMap((seat) => (seat === undefined ? [] : [seat.userId])),
  ]);
}

export async function readRecentFibWords(
  db: D1Database,
  userIds: readonly string[],
): Promise<readonly string[]> {
  const result = await db
    .prepare(
      `WITH participant_users(user_id) AS (
        SELECT DISTINCT value
        FROM json_each(?)
        WHERE type = 'text'
      )
      SELECT exposure.word
      FROM fib_word_exposures AS exposure
      INNER JOIN participant_users AS participant
        ON participant.user_id = exposure.user_id
      GROUP BY exposure.word
      ORDER BY MAX(exposure.last_seen_at) DESC, exposure.word ASC
      LIMIT ?`,
    )
    .bind(serializeUserIds(userIds), FIB_WORD_HISTORY_LIMIT)
    .all();
  return fibWordExposureRowsSchema.parse(result.results).map((row) => row.word);
}

export async function recordFibWordExposure(
  db: D1Database,
  userIds: readonly string[],
  word: string,
  seenAt: string,
): Promise<void> {
  const canonicalWord = fibWordSchema.parse(word);
  assertCanonicalTimestamp(seenAt);
  const serializedUserIds = serializeUserIds(userIds);
  await db.batch([
    db
      .prepare(
        `INSERT INTO fib_word_exposures (user_id, word, last_seen_at)
         SELECT DISTINCT account.id, ?, ?
         FROM json_each(?) AS participant
         INNER JOIN users AS account ON account.id = participant.value
         WHERE participant.type = 'text'
         ON CONFLICT (user_id, word) DO UPDATE SET
           last_seen_at = excluded.last_seen_at`,
      )
      .bind(canonicalWord, seenAt, serializedUserIds),
    db
      .prepare(
        `WITH ranked AS (
           SELECT
             user_id,
             word,
             ROW_NUMBER() OVER (
               PARTITION BY user_id
               ORDER BY last_seen_at DESC, word ASC
             ) AS history_rank
           FROM fib_word_exposures
           WHERE user_id IN (
             SELECT participant.value
             FROM json_each(?) AS participant
             WHERE participant.type = 'text'
           )
         )
         DELETE FROM fib_word_exposures
         WHERE EXISTS (
           SELECT 1
           FROM ranked
           WHERE ranked.user_id = fib_word_exposures.user_id
             AND ranked.word = fib_word_exposures.word
             AND ranked.history_rank > ?
         )`,
      )
      .bind(serializedUserIds, FIB_WORD_HISTORY_LIMIT),
  ]);
}
