-- Topics are independent of the four legacy editorial categories.
ALTER TABLE fib_words ADD COLUMN topic TEXT;
ALTER TABLE fib_word_packs ADD COLUMN topic TEXT;
ALTER TABLE fib_word_packs ADD COLUMN search_selected_at TEXT;
ALTER TABLE fib_word_candidates ADD COLUMN topic TEXT;
CREATE INDEX idx_fib_words_topic ON fib_words(status, topic);
CREATE INDEX idx_fib_word_packs_topic_created ON fib_word_packs(topic, search_selected_at);
