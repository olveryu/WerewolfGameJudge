/** D1 memoization ledger for nondeterministic FibKing word generation. */

import {
  FIB_WORD_SOURCES,
  type FibGenerateWordEffect,
} from '@game-judge/game-engine/games/fibking/public';
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import { z } from 'zod';

import { sha256Hex } from '../../platform/crypto/sha256Hex';
import type { WorkerEffectRoomIdentity } from '../../platform/gameModules/runtimeGameModule';
import type { fibWordGenerationResults } from './dbSchema';
import { readRecentFibWords } from './wordHistory';
import { parseFibWordCandidate } from './wordProviders/candidate';
import { FibWordProviderError } from './wordProviders/providerError';
import {
  FIB_WORD_CATEGORIES,
  type FibWordCandidate,
  type FibWordCategory,
  type FibWordProvider,
} from './wordProviders/types';

export const FIB_PREPARATION_TIMEOUT_MS = 8_000;
const FIB_FINALIZATION_RESERVE_MS = 500;
const FIB_WORD_CATEGORY_HASH_HEX_LENGTH = 8;

type FibWordGenerationResult = typeof fibWordGenerationResults.$inferSelect;

interface RawFibWordGenerationResultRow {
  readonly room_id: FibWordGenerationResult['roomId'];
  readonly room_creation_id: FibWordGenerationResult['roomCreationId'];
  readonly effect_id: FibWordGenerationResult['effectId'];
  readonly round_id: FibWordGenerationResult['roundId'];
  readonly request_fingerprint: FibWordGenerationResult['requestFingerprint'];
  readonly requested_at: FibWordGenerationResult['requestedAt'];
  readonly deadline_at: FibWordGenerationResult['deadlineAt'];
  readonly word: FibWordGenerationResult['word'];
  readonly core_meaning: FibWordGenerationResult['coreMeaning'];
  readonly usage_note: FibWordGenerationResult['usageNote'];
  readonly source: FibWordGenerationResult['source'];
}

const fibWordGenerationResultRowSchema: z.ZodType<RawFibWordGenerationResultRow> = z.strictObject({
  room_id: z.string().min(1),
  room_creation_id: z.string().min(1),
  effect_id: z.string().min(1),
  round_id: z.string().min(1),
  request_fingerprint: z.string().length(64),
  requested_at: z.int().nonnegative(),
  deadline_at: z.int().nonnegative(),
  word: z.string(),
  core_meaning: z.string(),
  usage_note: z.string(),
  source: z.enum(FIB_WORD_SOURCES),
});

type FibWordGenerationResultRow = z.output<typeof fibWordGenerationResultRowSchema>;

interface GetFibWordGenerationResultInput {
  readonly db: D1Database;
  readonly roomIdentity: WorkerEffectRoomIdentity;
  readonly effectId: string;
  readonly effect: FibGenerateWordEffect;
  readonly provider: FibWordProvider;
  readonly historyUserIds: readonly string[];
  readonly requestedAt: number;
}

async function createRequestFingerprint(
  effect: FibGenerateWordEffect,
  requestedAt: number,
  deadlineAt: number,
): Promise<string> {
  return sha256Hex(
    canonicalJson({
      roundId: effect.payload.roundId,
      avoidWords: effect.payload.avoidWords,
      requestedAt,
      deadlineAt,
    }),
  );
}

function createGenerationSignal(generationDeadlineAt: number): AbortSignal {
  const remainingDurationMs = generationDeadlineAt - Date.now();
  if (remainingDurationMs <= 0) {
    throw new FibWordProviderError('Fib word generation deadline expired', 'timedOut');
  }
  return AbortSignal.timeout(remainingDurationMs);
}

/**
 * Selects a stable category from a round-specific seed.
 *
 * @throws Error when the seed is empty or category selection cannot produce a value.
 */
export async function selectFibWordCategory(selectionSeed: string): Promise<FibWordCategory> {
  if (selectionSeed.length === 0) {
    throw new Error('Fib word category selection seed must be non-empty');
  }
  const selectionHash = await sha256Hex(selectionSeed);
  const selectionValue = Number.parseInt(
    selectionHash.slice(0, FIB_WORD_CATEGORY_HASH_HEX_LENGTH),
    16,
  );
  const category = FIB_WORD_CATEGORIES[selectionValue % FIB_WORD_CATEGORIES.length];
  if (category === undefined) {
    throw new Error('[FAIL-FAST] Fib word category selection produced no value');
  }
  return category;
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
        requested_at,
        deadline_at,
        word,
        core_meaning,
        usage_note,
        source
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
): FibWordCandidate {
  const { roomIdentity, effectId, effect, requestedAt } = input;
  const deadlineAt = requestedAt + FIB_PREPARATION_TIMEOUT_MS;
  if (
    row.room_id !== roomIdentity.roomId ||
    row.room_creation_id !== roomIdentity.creationId ||
    row.effect_id !== effectId ||
    row.round_id !== effect.payload.roundId ||
    row.request_fingerprint !== requestFingerprint ||
    row.requested_at !== requestedAt ||
    row.deadline_at !== deadlineAt
  ) {
    throw new Error(`[FAIL-FAST] Fib word result identity conflict for effect ${effectId}`);
  }
  try {
    return parseFibWordCandidate(
      {
        word: row.word,
        definition: {
          coreMeaning: row.core_meaning,
          usageNote: row.usage_note,
        },
      },
      row.source,
      effect.payload.avoidWords,
    );
  } catch (error) {
    throw new FibWordProviderError('Persisted Fib word result was invalid', 'invalidOutput', {
      cause: error,
    });
  }
}

export async function getOrCreateFibWordGenerationResult(
  input: GetFibWordGenerationResultInput,
): Promise<FibWordCandidate> {
  const { db, roomIdentity, effectId, effect, provider, historyUserIds, requestedAt } = input;
  const deadlineAt = requestedAt + FIB_PREPARATION_TIMEOUT_MS;
  const generationDeadlineAt = deadlineAt - FIB_FINALIZATION_RESERVE_MS;
  if (!Number.isSafeInteger(deadlineAt) || !Number.isSafeInteger(generationDeadlineAt)) {
    throw new Error('[FAIL-FAST] Fib word generation deadline must be a safe integer');
  }
  const requestFingerprint = await createRequestFingerprint(effect, requestedAt, deadlineAt);
  const persisted = await readResult(db, roomIdentity.roomId, effectId);
  if (persisted !== null) return parseMatchingResult(persisted, input, requestFingerprint);

  if (generationDeadlineAt - Date.now() <= 0) {
    throw new FibWordProviderError('Fib word generation deadline expired', 'timedOut');
  }
  const recentWords = await readRecentFibWords(db, historyUserIds);
  const category = await selectFibWordCategory(effect.payload.roundId);
  let generated: FibWordCandidate;
  try {
    generated = await provider.generate({
      avoidWords: effect.payload.avoidWords,
      recentWords,
      selectionSeed: effect.payload.roundId,
      category,
      generationDeadlineAt,
      signal: createGenerationSignal(generationDeadlineAt),
    });
  } catch (error) {
    if (error instanceof FibWordProviderError) throw error;
    throw new FibWordProviderError('Fib word provider request failed', 'requestFailed', {
      cause: error,
    });
  }
  let candidate: FibWordCandidate;
  try {
    candidate = parseFibWordCandidate(
      { word: generated.word, definition: generated.definition },
      generated.source,
      [...effect.payload.avoidWords, ...recentWords],
    );
  } catch (error) {
    throw new FibWordProviderError('Generated Fib word candidate was invalid', 'invalidOutput', {
      cause: error,
    });
  }
  const createdAt = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO fib_word_generation_results (
        room_id,
        room_creation_id,
        effect_id,
        round_id,
        request_fingerprint,
        requested_at,
        deadline_at,
        word,
        core_meaning,
        usage_note,
        source,
        created_at
      )
      SELECT id, creation_id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      FROM rooms
      WHERE id = ? AND code = ? AND creation_id = ?
      ON CONFLICT (room_id, effect_id) DO NOTHING`,
    )
    .bind(
      effectId,
      effect.payload.roundId,
      requestFingerprint,
      requestedAt,
      deadlineAt,
      candidate.word,
      candidate.definition.coreMeaning,
      candidate.definition.usageNote,
      candidate.source,
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
