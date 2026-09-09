INSERT INTO fib_words (
  id, word, core_meaning, usage_note, category, source, status,
  selection_key, created_at, activated_at
)
SELECT 'e2e-fib-' || key, value,
  '用于本地流程测试的词语释义，不作为线上审核题目。',
  '仅供自动化测试验证出题、身份分配和揭晓流程。',
  'literary', 'local', 'active', key,
  '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'
FROM json_each('["射覆","却扇","打尖","方胜","步摇","牙璋","厌胜","榷场","交引","契尾","投壶","流觞"]')
WHERE true ON CONFLICT (word) DO NOTHING;

INSERT INTO fib_word_sequence (word, published_at)
SELECT word, '2026-09-01T00:00:00.000Z' FROM fib_words
WHERE id LIKE 'e2e-fib-%' ORDER BY id
ON CONFLICT (word) DO NOTHING;