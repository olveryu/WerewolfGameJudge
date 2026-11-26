-- DrawGuess e2e word pool fixture: 20 seed words (all active)
-- pinyin_initials must be space-separated (one per character), matching toPinyinInitials() format.
INSERT INTO drawguess_words (id, word, pinyin_initials, category, difficulty, status, created_at, disabled_at) VALUES
  ('e2e-dg-0', '苹果', 'p g', 'food', 'easy', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-1', '香蕉', 'x j', 'food', 'easy', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-2', '猫', 'm', 'animals', 'easy', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-3', '狗', 'g', 'animals', 'easy', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-4', '太阳', 't y', 'nature', 'easy', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-5', '月亮', 'y l', 'nature', 'easy', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-6', '汽车', 'q c', 'vehicles', 'easy', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-7', '飞机', 'f j', 'vehicles', 'easy', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-8', '雨伞', 'y s', 'dailyObjects', 'easy', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-9', '眼镜', 'y j', 'dailyObjects', 'easy', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-10', '大象', 'd x', 'animals', 'medium', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-11', '长颈鹿', 'c j l', 'animals', 'medium', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-12', '汉堡包', 'h b b', 'food', 'medium', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-13', '自行车', 'z x c', 'vehicles', 'medium', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-14', '洗衣机', 'x y j', 'electronics', 'medium', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-15', '圣诞树', 's d s', 'festivals', 'medium', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-16', '变色龙', 'b s l', 'animals', 'hard', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-17', '埃菲尔铁塔', 'a f e t t', 'landmarks', 'hard', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-18', '潜水艇', 'q s t', 'vehicles', 'hard', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-19', '显微镜', 'x w j', 'tools', 'hard', 'active', '2026-10-04T00:00:00.000Z', NULL)
ON CONFLICT DO NOTHING;
