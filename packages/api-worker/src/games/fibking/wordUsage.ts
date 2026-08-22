/** Idempotent committed-round usage and participant exposure persistence. */

import type { FibRecordWordUsageEffect } from '@game-judge/game-engine/games/fibking/public';
import { z } from 'zod';

import type { WorkerEffectRoomIdentity } from '../../platform/gameModules/runtimeGameModule';
import type { fibWordUsages } from './dbSchema';
import { recordFibWordExposure } from './wordHistory';

interface RecordFibWordUsageInput {
  readonly db: D1Database;
  readonly roomIdentity: WorkerEffectRoomIdentity;
  readonly effect: FibRecordWordUsageEffect;
}

type FibWordUsage = typeof fibWordUsages.$inferSelect;

interface RawUsageRow {
  readonly room_creation_id: FibWordUsage['roomCreationId'];
  readonly round_id: FibWordUsage['roundId'];
  readonly word_id: FibWordUsage['wordId'];
  readonly word: FibWordUsage['word'];
  readonly source: FibWordUsage['source'];
  readonly used_at: FibWordUsage['usedAt'];
  readonly participant_count: FibWordUsage['participantCount'];
}

const usageRowSchema: z.ZodType<RawUsageRow> = z.strictObject({
  room_creation_id: z.string().min(1),
  round_id: z.string().min(1),
  word_id: z.string().min(1).nullable(),
  word: z.string().min(1),
  source: z.enum(['gemini', 'local']),
  used_at: z.string().datetime({ offset: true }),
  participant_count: z.int().positive(),
});

function normalizeParticipantUserIds(userIds: readonly string[]): readonly string[] {
  const normalized = [...new Set(userIds)].sort();
  if (normalized.length === 0 || normalized.some((userId) => userId.length === 0)) {
    throw new Error('Fib word usage requires non-empty participant user IDs');
  }
  return normalized;
}

async function readUsage(
  db: D1Database,
  roomCreationId: string,
  roundId: string,
): Promise<RawUsageRow | null> {
  const row = await db
    .prepare(
      `SELECT room_creation_id, round_id, word_id, word, source, used_at, participant_count
       FROM fib_word_usages
       WHERE room_creation_id = ? AND round_id = ?`,
    )
    .bind(roomCreationId, roundId)
    .first();
  return row === null ? null : usageRowSchema.parse(row);
}

/** Persist committed usage before exposure updates so a retry can finish partial delivery. */
export async function recordFibWordUsage(input: RecordFibWordUsageInput): Promise<void> {
  const participantUserIds = normalizeParticipantUserIds(input.effect.payload.participantUserIds);
  const usedAtDate = new Date(input.effect.payload.usedAt);
  if (!Number.isFinite(usedAtDate.getTime())) {
    throw new Error(`Fib word usage timestamp is invalid: ${input.effect.payload.usedAt}`);
  }
  const usedAt = usedAtDate.toISOString();
  const selection = await input.db
    .prepare(
      `SELECT word_id, word, source
       FROM fib_round_word_selections
       WHERE room_id = ? AND room_creation_id = ? AND round_id = ?`,
    )
    .bind(input.roomIdentity.roomId, input.roomIdentity.creationId, input.effect.payload.roundId)
    .first<{ readonly word_id: string | null; readonly word: string; readonly source: string }>();
  if (selection === null) {
    throw new Error(
      `[FAIL-FAST] Fib word usage has no selection for round ${input.effect.payload.roundId}`,
    );
  }
  if (
    selection.word !== input.effect.payload.word ||
    selection.source !== input.effect.payload.source
  ) {
    throw new Error(
      `[FAIL-FAST] Fib word usage conflicts with selection for round ${input.effect.payload.roundId}`,
    );
  }

  await input.db
    .prepare(
      `INSERT INTO fib_word_usages (
         room_creation_id, round_id, word_id, word, source, used_at, participant_count
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (room_creation_id, round_id) DO NOTHING`,
    )
    .bind(
      input.roomIdentity.creationId,
      input.effect.payload.roundId,
      selection.word_id,
      input.effect.payload.word,
      input.effect.payload.source,
      usedAt,
      participantUserIds.length,
    )
    .run();

  const stored = await readUsage(
    input.db,
    input.roomIdentity.creationId,
    input.effect.payload.roundId,
  );
  if (
    stored === null ||
    stored.word_id !== selection.word_id ||
    stored.word !== input.effect.payload.word ||
    stored.source !== input.effect.payload.source ||
    stored.used_at !== usedAt ||
    stored.participant_count !== participantUserIds.length
  ) {
    throw new Error(
      `[FAIL-FAST] Fib word usage identity conflict for round ${input.effect.payload.roundId}`,
    );
  }

  await recordFibWordExposure(input.db, participantUserIds, stored.word, stored.used_at);
}
