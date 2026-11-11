/** Idempotent question allocation through the shared word draw; retries replay the stored snapshot. */

import {
  FIB_WORD_SOURCES,
  type FibSelectWordEffect,
} from '@game-judge/game-engine/games/fibking/public';
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

/** Expected terminal result: every published question has been seen by someone at the table. */
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

const poolWordRowSchema = z.strictObject({
  ordinal: z.int().positive(),
  word_id: z.string().min(1),
  word: z.string().min(1),
  core_meaning: z.string(),
  usage_note: z.string(),
  source: z.enum(FIB_WORD_SOURCES),
  status: z.enum(['active', 'disabled']),
});
type FibPoolWord = z.output<typeof poolWordRowSchema>;

/**
 * Load active questions by draw ordinal (the publication sequence number),
 * minus avoided words. The query starts from the sequence rows and filters on
 * the ordinal alone: CROSS JOIN pins that join order, and a status predicate
 * would let the planner start from the status index and read every active word.
 */
async function loadFibPoolWords(
  db: D1Database,
  ordinals: readonly number[],
  avoidWords: readonly string[],
): Promise<ReadonlyMap<number, FibPoolWord>> {
  const result = await db
    .prepare(
      `SELECT sequence.id AS ordinal, word_entry.id AS word_id, word_entry.word,
         word_entry.core_meaning, word_entry.usage_note, word_entry.source, word_entry.status
       FROM fib_word_sequence AS sequence
       CROSS JOIN fib_words AS word_entry ON word_entry.word = sequence.word
       WHERE sequence.id IN (${ordinals.map(() => '?').join(', ')})`,
    )
    .bind(...ordinals)
    .all();
  const avoided = new Set(avoidWords);
  const words = new Map<number, FibPoolWord>();
  for (const row of z.array(poolWordRowSchema).parse(result.results)) {
    if (row.status === 'active' && !avoided.has(row.word)) words.set(row.ordinal, row);
  }
  return words;
}

interface FibSnapshotContext {
  readonly input: SelectFibWordInput;
  readonly requestFingerprint: string;
  readonly serializedUserIds: string;
}

function singlePick(picks: readonly WordDrawPick<FibPoolWord>[]): WordDrawPick<FibPoolWord> {
  const pick = picks[0];
  if (pick === undefined || picks.length !== 1) {
    throw new Error('[FAIL-FAST] Fib allocation draws exactly one question');
  }
  return pick;
}

function createSnapshotStatement(
  context: FibSnapshotContext,
  picks: readonly WordDrawPick<FibPoolWord>[],
  seenUnchanged: SqlCondition,
): D1PreparedStatement {
  const { input } = context;
  const pick = singlePick(picks);
  return input.db
    .prepare(
      `INSERT INTO fib_round_word_selections (
         room_id, room_creation_id, effect_id, round_id, request_fingerprint,
         word_id, word, core_meaning, usage_note, source, selection_tier, selected_at,
         sequence_number, participant_user_ids
       ) SELECT room.id, room.creation_id, ?, ?, ?, ?, ?, ?, ?, ?, 'any_unseen', ?, ?, ?
       FROM rooms AS room
       WHERE room.id = ? AND room.code = ? AND room.creation_id = ? AND ${seenUnchanged.sql}
       ON CONFLICT (room_id, effect_id) DO NOTHING`,
    )
    .bind(
      input.effectId,
      input.effect.payload.roundId,
      context.requestFingerprint,
      pick.item.word_id,
      pick.item.word,
      pick.item.core_meaning,
      pick.item.usage_note,
      pick.item.source,
      new Date().toISOString(),
      pick.ordinal,
      context.serializedUserIds,
      input.roomIdentity.roomId,
      input.roomIdentity.roomCode,
      input.roomIdentity.creationId,
      ...seenUnchanged.params,
    );
}

function snapshotCommittedCondition(
  context: FibSnapshotContext,
  picks: readonly WordDrawPick<FibPoolWord>[],
): SqlCondition {
  return {
    sql: `EXISTS (SELECT 1 FROM fib_round_word_selections
      WHERE room_id = ? AND effect_id = ? AND request_fingerprint = ? AND sequence_number = ?)`,
    params: [
      context.input.roomIdentity.roomId,
      context.input.effectId,
      context.requestFingerprint,
      singlePick(picks).ordinal,
    ],
  };
}

/**
 * Select one random question no participant has seen and mark it seen for all
 * of them in one D1 transaction; cancellation intentionally does not un-see it.
 */
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
  const context: FibSnapshotContext = { input, requestFingerprint, serializedUserIds };
  const result = await drawAndCommitWords({
    db: input.db,
    pool: 'fibking',
    partition: WORD_DRAW_ALL_PARTITION,
    participantUserIds,
    count: 1,
    seenPolicy: 'excludeSeen',
    loadItems: (ordinals) => loadFibPoolWords(input.db, ordinals, input.effect.payload.avoidWords),
    readSnapshot: () => readSelection(input),
    createSnapshotStatement: (picks, seenUnchanged) =>
      createSnapshotStatement(context, picks, seenUnchanged),
    snapshotCommittedCondition: (picks) => snapshotCommittedCondition(context, picks),
  });
  if (result.kind === 'exhausted') throw new FibWordInventoryExhaustedError();
  return parseMatchingSelection(result.snapshot, input, requestFingerprint);
}
