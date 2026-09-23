/** Atomic room-scoped pair allocation; retries replay immutable per-round snapshots. */

import {
  UNDERCOVER_CATEGORIES,
  type UndercoverEffect,
  type UndercoverWordPair,
} from '@game-judge/game-engine/games/undercover/public';
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import { z } from 'zod';

import { sha256Hex } from '../../platform/crypto/sha256Hex';
import type { WorkerEffectRoomIdentity } from '../../platform/gameModules/runtimeGameModule';
import { undercoverWordPairSchema } from './schemas';

export interface SelectUndercoverWordInput {
  readonly db: D1Database;
  readonly roomIdentity: WorkerEffectRoomIdentity;
  readonly effect: Extract<UndercoverEffect, { type: 'undercover.word.select' }>;
}

/** Explicit exhaustion; callers must ask permission before repeating a pair. */
export class UndercoverWordInventoryExhaustedError extends Error {
  constructor(readonly failureCode: 'inventoryEmpty' | 'inventoryExhausted') {
    super('Undercover word inventory exhausted');
    this.name = 'UndercoverWordInventoryExhaustedError';
  }
}

const selectionRowSchema = z.strictObject({
  room_creation_id: z.string().min(1),
  request_fingerprint: z.string().length(64),
  word_pair_id: z.string().min(1),
  word_a: z.string().min(1),
  word_b: z.string().min(1),
  category: z.enum(UNDERCOVER_CATEGORIES),
});

async function readSelection(input: SelectUndercoverWordInput, requestFingerprint: string) {
  const row = await input.db
    .prepare(
      `SELECT room_creation_id, request_fingerprint, word_pair_id, word_a, word_b, category
     FROM undercover_round_word_selections WHERE room_id = ? AND round_id = ?`,
    )
    .bind(input.roomIdentity.roomId, input.effect.payload.roundId)
    .first();
  if (row === null) return null;
  const selection = selectionRowSchema.parse(row);
  if (
    selection.room_creation_id !== input.roomIdentity.creationId ||
    selection.request_fingerprint !== requestFingerprint
  ) {
    throw new Error('[FAIL-FAST] Undercover word selection identity conflict');
  }
  return undercoverWordPairSchema.parse({
    id: selection.word_pair_id,
    wordA: selection.word_a,
    wordB: selection.word_b,
    category: selection.category,
  });
}

/** Persist before dispatch; aborted selections remain part of the room's used-pair history. */
export async function getOrCreateUndercoverWordSelection(
  input: SelectUndercoverWordInput,
): Promise<UndercoverWordPair> {
  const { roomIdentity, effect, db } = input;
  const requestFingerprint = await sha256Hex(
    canonicalJson({
      ...effect.payload,
      avoidWordPairIds: [...new Set(effect.payload.avoidWordPairIds)].sort(),
    }),
  );
  const existing = await readSelection(input, requestFingerprint);
  if (existing !== null) return existing;
  const room = await db
    .prepare('SELECT id FROM rooms WHERE id = ? AND code = ? AND creation_id = ? AND game_type = ?')
    .bind(roomIdentity.roomId, roomIdentity.roomCode, roomIdentity.creationId, 'undercover')
    .first();
  if (room === null) throw new Error('[FAIL-FAST] Undercover allocation requires a live room');
  await db
    .prepare(
      `INSERT INTO undercover_round_word_selections (
      room_id, room_creation_id, round_id, request_fingerprint, word_pair_id, word_a, word_b, category, selected_at
    ) SELECT room.id, room.creation_id, ?, ?, pair.id, pair.word_a, pair.word_b, pair.category, ?
      FROM undercover_word_pairs AS pair
      INNER JOIN rooms AS room ON room.id = ? AND room.code = ? AND room.creation_id = ? AND room.game_type = 'undercover'
      WHERE pair.status = 'active' AND (? = 'all' OR pair.category = ?)
      AND (? = 1 OR (
        NOT EXISTS (SELECT 1 FROM json_each(?) AS avoided WHERE avoided.value = pair.id)
        AND NOT EXISTS (SELECT 1 FROM undercover_round_word_selections AS previous
          WHERE previous.room_id = room.id AND previous.room_creation_id = room.creation_id AND previous.word_pair_id = pair.id)
      ))
      ORDER BY random() LIMIT 1
      ON CONFLICT (room_id, round_id) DO NOTHING`,
    )
    .bind(
      effect.payload.roundId,
      requestFingerprint,
      new Date().toISOString(),
      roomIdentity.roomId,
      roomIdentity.roomCode,
      roomIdentity.creationId,
      effect.payload.category,
      effect.payload.category,
      Number(effect.payload.shouldAllowRepeated),
      JSON.stringify(effect.payload.avoidWordPairIds),
    )
    .run();
  const stored = await readSelection(input, requestFingerprint);
  if (stored === null) {
    const available = await db
      .prepare(
        "SELECT id FROM undercover_word_pairs WHERE status = 'active' AND (? = 'all' OR category = ?) LIMIT 1",
      )
      .bind(effect.payload.category, effect.payload.category)
      .first();
    throw new UndercoverWordInventoryExhaustedError(
      available === null ? 'inventoryEmpty' : 'inventoryExhausted',
    );
  }
  return stored;
}
