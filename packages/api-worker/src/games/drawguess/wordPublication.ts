/** Transactional editorial queue and publication; word identity survives reviews and retirement. */
import { DRAWGUESS_WORD_CATEGORIES } from '@game-judge/game-engine/games/drawguess/public';
import { z } from 'zod';

import {
  createClaimWordCandidatesStatement,
  createWordPackId,
  failWordPack,
  insertReservedWordPack,
  publishReviewedWordPack,
} from '../../platform/wordSupply/wordPackLedger';
import {
  DRAWGUESS_WORD_BATCH_LIMIT,
  DRAWGUESS_WORD_PROMPT_VERSION,
  DRAWGUESS_WORD_REVIEW_VERSION,
  type DrawGuessWordCandidate,
  type DrawGuessWordReview,
  getDrawGuessWordId,
  isDrawGuessReviewAccepted,
  parseDrawGuessCandidates,
  parseDrawGuessReviews,
  toPinyinInitials,
} from './wordEditorial';
import { DRAWGUESS_WORD_MODEL } from './wordProvider';

export const DRAWGUESS_DAILY_BATCH_LIMIT = 2;
const packSchema = z.strictObject({
  id: z.string(),
  category: z.enum(DRAWGUESS_WORD_CATEGORIES),
  request_token: z.string(),
});
export type DrawGuessWordPack = z.output<typeof packSchema>;

/** Reserve the category with the fewest active words, so supply stays balanced. */
export async function reserveDrawGuessWordPack(
  db: D1Database,
  day: string,
  batchIndex: number,
  opts: { force?: boolean; runId?: string } = {},
): Promise<DrawGuessWordPack | null> {
  z.iso.date().parse(day);
  const maxIndex = opts.force ? Number.MAX_SAFE_INTEGER : DRAWGUESS_DAILY_BATCH_LIMIT - 1;
  z.int().min(0).max(maxIndex).parse(batchIndex);
  const categoryRows = await db
    .prepare(
      `SELECT value AS category,
        (SELECT COUNT(*) FROM drawguess_words w WHERE w.category = c.value AND w.status = 'active') AS active_count
      FROM (SELECT value FROM json_each(?)) c
      ORDER BY active_count ASC, category ASC LIMIT 1`,
    )
    .bind(JSON.stringify(DRAWGUESS_WORD_CATEGORIES))
    .first();
  const { category } = packSchema
    .pick({ category: true })
    .extend({ active_count: z.int() })
    .parse(categoryRows);
  const row = await insertReservedWordPack(db, {
    packsTable: 'drawguess_word_packs',
    packId: createWordPackId(day, batchIndex, opts),
    category,
    model: DRAWGUESS_WORD_MODEL,
    promptVersion: DRAWGUESS_WORD_PROMPT_VERSION,
    reviewVersion: DRAWGUESS_WORD_REVIEW_VERSION,
  });
  return row === null ? null : packSchema.parse(row);
}

/** Persist validated generated material without duplicating any previously reviewed identity. */
export async function storeDrawGuessWordCandidates(
  db: D1Database,
  pack: DrawGuessWordPack,
  candidates: readonly DrawGuessWordCandidate[],
): Promise<void> {
  const parsed = parseDrawGuessCandidates({ candidates }, pack.category);
  const statements: D1PreparedStatement[] = [];
  for (const candidate of parsed) {
    statements.push(
      db
        .prepare(
          `INSERT INTO drawguess_word_candidates (id, word, category, difficulty, material_json, status, created_at)
      SELECT ?, ?, ?, ?, ?, 'pending', ? FROM drawguess_word_packs WHERE id = ? AND request_token = ? AND status = 'reserved'
      ON CONFLICT (id) DO NOTHING`,
        )
        .bind(
          await getDrawGuessWordId(candidate.word),
          candidate.word,
          candidate.category,
          candidate.difficulty,
          JSON.stringify(candidate),
          new Date().toISOString(),
          pack.id,
          pack.request_token,
        ),
    );
  }
  if (statements.length > 0) await db.batch(statements);
}

/** Claim pending material; crashed requests leave the prior inventory intact. */
export async function getDrawGuessReviewCandidates(
  db: D1Database,
  pack: DrawGuessWordPack,
): Promise<DrawGuessWordCandidate[]> {
  const rows = await createClaimWordCandidatesStatement(
    db,
    'drawguess_word_packs',
    pack,
    DRAWGUESS_WORD_BATCH_LIMIT,
  ).all();
  const candidates = rows.results.map((row) => {
    const { material_json } = z.strictObject({ material_json: z.string() }).parse(row);
    const value: unknown = JSON.parse(material_json);
    return value;
  });
  return parseDrawGuessCandidates({ candidates }, pack.category);
}

/**
 * Publish accepted words into drawguess_words (pinyin initials generated here),
 * retire rejected ones, in the same replay-safe transaction.
 */
export async function publishDrawGuessWordPack(
  db: D1Database,
  pack: DrawGuessWordPack,
  candidates: readonly DrawGuessWordCandidate[],
  reviews: readonly DrawGuessWordReview[],
): Promise<void> {
  const parsedCandidates = parseDrawGuessCandidates({ candidates }, pack.category);
  const parsedReviews = parseDrawGuessReviews({ reviews }, parsedCandidates);
  await publishReviewedWordPack(
    db,
    'drawguess_word_packs',
    pack,
    parsedCandidates,
    parsedReviews,
    async (candidate, review, now) => {
      const id = await getDrawGuessWordId(candidate.word);
      let pinyinInitials: string | null = null;
      try {
        pinyinInitials = toPinyinInitials(candidate.word);
      } catch {
        // 拼音解析失败（无声母字等）视为不合格，不进词库。
        pinyinInitials = null;
      }
      const isAccepted = pinyinInitials !== null && isDrawGuessReviewAccepted(review);
      const reviewJson = JSON.stringify({
        reviewVersion: DRAWGUESS_WORD_REVIEW_VERSION,
        promptVersion: DRAWGUESS_WORD_PROMPT_VERSION,
        packId: pack.id,
        pinyinInitials,
        review,
      });
      const inventoryStatement =
        isAccepted && pinyinInitials !== null
          ? db
              .prepare(
                `INSERT INTO drawguess_words (id, word, pinyin_initials, category, difficulty, status, created_at, disabled_at)
        SELECT ?, ?, ?, ?, ?, 'active', ?, NULL FROM drawguess_word_candidates candidate
        WHERE candidate.id = ? AND candidate.claimed_pack_id = ? AND candidate.status = 'accepted'
          AND EXISTS (SELECT 1 FROM drawguess_word_packs WHERE id = ? AND request_token = ? AND status = 'reserved')
        ON CONFLICT (id) DO UPDATE SET pinyin_initials = excluded.pinyin_initials, category = excluded.category,
          difficulty = excluded.difficulty, status = 'active', disabled_at = NULL`,
              )
              .bind(
                id,
                candidate.word,
                pinyinInitials,
                candidate.category,
                candidate.difficulty,
                now,
                id,
                pack.id,
                pack.id,
                pack.request_token,
              )
          : db
              .prepare(
                `UPDATE drawguess_words SET status = 'disabled', disabled_at = ?
        WHERE id = ? AND status = 'active'
          AND EXISTS (SELECT 1 FROM drawguess_word_candidates WHERE id = ? AND claimed_pack_id = ? AND status = 'rejected')
          AND EXISTS (SELECT 1 FROM drawguess_word_packs WHERE id = ? AND request_token = ? AND status = 'reserved')`,
              )
              .bind(now, id, id, pack.id, pack.id, pack.request_token);
      return { id, isAccepted, reviewJson, inventoryStatement };
    },
  );
}

/** Record failure without disabling inventory or discarding the unreviewed queue. */
export async function failDrawGuessWordPack(
  db: D1Database,
  pack: DrawGuessWordPack,
  reason: string,
): Promise<void> {
  await failWordPack(db, 'drawguess_word_packs', pack, reason);
}
