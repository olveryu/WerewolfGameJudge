-- Add an independent editorial-review ledger before generated FibKing words become active.

ALTER TABLE fib_word_generation_cycles
  ADD COLUMN rejected_count INTEGER NOT NULL DEFAULT 0 CHECK (rejected_count >= 0);

CREATE TABLE fib_word_candidate_reviews (
  word                TEXT PRIMARY KEY,
  core_meaning        TEXT NOT NULL,
  usage_note          TEXT NOT NULL,
  category            TEXT NOT NULL CHECK (category IN ('literary', 'internet', 'compound', 'niche')),
  source              TEXT NOT NULL CHECK (source IN ('local', 'gemini')),
  decision            TEXT NOT NULL CHECK (decision IN ('accepted', 'rejected')),
  reason              TEXT NOT NULL CHECK (length(reason) > 0),
  generation_cycle_id TEXT NOT NULL,
  reviewed_at         TEXT NOT NULL,
  FOREIGN KEY (generation_cycle_id) REFERENCES fib_word_generation_cycles(id) ON DELETE RESTRICT
);

CREATE INDEX idx_fib_word_candidate_reviews_decision_reviewed
  ON fib_word_candidate_reviews(decision, reviewed_at);

UPDATE fib_word_generation_cycles
SET status = 'failed',
    completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    error_code = 'quality_review_upgrade'
WHERE status = 'running';

UPDATE fib_word_supply_state
SET active_cycle_id = NULL,
    active_cycle_started_at = NULL,
    lease_owner = NULL,
    lease_expires_at = NULL,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 1 AND active_cycle_id IS NOT NULL;

UPDATE fib_words
SET status = 'disabled',
    disabled_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    status_reason = 'quality_review: common_or_transparent'
WHERE status = 'active'
  AND word IN (
    '回光返照', '抛砖引玉', '破天荒', '下马威', '替罪羊', '走马观花', '走后门',
    '抛绣球', '走马灯', '雁过拔毛', '吃小灶', '电子宠物', '社恐', '带节奏',
    '柠檬精', '打工人', '氛围感', '情绪价值', '社死', '干饭人', '工具人',
    '躺平', '硬核', '杠精', '工具箱', '吃瓜群众', '内卷', '特种兵式旅游',
    '云养', '纸上谈兵', '画蛇添足', '卧薪尝胆', '清流', '落魄', '胸有成竹',
    '倒腾', '白眼', '勾当', '买椟还珠', '望梅止渴', '压岁钱', '压舱石',
    '抱薪救火', '嚼舌头', '跑马灯', '跑堂'
  );