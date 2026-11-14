-- Zero-initial syllables (鹅, 安, 尔, …) used to have no pinyin hint, so publication rejected
-- words whose independent review had passed every quality check. The hint now falls back to the
-- first pinyin letter. Return exactly those candidates to the review queue; they were never
-- published, so inventory, draw ordinals and seen records are untouched. The original review of
-- each candidate stays in its pack's reviews_json.
UPDATE drawguess_word_candidates
SET status = 'pending', claimed_pack_id = NULL, reviewed_at = NULL, review_json = NULL
WHERE status = 'rejected'
  AND json_extract(review_json, '$.pinyinInitials') IS NULL
  AND json_extract(review_json, '$.review.qualityChecks.isConcreteAndDrawable') = 1
  AND json_extract(review_json, '$.review.qualityChecks.isSimplifiedChinese') = 1
  AND json_extract(review_json, '$.review.qualityChecks.isLengthValid') = 1
  AND json_extract(review_json, '$.review.qualityChecks.isCategoryAccurate') = 1
  AND json_extract(review_json, '$.review.qualityChecks.isAppropriate') = 1
  AND json_extract(review_json, '$.review.qualityChecks.isUnambiguous') = 1;
