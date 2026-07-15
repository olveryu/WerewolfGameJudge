/** D1 memoization ledger for nondeterministic FibKing word generation. */

import {
  FIB_WORD_SOURCES,
  type FibGenerateWordEffect,
} from '@werewolf/game-engine/games/fibking/public';
import { canonicalJson } from '@werewolf/game-engine/platform/protocol/canonicalJson';
import { z } from 'zod';

import { sha256Hex } from '../../platform/crypto/sha256Hex';
import type { WorkerEffectRoomIdentity } from '../../platform/room/runtimeGameModule';
import { parseFibWordCandidate } from './wordProviders/candidate';
import type { FibWordCandidate, FibWordProvider } from './wordProviders/types';

const fibWordGenerationResultRowSchema = z.strictObject({
  room_id: z.string().min(1),
  room_creation_id: z.string().min(1),
  effect_id: z.string().min(1),
  round_id: z.string().min(1),
  request_fingerprint: z.string().length(64),
  word: z.string(),
  definition: z.string(),
  source: z.enum(FIB_WORD_SOURCES),
});

type FibWordGenerationResultRow = z.output<typeof fibWordGenerationResultRowSchema>;

interface GetFibWordGenerationResultInput {
  readonly db: D1Database;
  readonly roomIdentity: WorkerEffectRoomIdentity;
  readonly effectId: string;
  readonly effect: FibGenerateWordEffect;
  readonly provider: FibWordProvider;
}

async function createRequestFingerprint(effect: FibGenerateWordEffect): Promise<string> {
  return sha256Hex(
    canonicalJson({
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
        word,
        definition,
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
  return parseFibWordCandidate(
    { word: row.word, definition: row.definition },
    row.source,
    effect.payload.avoidWords,
  );
}

export async function getOrCreateFibWordGenerationResult(
  input: GetFibWordGenerationResultInput,
): Promise<FibWordCandidate> {
  const { db, roomIdentity, effectId, effect, provider } = input;
  const requestFingerprint = await createRequestFingerprint(effect);
  const persisted = await readResult(db, roomIdentity.roomId, effectId);
  if (persisted !== null) return parseMatchingResult(persisted, input, requestFingerprint);

  const generated = await provider.generate({ avoidWords: effect.payload.avoidWords });
  const candidate = parseFibWordCandidate(
    { word: generated.word, definition: generated.definition },
    generated.source,
    effect.payload.avoidWords,
  );
  const createdAt = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO fib_word_generation_results (
        room_id,
        room_creation_id,
        effect_id,
        round_id,
        request_fingerprint,
        word,
        definition,
        source,
        created_at
      )
      SELECT id, creation_id, ?, ?, ?, ?, ?, ?, ?
      FROM rooms
      WHERE id = ? AND code = ? AND creation_id = ?
      ON CONFLICT (room_id, effect_id) DO NOTHING`,
    )
    .bind(
      effectId,
      effect.payload.roundId,
      requestFingerprint,
      candidate.word,
      candidate.definition,
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
