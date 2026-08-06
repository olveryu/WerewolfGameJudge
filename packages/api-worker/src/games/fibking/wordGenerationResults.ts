/** D1 idempotency ledger for deterministic FibKing catalog selections. */

import {
  FIB_DEFINITION_FIELD_MAX_LENGTH,
  FIB_WORD_MAX_LENGTH,
  FIB_WORD_MIN_LENGTH,
  type FibGenerateWordEffect,
} from '@game-judge/game-engine/games/fibking/public';
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import { z } from 'zod';

import { sha256Hex } from '../../platform/crypto/sha256Hex';
import type { WorkerEffectRoomIdentity } from '../../platform/gameModules/runtimeGameModule';
import type { fibWordGenerationResults } from './dbSchema';
import {
  FIB_WORD_CATALOG_VERSION,
  type FibWordCatalogSelection,
  selectFibWordCatalogEntry,
} from './wordCatalog';
import { readRecentFibWords } from './wordHistory';

type FibWordGenerationResult = typeof fibWordGenerationResults.$inferSelect;

interface RawFibWordGenerationResultRow {
  readonly room_id: FibWordGenerationResult['roomId'];
  readonly room_creation_id: FibWordGenerationResult['roomCreationId'];
  readonly effect_id: FibWordGenerationResult['effectId'];
  readonly round_id: FibWordGenerationResult['roundId'];
  readonly request_fingerprint: FibWordGenerationResult['requestFingerprint'];
  readonly catalog_entry_id: FibWordGenerationResult['catalogEntryId'];
  readonly catalog_version: FibWordGenerationResult['catalogVersion'];
  readonly word: FibWordGenerationResult['word'];
  readonly core_meaning: FibWordGenerationResult['coreMeaning'];
  readonly usage_note: FibWordGenerationResult['usageNote'];
}

const chineseWordSchema = z
  .string()
  .min(FIB_WORD_MIN_LENGTH)
  .max(FIB_WORD_MAX_LENGTH)
  .regex(/^\p{Script=Han}+$/u);
const chineseDefinitionFieldSchema = z
  .string()
  .min(1)
  .max(FIB_DEFINITION_FIELD_MAX_LENGTH)
  .regex(/^(?=.*\p{Script=Han})[\p{Script=Han}\p{N}\p{P}\p{Zs}]+$/u);
const fibWordGenerationResultRowSchema: z.ZodType<RawFibWordGenerationResultRow> = z.strictObject({
  room_id: z.string().min(1),
  room_creation_id: z.string().min(1),
  effect_id: z.string().min(1),
  round_id: z.string().min(1),
  request_fingerprint: z.string().length(64),
  catalog_entry_id: z.string().regex(/^fib-[0-9]{4}$/),
  catalog_version: z.int().positive(),
  word: chineseWordSchema,
  core_meaning: chineseDefinitionFieldSchema,
  usage_note: chineseDefinitionFieldSchema,
});

type FibWordGenerationResultRow = z.output<typeof fibWordGenerationResultRowSchema>;

interface GetFibWordGenerationResultInput {
  readonly db: D1Database;
  readonly roomIdentity: WorkerEffectRoomIdentity;
  readonly effectId: string;
  readonly effect: FibGenerateWordEffect;
  readonly historyUserIds: readonly string[];
}

async function createRequestFingerprint(effect: FibGenerateWordEffect): Promise<string> {
  return sha256Hex(
    canonicalJson({
      catalogVersion: FIB_WORD_CATALOG_VERSION,
      roundId: effect.payload.roundId,
      avoidWords: effect.payload.avoidWords,
    }),
  );
}

async function readResult(
  db: D1Database,
  roomId: string,
  effectId: string,
): Promise<FibWordGenerationResultRow | null> {
  const row = await db
    .prepare(
      `SELECT
        room_id,
        room_creation_id,
        effect_id,
        round_id,
        request_fingerprint,
        catalog_entry_id,
        catalog_version,
        word,
        core_meaning,
        usage_note
      FROM fib_word_generation_results
      WHERE room_id = ? AND effect_id = ?`,
    )
    .bind(roomId, effectId)
    .first();
  return row === null ? null : fibWordGenerationResultRowSchema.parse(row);
}

function parseMatchingResult(
  row: FibWordGenerationResultRow,
  input: GetFibWordGenerationResultInput,
  requestFingerprint: string,
): FibWordCatalogSelection {
  const { roomIdentity, effectId, effect } = input;
  if (
    row.room_id !== roomIdentity.roomId ||
    row.room_creation_id !== roomIdentity.creationId ||
    row.effect_id !== effectId ||
    row.round_id !== effect.payload.roundId ||
    row.request_fingerprint !== requestFingerprint
  ) {
    throw new Error(`[FAIL-FAST] Fib word result identity conflict for effect ${effectId}`);
  }
  return {
    catalogEntryId: row.catalog_entry_id,
    catalogVersion: row.catalog_version,
    word: row.word,
    definition: {
      coreMeaning: row.core_meaning,
      usageNote: row.usage_note,
    },
  };
}

export async function getOrCreateFibWordGenerationResult(
  input: GetFibWordGenerationResultInput,
): Promise<FibWordCatalogSelection> {
  const { db, roomIdentity, effectId, effect, historyUserIds } = input;
  const requestFingerprint = await createRequestFingerprint(effect);
  const persisted = await readResult(db, roomIdentity.roomId, effectId);
  if (persisted !== null) return parseMatchingResult(persisted, input, requestFingerprint);

  const recentWords = await readRecentFibWords(db, historyUserIds);
  const selection = await selectFibWordCatalogEntry({
    avoidWords: effect.payload.avoidWords,
    recentWords,
    selectionSeed: effect.payload.roundId,
  });
  const createdAt = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO fib_word_generation_results (
        room_id,
        room_creation_id,
        effect_id,
        round_id,
        request_fingerprint,
        catalog_entry_id,
        catalog_version,
        word,
        core_meaning,
        usage_note,
        created_at
      )
      SELECT id, creation_id, ?, ?, ?, ?, ?, ?, ?, ?, ?
      FROM rooms
      WHERE id = ? AND code = ? AND creation_id = ?
      ON CONFLICT (room_id, effect_id) DO NOTHING`,
    )
    .bind(
      effectId,
      effect.payload.roundId,
      requestFingerprint,
      selection.catalogEntryId,
      selection.catalogVersion,
      selection.word,
      selection.definition.coreMeaning,
      selection.definition.usageNote,
      createdAt,
      roomIdentity.roomId,
      roomIdentity.roomCode,
      roomIdentity.creationId,
    )
    .run();

  const stored = await readResult(db, roomIdentity.roomId, effectId);
  if (stored === null) {
    throw new Error(`[FAIL-FAST] Fib word result was not persisted for effect ${effectId}`);
  }
  return parseMatchingResult(stored, input, requestFingerprint);
}
