-- DrawGuess e2e word pool fixture: 20 seed words (all active)
-- pinyin_initials must be space-separated (one per character), matching toPinyinInitials() format.
INSERT INTO drawguess_words (id, word, pinyin_initials, category, difficulty, status, created_at, disabled_at) VALUES
  ('e2e-dg-0', '苹果', 'p g', '食物', 'easy', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-1', '香蕉', 'x j', '食物', 'easy', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-2', '猫', 'm', '动物', 'easy', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-3', '狗', 'g', '动物', 'easy', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-4', '太阳', 't y', '自然', 'easy', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-5', '月亮', 'y l', '自然', 'easy', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-6', '汽车', 'q c', '交通', 'easy', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-7', '飞机', 'f j', '交通', 'easy', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-8', '雨伞', 'y s', '日用品', 'easy', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-9', '眼镜', 'y j', '日用品', 'easy', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-10', '大象', 'd x', '动物', 'medium', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-11', '长颈鹿', 'c j l', '动物', 'medium', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-12', '汉堡包', 'h b b', '食物', 'medium', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-13', '自行车', 'z x c', '交通', 'medium', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-14', '洗衣机', 'x y j', '家电', 'medium', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-15', '圣诞树', 's d s', '节日', 'medium', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-16', '变色龙', 'b s l', '动物', 'hard', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-17', '埃菲尔铁塔', 'a f e t t', '建筑', 'hard', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-18', '潜水艇', 'q s t', '交通', 'hard', 'active', '2026-10-04T00:00:00.000Z', NULL),
  ('e2e-dg-19', '显微镜', 'x w j', '工具', 'hard', 'active', '2026-10-04T00:00:00.000Z', NULL);
