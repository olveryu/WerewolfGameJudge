/** Idempotent eight-keyword allocation from Decrypto's approved inventory. */

import type {
  DecryptoEffect,
  DecryptoKeywordSets,
} from '@game-judge/game-engine/games/decrypto/public';
import { z } from 'zod';

import type { WorkerEffectRoomIdentity } from '../../platform/gameModules/runtimeGameModule';

const keywordSetsSchema = z.strictObject({
  blue: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1), z.string().min(1)]),
  purple: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1), z.string().min(1)]),
});

const selectionRowSchema = z.strictObject({
  room_creation_id: z.string().min(1),
  request_id: z.string().min(1),
  keywords_json: z.string(),
});

async function readSelection(
  db: D1Database,
  roomIdentity: WorkerEffectRoomIdentity,
  payload: Extract<DecryptoEffect, { type: 'decrypto.words.select' }>['payload'],
): Promise<DecryptoKeywordSets | null> {
  const row = await db
    .prepare(
      `SELECT room_creation_id, request_id, keywords_json
       FROM decrypto_round_word_selections
       WHERE room_id = ? AND game_sequence = ?`,
    )
    .bind(roomIdentity.roomId, payload.gameSequence)
    .first();
  if (row === null) return null;
  const selection = selectionRowSchema.parse(row);
  if (
    selection.room_creation_id !== roomIdentity.creationId ||
    selection.request_id !== payload.requestId
  )
    throw new Error('[FAIL-FAST] Decrypto keyword selection identity conflict');
  return keywordSetsSchema.parse(JSON.parse(selection.keywords_json));
}

/** Replays an existing snapshot or atomically records one random eight-word set. */
export async function getOrCreateDecryptoWordSelection(input: {
  readonly db: D1Database;
  readonly roomIdentity: WorkerEffectRoomIdentity;
  readonly effect: Extract<DecryptoEffect, { type: 'decrypto.words.select' }>;
}): Promise<DecryptoKeywordSets> {
  const { db, roomIdentity, effect } = input;
  const existing = await readSelection(db, roomIdentity, effect.payload);
  if (existing !== null) return existing;
  const room = await db
    .prepare(
      `SELECT id FROM rooms
       WHERE id = ? AND code = ? AND creation_id = ? AND game_type = 'decrypto' AND status = 'active'`,
    )
    .bind(roomIdentity.roomId, roomIdentity.roomCode, roomIdentity.creationId)
    .first();
  if (room === null) throw new Error('[FAIL-FAST] Decrypto word selection requires a live room');
  const words = await db
    .prepare(`SELECT word FROM decrypto_words WHERE status = 'active' ORDER BY random() LIMIT 8`)
    .all<{ word: string }>();
  const selectedWords = z.array(z.strictObject({ word: z.string().min(1) })).parse(words.results);
  if (selectedWords.length < 8)
    throw new Error('[FAIL-FAST] Decrypto requires at least eight active keywords');
  const uniqueWords = [...new Set(selectedWords.map(({ word }) => word.trim()))];
  if (uniqueWords.length !== 8)
    throw new Error('[FAIL-FAST] Decrypto inventory contains duplicate active keywords');
  const keywords = keywordSetsSchema.parse({
    blue: uniqueWords.slice(0, 4),
    purple: uniqueWords.slice(4, 8),
  });
  await db
    .prepare(
      `INSERT INTO decrypto_round_word_selections
         (room_id, room_creation_id, game_sequence, request_id, keywords_json, selected_at)
       SELECT id, ?, ?, ?, ?, ?
       FROM rooms
       WHERE id = ? AND code = ? AND creation_id = ? AND game_type = 'decrypto' AND status = 'active'
       ON CONFLICT (room_id, game_sequence) DO NOTHING`,
    )
    .bind(
      roomIdentity.creationId,
      effect.payload.gameSequence,
      effect.payload.requestId,
      JSON.stringify(keywords),
      new Date().toISOString(),
      roomIdentity.roomId,
      roomIdentity.roomCode,
      roomIdentity.creationId,
    )
    .run();
  const selected = await readSelection(db, roomIdentity, effect.payload);
  if (selected === null) throw new Error('[FAIL-FAST] Decrypto keyword snapshot was not committed');
  return selected;
}
