/** Atomic sequential question allocation; retries replay snapshots and never rewind progress. */

import {
  FIB_WORD_SOURCES,
  type FibSelectWordEffect,
} from '@game-judge/game-engine/games/fibking/public';
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import { z } from 'zod';

import { sha256Hex } from '../../platform/crypto/sha256Hex';
import type { WorkerEffectRoomIdentity } from '../../platform/gameModules/runtimeGameModule';
import { FIB_WORD_SELECTION_TIERS } from './dbSchema';
import { parseFibWordCandidate } from './wordProviders/candidate';
import type { FibWordCandidate } from './wordProviders/types';

export interface SelectFibWordInput {
  readonly db: D1Database;
  readonly roomIdentity: WorkerEffectRoomIdentity;
  readonly effectId: string;
  readonly effect: FibSelectWordEffect;
}

export interface SelectedFibWord extends FibWordCandidate {
  readonly wordId: string | null;
  readonly selectionTier: (typeof FIB_WORD_SELECTION_TIERS)[number];
}

/** Expected terminal result: no published question remains beyond the table's progress. */
export class FibWordInventoryExhaustedError extends Error {
  constructor() {
    super('Fib word inventory exhausted');
    this.name = 'FibWordInventoryExhaustedError';
  }
}

const selectionRowSchema = z.strictObject({
  room_creation_id: z.string().min(1),
  round_id: z.string().min(1),
  request_fingerprint: z.string().length(64),
  word_id: z.string().min(1).nullable(),
  word: z.string(),
  core_meaning: z.string(),
  usage_note: z.string(),
  source: z.enum(FIB_WORD_SOURCES),
  selection_tier: z.enum(FIB_WORD_SELECTION_TIERS),
});

async function readSelection(input: SelectFibWordInput) {
  const row = await input.db
    .prepare(
      `SELECT room_creation_id, round_id, request_fingerprint, word_id,
       word, core_meaning, usage_note, source, selection_tier
     FROM fib_round_word_selections WHERE room_id = ? AND effect_id = ?`,
    )
    .bind(input.roomIdentity.roomId, input.effectId)
    .first();
  return row === null ? null : selectionRowSchema.parse(row);
}

function parseMatchingSelection(
  row: z.output<typeof selectionRowSchema>,
  input: SelectFibWordInput,
  requestFingerprint: string,
): SelectedFibWord {
  if (
    row.room_creation_id !== input.roomIdentity.creationId ||
    row.round_id !== input.effect.payload.roundId ||
    row.request_fingerprint !== requestFingerprint
  ) {
    throw new Error(
      `[FAIL-FAST] Fib word selection identity conflict for effect ${input.effectId}`,
    );
  }
  const candidate = parseFibWordCandidate(
    { word: row.word, definition: { coreMeaning: row.core_meaning, usageNote: row.usage_note } },
    row.source,
    input.effect.payload.avoidWords,
  );
  return { ...candidate, wordId: row.word_id, selectionTier: row.selection_tier };
}

/** Select and consume in one D1 transaction; cancellation intentionally does not refund progress. */
export async function getOrCreateFibWordSelection(
  input: SelectFibWordInput,
): Promise<SelectedFibWord> {
  const participantUserIds = [
    ...new Set(z.array(z.string().min(1)).min(1).parse(input.effect.payload.participantUserIds)),
  ].sort();
  const serializedUserIds = JSON.stringify(participantUserIds);
  const requestFingerprint = await sha256Hex(
    canonicalJson({
      roundId: input.effect.payload.roundId,
      avoidWords: input.effect.payload.avoidWords,
      participantUserIds,
    }),
  );
  const existing = await readSelection(input);
  if (existing !== null) return parseMatchingSelection(existing, input, requestFingerprint);
  const room = await input.db
    .prepare(
      `SELECT id FROM rooms WHERE id = ? AND code = ? AND creation_id = ?
       AND NOT EXISTS (SELECT 1 FROM json_each(?) AS participant
         WHERE NOT EXISTS (SELECT 1 FROM users WHERE users.id = participant.value))`,
    )
    .bind(
      input.roomIdentity.roomId,
      input.roomIdentity.roomCode,
      input.roomIdentity.creationId,
      serializedUserIds,
    )
    .first();
  if (room === null)
    throw new Error('[FAIL-FAST] Fib allocation requires a live room and participants');
  await input.db.batch([
    input.db
      .prepare(
        `INSERT INTO fib_round_word_selections (
         room_id, room_creation_id, effect_id, round_id, request_fingerprint,
         word_id, word, core_meaning, usage_note, source, selection_tier, selected_at,
         sequence_number, participant_user_ids
       ) SELECT room.id, room.creation_id, ?, ?, ?,
         word_entry.id, word_entry.word, word_entry.core_meaning, word_entry.usage_note,
         word_entry.source, 'any_unseen', ?, sequence.id, ?
       FROM fib_word_sequence AS sequence
      INNER JOIN fib_words AS word_entry ON word_entry.word = sequence.word
       INNER JOIN rooms AS room ON room.id = ? AND room.code = ? AND room.creation_id = ?
       WHERE word_entry.status = 'active'
         AND sequence.id > COALESCE((
           SELECT MAX(progress.sequence_number) FROM fib_word_progress AS progress
           INNER JOIN json_each(?) AS participant ON participant.value = progress.user_id
         ), 0)
         AND NOT EXISTS (SELECT 1 FROM json_each(?) AS avoided WHERE avoided.value = word_entry.word)
       ORDER BY sequence.id LIMIT 1
       ON CONFLICT (room_id, effect_id) DO NOTHING`,
      )
      .bind(
        input.effectId,
        input.effect.payload.roundId,
        requestFingerprint,
        new Date().toISOString(),
        serializedUserIds,
        input.roomIdentity.roomId,
        input.roomIdentity.roomCode,
        input.roomIdentity.creationId,
        serializedUserIds,
        JSON.stringify(input.effect.payload.avoidWords),
      ),
    input.db
      .prepare(
        `INSERT INTO fib_word_progress (user_id, sequence_number)
       SELECT participant.value, selection.sequence_number
       FROM fib_round_word_selections AS selection
       INNER JOIN json_each(selection.participant_user_ids) AS participant
       WHERE selection.room_id = ? AND selection.effect_id = ?
         AND selection.request_fingerprint = ? AND selection.sequence_number IS NOT NULL
       ON CONFLICT (user_id) DO UPDATE SET
         sequence_number = MAX(fib_word_progress.sequence_number, excluded.sequence_number)`,
      )
      .bind(input.roomIdentity.roomId, input.effectId, requestFingerprint),
  ]);
  const stored = await readSelection(input);
  if (stored === null) throw new FibWordInventoryExhaustedError();
  return parseMatchingSelection(stored, input, requestFingerprint);
}
