/** Evidence upkeep for claimed fib word candidates; storage and claiming live in wordPublication. */
import { parseFibWordEditorialCandidate } from './wordProviders/candidate';
import type { FibWordEditorialCandidate } from './wordProviders/types';
import type { FibWordPack } from './wordPublication';

/** Preserve successful verification across a later provider failure without changing the claim. */
export async function updateFibWordCandidateEvidence(
  db: D1Database,
  pack: FibWordPack,
  candidate: FibWordEditorialCandidate,
): Promise<void> {
  const parsed = parseFibWordEditorialCandidate(candidate);
  const result = await db
    .prepare(
      `UPDATE fib_word_candidates SET evidence_json = ? WHERE word = ? AND claimed_pack_id = ?
       AND status = 'claimed' AND EXISTS (
         SELECT 1 FROM fib_word_packs WHERE id = ? AND request_token = ? AND status = 'reserved'
       )`,
    )
    .bind(JSON.stringify(parsed.evidence), parsed.word, pack.id, pack.id, pack.request_token)
    .run();
  if (result.meta.changes !== 1) throw new Error('Fib evidence update lost its candidate claim');
}
