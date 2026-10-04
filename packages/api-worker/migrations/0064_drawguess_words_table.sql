-- DrawGuess word bank table (idempotent).
--
-- This was originally in 0062_drawguess.sql bundled with the rooms table
-- rebuild. Split out so the word bank exists even if the complex rebuild
-- has issues on a given environment. CREATE TABLE IF NOT EXISTS makes
-- this safe to run after 0062 (no-op if already created).
CREATE TABLE IF NOT EXISTS drawguess_words (
  id TEXT PRIMARY KEY, -- 词条唯一 ID
  word TEXT NOT NULL UNIQUE, -- 题目：2-8 个简体汉字，具象名词优先
  pinyin_initials TEXT NOT NULL, -- 拼音首字母串，与 word 等长
  category TEXT NOT NULL, -- 分类（如 动物/食物/日用品），用于出题多样性
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')), -- 难度
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')), -- 上架状态；disabled 不参与出题
  created_at TEXT NOT NULL, -- 入库时间（ISO8601）
  disabled_at TEXT, -- 下架时间；active 时为 NULL
  CHECK (
    (status = 'active' AND disabled_at IS NULL) OR
    (status = 'disabled' AND disabled_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_drawguess_words_status ON drawguess_words(status);
