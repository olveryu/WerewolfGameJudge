/** Idempotent pair allocation through the shared word draw; retries replay the per-round snapshot. */

import {
  UNDERCOVER_CATEGORIES,
  type UndercoverEffect,
  type UndercoverWordPair,
} from '@game-judge/game-engine/games/undercover/public';
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import { z } from 'zod';

import { sha256Hex } from '../../platform/crypto/sha256Hex';
import type { WorkerEffectRoomIdentity } from '../../platform/gameModules/runtimeGameModule';
import {
  drawAndCommitWords,
  type SqlCondition,
  WORD_DRAW_ALL_PARTITION,
  type WordDrawPick,
} from '../../platform/wordSupply/wordDraw';
import { undercoverWordPairSchema } from './schemas';

export interface SelectUndercoverWordInput {
  readonly db: D1Database;
  readonly roomIdentity: WorkerEffectRoomIdentity;
  readonly effect: Extract<UndercoverEffect, { type: 'undercover.word.select' }>;
  /** Accounts at the table; a pair any of them has seen is not dealt again. */
  readonly participantUserIds: readonly string[];
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

const poolPairRowSchema = z.strictObject({
  ordinal: z.int().positive(),
  id: z.string().min(1),
  word_a: z.string().min(1),
  word_b: z.string().min(1),
  category: z.enum(UNDERCOVER_CATEGORIES),
  status: z.enum(['active', 'disabled']),
});
type UndercoverPoolPair = z.output<typeof poolPairRowSchema>;

/**
 * Load active pairs by draw ordinal, minus the pairs this room asked to avoid.
 * The query filters on the ordinal alone: with a status predicate the planner
 * prefers the status index for multi-ordinal lookups and reads every active pair.
 */
async function loadUndercoverPoolPairs(
  db: D1Database,
  ordinals: readonly number[],
  avoidWordPairIds: readonly string[],
): Promise<ReadonlyMap<number, UndercoverPoolPair>> {
  const result = await db
    .prepare(
      `SELECT draw_ordinal AS ordinal, id, word_a, word_b, category, status
       FROM undercover_word_pairs
       WHERE draw_ordinal IN (${ordinals.map(() => '?').join(', ')})`,
    )
    .bind(...ordinals)
    .all();
  const avoided = new Set(avoidWordPairIds);
  const pairs = new Map<number, UndercoverPoolPair>();
  for (const row of z.array(poolPairRowSchema).parse(result.results)) {
    if (row.status === 'active' && !avoided.has(row.id)) pairs.set(row.ordinal, row);
  }
  return pairs;
}

function singlePick(
  picks: readonly WordDrawPick<UndercoverPoolPair>[],
): WordDrawPick<UndercoverPoolPair> {
  const pick = picks[0];
  if (pick === undefined || picks.length !== 1) {
    throw new Error('[FAIL-FAST] Undercover allocation draws exactly one pair');
  }
  return pick;
}

function createSnapshotStatement(
  input: SelectUndercoverWordInput,
  requestFingerprint: string,
  picks: readonly WordDrawPick<UndercoverPoolPair>[],
  seenUnchanged: SqlCondition,
): D1PreparedStatement {
  const { roomIdentity, effect, db } = input;
  const pair = singlePick(picks).item;
  return db
    .prepare(
      `INSERT INTO undercover_round_word_selections (
         room_id, room_creation_id, round_id, request_fingerprint, word_pair_id, word_a, word_b, category, selected_at
       ) SELECT room.id, room.creation_id, ?, ?, ?, ?, ?, ?, ?
       FROM rooms AS room
       WHERE room.id = ? AND room.code = ? AND room.creation_id = ? AND room.game_type = 'undercover'
         AND ${seenUnchanged.sql}
       ON CONFLICT (room_id, round_id) DO NOTHING`,
    )
    .bind(
      effect.payload.roundId,
      requestFingerprint,
      pair.id,
      pair.word_a,
      pair.word_b,
      pair.category,
      new Date().toISOString(),
      roomIdentity.roomId,
      roomIdentity.roomCode,
      roomIdentity.creationId,
      ...seenUnchanged.params,
    );
}

function snapshotCommittedCondition(
  input: SelectUndercoverWordInput,
  requestFingerprint: string,
  picks: readonly WordDrawPick<UndercoverPoolPair>[],
): SqlCondition {
  return {
    sql: `EXISTS (SELECT 1 FROM undercover_round_word_selections
      WHERE room_id = ? AND round_id = ? AND request_fingerprint = ? AND word_pair_id = ?)`,
    params: [
      input.roomIdentity.roomId,
      input.effect.payload.roundId,
      requestFingerprint,
      singlePick(picks).item.id,
    ],
  };
}

/**
 * Deal one random pair no participant has seen and mark it seen for all of
 * them in one D1 transaction. With permission to repeat, a seen pair is dealt
 * only when no unseen one is left. Aborted rounds do not un-see their pair.
 */
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
  const shouldAllowRepeated = effect.payload.shouldAllowRepeated;
  const result = await drawAndCommitWords({
    db,
    pool: 'undercover',
    partition:
      effect.payload.category === 'all' ? WORD_DRAW_ALL_PARTITION : effect.payload.category,
    participantUserIds: input.participantUserIds,
    count: 1,
    seenPolicy: shouldAllowRepeated ? 'preferUnseen' : 'excludeSeen',
    loadItems: (ordinals) =>
      loadUndercoverPoolPairs(
        db,
        ordinals,
        shouldAllowRepeated ? [] : effect.payload.avoidWordPairIds,
      ),
    readSnapshot: () => readSelection(input, requestFingerprint),
    createSnapshotStatement: (picks, seenUnchanged) =>
      createSnapshotStatement(input, requestFingerprint, picks, seenUnchanged),
    snapshotCommittedCondition: (picks) =>
      snapshotCommittedCondition(input, requestFingerprint, picks),
  });
  if (result.kind === 'exhausted') {
    throw new UndercoverWordInventoryExhaustedError(
      result.poolSize === 0 ? 'inventoryEmpty' : 'inventoryExhausted',
    );
  }
  return result.snapshot;
}
