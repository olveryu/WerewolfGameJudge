-- DrawGuess word-supply editorial tables: pack tracking and candidate queue.
--
-- Mirrors the undercover pattern from 0057_editorial_supply.sql. Published words
-- land in drawguess_words (created by 0062_drawguess.sql); these two tables only
-- track the generation/review pipeline. No CHECK-constraint rebuild needed here.

PRAGMA defer_foreign_keys = true;

CREATE TABLE drawguess_word_packs (
  id TEXT PRIMARY KEY, -- pack id: "{day}-{batchIndex}" 或 "{day}-force-{runId}-{batchIndex}"
  category TEXT NOT NULL, -- 本包分类（DRAWGUESS_WORD_CATEGORIES 之一）
  request_token TEXT NOT NULL, -- 幂等令牌；workflow 重放时校验
  status TEXT NOT NULL CHECK (status IN ('reserved', 'published', 'failed')), -- 包状态
  model TEXT NOT NULL, -- 生成/评审用的模型名
  prompt_version TEXT NOT NULL, -- 生成 prompt 版本
  review_version TEXT NOT NULL, -- 评审 rubric 版本
  generation_json TEXT CHECK (generation_json IS NULL OR json_valid(generation_json)), -- 模型原始生成输出
  candidates_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(candidates_json)), -- 入库候选快照
  reviews_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(reviews_json)), -- 评审快照
  failure_reason TEXT, -- 失败阶段:失败原因
  created_at TEXT NOT NULL, -- 预留时间（ISO8601）
  completed_at TEXT -- 完成/失败时间；reserved 时为 NULL
);
CREATE INDEX idx_drawguess_word_packs_created ON drawguess_word_packs(created_at);

CREATE TABLE drawguess_word_candidates (
  id TEXT PRIMARY KEY, -- 词条稳定 ID: "drawguess:<sha256>"
  word TEXT NOT NULL, -- 候选词（简体，已归一化）
  category TEXT NOT NULL, -- 分类
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')), -- 绘画难度
  material_json TEXT NOT NULL CHECK (json_valid(material_json)), -- 生成材料原文
  review_json TEXT CHECK (review_json IS NULL OR json_valid(review_json)), -- 评审记录
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')), -- 评审状态
  claimed_pack_id TEXT REFERENCES drawguess_word_packs(id), -- 认领本候选的包
  created_at TEXT NOT NULL, -- 入库时间（ISO8601）
  reviewed_at TEXT, -- 评审时间；pending 时为 NULL
  UNIQUE(word)
);
CREATE INDEX idx_drawguess_word_candidates_pending ON drawguess_word_candidates(status, category);

PRAGMA defer_foreign_keys = false;
