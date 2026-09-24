-- Synthetic browser fixtures, never a production editorial seed.
INSERT INTO undercover_word_pairs (id, word_a, word_b, category, status, created_at, reviewed_at, review_json)
VALUES
  ('e2e-undercover-food-1', '牛奶', '豆浆', 'food', 'active', '2026-09-21', '2026-09-21', '{"fixture":true}'),
  ('e2e-undercover-food-2', '包子', '饺子', 'food', 'active', '2026-09-21', '2026-09-21', '{"fixture":true}'),
  ('e2e-undercover-food-3', '米粉', '面条', 'food', 'active', '2026-09-23', '2026-09-23', '{"fixture":true}')
ON CONFLICT (id) DO NOTHING;