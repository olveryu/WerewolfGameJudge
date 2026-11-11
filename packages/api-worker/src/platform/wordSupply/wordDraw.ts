/**
 * Shared word draw: the one random, never-repeat-per-account draw behind every word game.
 *
 * This module only knows integer ordinals and the two platform tables
 * (`word_draw_index`, `word_seen`). It never reads a word table: each game
 * passes a loader for its own table, so word sources cannot be mixed here.
 * A draw reads one index row plus one row per participant, whatever the size
 * of the word pool and however much of it the table has already seen.
 */

import { type Rng, secureRng } from '@game-judge/game-engine/platform/random';
import { z } from 'zod';

import {
  decodeDrawMembers,
  decodeSeenOrdinals,
  pickDrawOrdinals,
  type SeenOrdinals,
  type WordSeenPolicy,
} from './wordDrawSets';

/** Word sources; each one maps to exactly one game-owned word table. */
type WordDrawPool = 'fibking' | 'undercover' | 'drawguess';

/** The partition holding every drawable word of a pool. */
export const WORD_DRAW_ALL_PARTITION = 'all';

/** A SQL predicate with its bound values, composed into a caller's statement. */
export interface SqlCondition {
  readonly sql: string;
  readonly params: readonly (string | number)[];
}

/** One drawn word: its stable ordinal and the game-owned content loaded for it. */
export interface WordDrawPick<TItem> {
  readonly ordinal: number;
  readonly item: TItem;
}

export interface DrawWordsInput<TItem> {
  readonly db: D1Database;
  readonly pool: WordDrawPool;
  /** `WORD_DRAW_ALL_PARTITION`, or a pool-specific partition such as an undercover category. */
  readonly partition: string;
  /** Accounts whose seen records filter the draw. */
  readonly participantUserIds: readonly string[];
  /** Words wanted; fewer are returned when the pool cannot supply them. */
  readonly count: number;
  readonly seenPolicy: WordSeenPolicy;
  /**
   * Game-owned content lookup. Returns only ordinals that are currently
   * drawable and acceptable to the game; omitted ordinals are redrawn.
   */
  readonly loadItems: (ordinals: readonly number[]) => Promise<ReadonlyMap<number, TItem>>;
  /** Random source; defaults to Web Crypto. */
  readonly rng?: Rng;
}

export type DrawWordsResult<TItem> =
  | {
      readonly kind: 'drawn';
      readonly picks: readonly WordDrawPick<TItem>[];
      /** Fingerprint of the participants' seen records as read by this draw. */
      readonly seenVersion: number;
    }
  | {
      readonly kind: 'exhausted';
      /** Drawable words in the partition; zero means the partition is empty. */
      readonly poolSize: number;
    };

const MAX_LOAD_ROUNDS = 8;
const MAX_LOAD_BATCH = 64;
const MAX_COMMIT_ATTEMPTS = 4;

const indexRowSchema = z.strictObject({ members: z.string() });
const seenRowSchema = z.strictObject({ seen: z.string() });

function normalizeUserIds(userIds: readonly string[]): readonly string[] {
  const normalized = [...new Set(userIds)].sort();
  if (normalized.some((userId) => userId.length === 0)) {
    throw new Error('[FAIL-FAST] Word draw user IDs must be non-empty');
  }
  return normalized;
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

interface DrawState {
  readonly members: readonly number[];
  readonly seenByParticipant: readonly SeenOrdinals[];
  readonly seenVersion: number;
}

async function readDrawState(
  db: D1Database,
  pool: WordDrawPool,
  partition: string,
  participantUserIds: readonly string[],
): Promise<DrawState> {
  const statements = [
    db
      .prepare('SELECT members FROM word_draw_index WHERE pool = ? AND partition_key = ?')
      .bind(pool, partition),
  ];
  if (participantUserIds.length > 0) {
    statements.push(
      db
        .prepare(
          `SELECT seen FROM word_seen WHERE pool = ? AND user_id IN (${placeholders(participantUserIds.length)})`,
        )
        .bind(pool, ...participantUserIds),
    );
  }
  const [indexResult, seenResult] = await db.batch(statements);
  const indexRow = z.array(indexRowSchema).parse(indexResult?.results ?? [])[0];
  if (indexRow === undefined) {
    throw new Error(`[FAIL-FAST] Word draw index is missing for ${pool}/${partition}`);
  }
  const seenRows = z.array(seenRowSchema).parse(seenResult?.results ?? []);
  return {
    members: decodeDrawMembers(indexRow.members),
    seenByParticipant: seenRows.map((row) => decodeSeenOrdinals(row.seen)),
    // word_seen is append-only, so the total length changes on every write.
    seenVersion: seenRows.reduce((total, row) => total + row.seen.length, 0),
  };
}

/**
 * Draw up to `count` words uniformly at random without writing anything.
 * Callers that must record the draw use {@link drawAndCommitWords}.
 */
export async function drawWords<TItem>(
  input: DrawWordsInput<TItem>,
): Promise<DrawWordsResult<TItem>> {
  if (!Number.isSafeInteger(input.count) || input.count <= 0) {
    throw new Error(`[FAIL-FAST] Word draw count must be a positive integer: ${input.count}`);
  }
  const participantUserIds = normalizeUserIds(input.participantUserIds);
  const state = await readDrawState(input.db, input.pool, input.partition, participantUserIds);
  const rng = input.rng ?? secureRng;
  const excluded = new Set<number>();
  const picks: WordDrawPick<TItem>[] = [];
  // A rejected ordinal (stale index entry, or a word the game refuses) is
  // redrawn; later rounds ask for more candidates so few rounds are needed.
  for (let round = 0; round < MAX_LOAD_ROUNDS && picks.length < input.count; round += 1) {
    const wanted = Math.min((input.count - picks.length) * 2 ** round, MAX_LOAD_BATCH);
    const ordinals = pickDrawOrdinals({
      members: state.members,
      seenByParticipant: state.seenByParticipant,
      excluded,
      count: wanted,
      seenPolicy: input.seenPolicy,
      rng,
    });
    if (ordinals.length === 0) break;
    const items = await input.loadItems(ordinals);
    for (const ordinal of ordinals) {
      excluded.add(ordinal);
      const item = items.get(ordinal);
      if (item !== undefined && picks.length < input.count) picks.push({ ordinal, item });
    }
  }
  if (picks.length === 0) return { kind: 'exhausted', poolSize: state.members.length };
  return { kind: 'drawn', picks, seenVersion: state.seenVersion };
}

function createSeenUnchangedCondition(
  pool: WordDrawPool,
  participantUserIds: readonly string[],
  seenVersion: number,
): SqlCondition {
  if (participantUserIds.length === 0) return { sql: '1 = 1', params: [] };
  return {
    sql: `(SELECT COALESCE(SUM(length(seen)), 0) FROM word_seen
      WHERE pool = ? AND user_id IN (${placeholders(participantUserIds.length)})) = ?`,
    params: [pool, ...participantUserIds, seenVersion],
  };
}

interface RecordSeenWordsInput {
  readonly db: D1Database;
  readonly pool: WordDrawPool;
  readonly userIds: readonly string[];
  readonly ordinals: readonly number[];
  /** Appends only while this predicate holds; omitted means always. */
  readonly onlyIf?: SqlCondition;
}

function createRecordSeenWordsStatements(input: RecordSeenWordsInput): D1PreparedStatement[] {
  const userIds = normalizeUserIds(input.userIds);
  if (userIds.length === 0) return [];
  const onlyIf = input.onlyIf ?? { sql: '1 = 1', params: [] };
  return input.ordinals.map((ordinal) => {
    if (!Number.isSafeInteger(ordinal) || ordinal <= 0) {
      throw new Error(`[FAIL-FAST] Word draw ordinal must be a positive integer: ${ordinal}`);
    }
    // Bound as text: the token is concatenated, and a numeric bind may render as "12.0".
    const token = String(ordinal);
    return input.db
      .prepare(
        `INSERT INTO word_seen (user_id, pool, seen)
         SELECT participant.column1, ?, ',' || ? || ','
         FROM (VALUES ${userIds.map(() => '(?)').join(', ')}) AS participant
         WHERE ${onlyIf.sql}
         ON CONFLICT (user_id, pool) DO UPDATE SET seen = word_seen.seen || ? || ','
         WHERE instr(word_seen.seen, ',' || ? || ',') = 0`,
      )
      .bind(input.pool, token, ...userIds, ...onlyIf.params, token, token);
  });
}

/**
 * Mark words as seen by the given accounts; repeating a call changes nothing.
 * Every account must exist: an unknown one fails the whole write (foreign key).
 */
export async function recordSeenWords(input: RecordSeenWordsInput): Promise<void> {
  const statements = createRecordSeenWordsStatements(input);
  if (statements.length > 0) await input.db.batch(statements);
}

export interface DrawAndCommitWordsInput<TItem, TSnapshot> extends DrawWordsInput<TItem> {
  /** Read the game-owned snapshot of this draw after a commit, or null when none is stored. */
  readonly readSnapshot: () => Promise<TSnapshot | null>;
  /**
   * Build the game-owned snapshot insert. It must be a no-op on conflict and
   * must apply `seenUnchanged`, which fails the insert when a participant's
   * seen record changed after this draw read it.
   */
  readonly createSnapshotStatement: (
    picks: readonly WordDrawPick<TItem>[],
    seenUnchanged: SqlCondition,
  ) => D1PreparedStatement;
  /** Predicate that holds only when the snapshot stored for this draw is these picks. */
  readonly snapshotCommittedCondition: (picks: readonly WordDrawPick<TItem>[]) => SqlCondition;
}

export type DrawAndCommitWordsResult<TSnapshot> =
  | { readonly kind: 'committed'; readonly snapshot: TSnapshot }
  | { readonly kind: 'exhausted'; readonly poolSize: number };

/**
 * Draw words and record them atomically: the game's snapshot and every
 * participant's seen record are written in one D1 transaction, or not at all.
 * Callers replay a stored snapshot before calling this, so retries never draw
 * twice. A concurrent draw that touched a participant makes this one redraw,
 * which keeps "never repeat per account" exact.
 */
export async function drawAndCommitWords<TItem, TSnapshot>(
  input: DrawAndCommitWordsInput<TItem, TSnapshot>,
): Promise<DrawAndCommitWordsResult<TSnapshot>> {
  const participantUserIds = normalizeUserIds(input.participantUserIds);
  for (let attempt = 0; attempt < MAX_COMMIT_ATTEMPTS; attempt += 1) {
    const drawn = await drawWords(input);
    if (drawn.kind === 'exhausted') return drawn;
    await input.db.batch([
      input.createSnapshotStatement(
        drawn.picks,
        createSeenUnchangedCondition(input.pool, participantUserIds, drawn.seenVersion),
      ),
      ...createRecordSeenWordsStatements({
        db: input.db,
        pool: input.pool,
        userIds: participantUserIds,
        ordinals: drawn.picks.map((pick) => pick.ordinal),
        onlyIf: input.snapshotCommittedCondition(drawn.picks),
      }),
    ]);
    const stored = await input.readSnapshot();
    if (stored !== null) return { kind: 'committed', snapshot: stored };
  }
  throw new Error(
    `[FAIL-FAST] ${input.pool} word draw could not commit after ${MAX_COMMIT_ATTEMPTS} attempts`,
  );
}
