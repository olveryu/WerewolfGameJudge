-- Game catalog lookup tables.
--
-- 1. Create game_types / word_games / word_categories. Code is the single authority
--    (GAME_TYPES, GAME_WORD_GAMES and each *_WORD_CATEGORY_CATALOG); these rows are its
--    projection, pinned row by row in contracts/d1Catalog.contract.test.ts. Registering a game
--    or a category is an INSERT from now on, never a table rebuild.
-- 2. Rebuild rooms with every foreign-key descendant (five ON DELETE CASCADE children) so
--    game_type references game_types. With foreign keys on, DROP TABLE runs an implicit DELETE
--    and CASCADE fires immediately (defer_foreign_keys only defers checks), so each child is
--    rebuilt in this file and each child _next references rooms_next; RENAME rooms_next → rooms
--    rewrites those references. Pinned by contracts/d1MigrationRules.contract.test.ts.
-- 3. product_game_reward_results.game_type references game_types (no descendants). The draw pool
--    tables word_draw_index / word_seen / word_draw_ordinals reference word_games, and two
--    triggers keep undercover draw partitions a projection of word_categories.
-- 4. toolbox (added to the CHECK lists by 0093) becomes one game_types row like every game.
-- 5. Drop idx_users_email (duplicated by the users.email UNIQUE autoindex) and the tables
--    fib_word_progress / fib_word_exposures, unread and unwritten since 0067.
PRAGMA defer_foreign_keys = true;

-- Key shapes project the engine's single rule (platform/protocol/catalogIds.ts); the D1 catalog
-- contract sweeps every BMP code point to prove code and these CHECKs agree.
CREATE TABLE game_types (
  -- GAME_ID_PATTERN /^[a-z][a-z0-9]{1,31}$/
  id TEXT PRIMARY KEY NOT NULL CHECK (
    typeof(id) = 'text'
    AND length(id) BETWEEN 2 AND 32
    AND id GLOB '[a-z]*'
    AND id NOT GLOB '*[^a-z0-9]*'
  ),
  sort_order INTEGER NOT NULL UNIQUE CHECK (sort_order >= 0)
) WITHOUT ROWID;
INSERT INTO game_types (id, sort_order) VALUES
  ('werewolf', 0),
  ('avalon', 1),
  ('drawguess', 2),
  ('fibking', 3),
  ('pictionary', 4),
  ('undercover', 5),
  ('storyrelay', 6),
  ('spotmatch', 7),
  ('secrethitler', 8),
  ('decrypto', 9),
  ('toolbox', 10);

CREATE TABLE word_games (
  game TEXT PRIMARY KEY NOT NULL REFERENCES game_types(id)
) WITHOUT ROWID;
INSERT INTO word_games (game) VALUES
  ('fibking'),
  ('undercover'),
  ('drawguess'),
  ('decrypto');

CREATE TABLE word_categories (
  game TEXT NOT NULL REFERENCES word_games(game),
  -- WORD_CATEGORY_ID_PATTERN /^[a-z][a-zA-Z0-9]{1,39}$/
  id TEXT NOT NULL CHECK (
    typeof(id) = 'text'
    AND length(id) BETWEEN 2 AND 40
    AND id GLOB '[a-z]*'
    AND id NOT GLOB '*[^a-zA-Z0-9]*'
  ),
  -- isWellFormedCatalogName: non-empty, no leading or trailing String#trim whitespace (the char()
  -- list), no C0 control or DEL. NUL is checked on the bytes: SQLite text functions stop at it.
  name TEXT NOT NULL CHECK (
    typeof(name) = 'text'
    AND length(name) > 0
    AND instr(CAST(name AS BLOB), x'00') = 0
    AND name NOT GLOB ('*[' || char(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 127) || ']*')
    AND name NOT GLOB ('[' || char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279) || ']*')
    AND name NOT GLOB ('*[' || char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279) || ']')
  ),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  PRIMARY KEY (game, id),
  UNIQUE (game, name),
  UNIQUE (game, sort_order)
) WITHOUT ROWID;
INSERT INTO word_categories (game, id, name, sort_order) VALUES
  ('fibking', 'customs', '民俗礼仪', 0),
  ('fibking', 'festivals', '节令节庆', 1),
  ('fibking', 'clothing', '服饰衣冠', 2),
  ('fibking', 'food', '饮食菜肴', 3),
  ('fibking', 'drinks', '茶酒饮品', 4),
  ('fibking', 'utensils', '器物用具', 5),
  ('fibking', 'buildings', '建筑营造', 6),
  ('fibking', 'crafts', '手工技艺', 7),
  ('fibking', 'textiles', '纺织染绣', 8),
  ('fibking', 'agriculture', '农耕渔猎', 9),
  ('fibking', 'mining', '矿冶盐业', 10),
  ('fibking', 'trade', '商业金融', 11),
  ('fibking', 'currency', '货币钱财', 12),
  ('fibking', 'transport', '交通行旅', 13),
  ('fibking', 'education', '教育科举', 14),
  ('fibking', 'games', '游戏博戏', 15),
  ('fibking', 'sports', '体育武术', 16),
  ('fibking', 'music', '音乐乐器', 17),
  ('fibking', 'theatre', '戏曲曲艺', 18),
  ('fibking', 'painting', '书画艺术', 19),
  ('fibking', 'literature', '语言文字', 20),
  ('fibking', 'dialect', '方言俗语', 21),
  ('fibking', 'internet', '网络文化', 22),
  ('fibking', 'occupations', '职业行话', 23),
  ('fibking', 'law', '法律制度', 24),
  ('fibking', 'medicine', '医药养生', 25),
  ('fibking', 'plants', '植物花草', 26),
  ('fibking', 'animals', '动物生物', 27),
  ('fibking', 'earth', '地理矿物', 28),
  ('fibking', 'astronomy', '天文气象', 29),
  ('fibking', 'science', '科学技术', 30),
  ('fibking', 'courtship', '婚恋风俗', 31),
  ('fibking', 'emotions', '情感词语', 32),
  ('fibking', 'drinkingCustoms', '酒令酒俗', 33),
  ('fibking', 'partyGames', '聚会游戏', 34),
  ('fibking', 'jianghu', '江湖行话', 35),
  ('fibking', 'stageProps', '戏台道具', 36),
  ('fibking', 'theatricalTricks', '戏剧机关', 37),
  ('fibking', 'detective', '侦探推理', 38),
  ('fibking', 'socialEtiquette', '社交礼节', 39),
  ('fibking', 'urbanSlang', '市井俚语', 40),
  ('fibking', 'other', '其他', 41),
  ('undercover', 'food', '吃喝美食', 0),
  ('undercover', 'dailyLife', '日常生活', 1),
  ('undercover', 'school', '校园学习', 2),
  ('undercover', 'work', '职场工作', 3),
  ('undercover', 'relationships', '人际关系', 4),
  ('undercover', 'actions', '动作状态', 5),
  ('undercover', 'entertainment', '文娱休闲', 6),
  ('undercover', 'sportsAndGames', '运动游戏', 7),
  ('undercover', 'travel', '出行旅行', 8),
  ('undercover', 'nature', '自然世界', 9),
  ('undercover', 'drinks', '饮品', 10),
  ('undercover', 'desserts', '甜点零食', 11),
  ('undercover', 'cooking', '烹饪厨房', 12),
  ('undercover', 'clothing', '服饰穿搭', 13),
  ('undercover', 'beauty', '美妆护理', 14),
  ('undercover', 'home', '家居生活', 15),
  ('undercover', 'pets', '宠物', 16),
  ('undercover', 'animals', '动物', 17),
  ('undercover', 'plants', '植物花草', 18),
  ('undercover', 'weather', '天气气候', 19),
  ('undercover', 'vehicles', '交通工具', 20),
  ('undercover', 'shopping', '购物消费', 21),
  ('undercover', 'technology', '数码科技', 22),
  ('undercover', 'music', '音乐', 23),
  ('undercover', 'filmAndTelevision', '影视', 24),
  ('undercover', 'festivals', '节日习俗', 25),
  ('undercover', 'occupations', '职业身份', 26),
  ('undercover', 'health', '健康运动', 27),
  ('undercover', 'hobbies', '兴趣爱好', 28),
  ('undercover', 'outdoors', '户外活动', 29),
  ('undercover', 'dating', '约会场景', 30),
  ('undercover', 'romance', '恋爱互动', 31),
  ('undercover', 'wedding', '婚礼现场', 32),
  ('undercover', 'nightlife', '夜生活', 33),
  ('undercover', 'partyGames', '聚会游戏', 34),
  ('undercover', 'barCulture', '酒吧文化', 35),
  ('undercover', 'actionComedy', '动作喜剧', 36),
  ('undercover', 'mystery', '悬疑推理', 37),
  ('undercover', 'awkwardMoments', '尴尬瞬间', 38),
  ('undercover', 'adultLife', '成年生活', 39),
  ('drawguess', 'animals', '动物', 0),
  ('drawguess', 'food', '食物', 1),
  ('drawguess', 'dailyObjects', '日用品', 2),
  ('drawguess', 'plants', '植物', 3),
  ('drawguess', 'vehicles', '交通工具', 4),
  ('drawguess', 'places', '场所', 5),
  ('drawguess', 'sports', '运动', 6),
  ('drawguess', 'people', '人物身份', 7),
  ('drawguess', 'idioms', '成语', 8),
  ('drawguess', 'internetMemes', '网络梗', 9),
  ('drawguess', 'instruments', '乐器', 10),
  ('drawguess', 'occupations', '职业', 11),
  ('drawguess', 'space', '太空天文', 12),
  ('drawguess', 'festivals', '节日习俗', 13),
  ('drawguess', 'electronics', '电器数码', 14),
  ('drawguess', 'characters', '动漫角色', 15),
  ('drawguess', 'nature', '自然现象', 16),
  ('drawguess', 'landmarks', '建筑地标', 17),
  ('drawguess', 'stationery', '文具校园', 18),
  ('drawguess', 'oceanLife', '海洋生物', 19),
  ('drawguess', 'clothing', '服饰穿搭', 20),
  ('drawguess', 'furniture', '家具', 21),
  ('drawguess', 'kitchenware', '厨房用具', 22),
  ('drawguess', 'toys', '玩具', 23),
  ('drawguess', 'tools', '工具', 24),
  ('drawguess', 'insects', '昆虫', 25),
  ('drawguess', 'musicalActivities', '音乐活动', 26),
  ('drawguess', 'medicalSupplies', '医疗用品', 27),
  ('drawguess', 'householdCleaning', '清洁用品', 28),
  ('drawguess', 'outdoorActivities', '户外活动', 29),
  ('drawguess', 'dating', '约会场景', 30),
  ('drawguess', 'romance', '恋爱互动', 31),
  ('drawguess', 'wedding', '婚礼现场', 32),
  ('drawguess', 'nightlife', '夜生活', 33),
  ('drawguess', 'partyGames', '聚会游戏', 34),
  ('drawguess', 'barCulture', '酒吧文化', 35),
  ('drawguess', 'actionComedy', '动作喜剧', 36),
  ('drawguess', 'mystery', '悬疑推理', 37),
  ('drawguess', 'awkwardMoments', '尴尬瞬间', 38),
  ('drawguess', 'adultLife', '成年生活', 39),
  ('decrypto', 'animals', '动物', 0),
  ('decrypto', 'plants', '植物花草', 1),
  ('decrypto', 'food', '饭菜美食', 2),
  ('decrypto', 'drinks', '饮品', 3),
  ('decrypto', 'desserts', '甜点零食', 4),
  ('decrypto', 'ingredients', '食材调料', 5),
  ('decrypto', 'cooking', '烹饪活动', 6),
  ('decrypto', 'dailyObjects', '日常用品', 7),
  ('decrypto', 'vehicles', '交通工具', 8),
  ('decrypto', 'places', '场所空间', 9),
  ('decrypto', 'occupations', '职业身份', 10),
  ('decrypto', 'clothing', '服饰穿搭', 11),
  ('decrypto', 'furniture', '家具', 12),
  ('decrypto', 'kitchenware', '厨房用具', 13),
  ('decrypto', 'tools', '工具器械', 14),
  ('decrypto', 'stationery', '文具', 15),
  ('decrypto', 'electronics', '电器数码', 16),
  ('decrypto', 'toys', '玩具', 17),
  ('decrypto', 'sports', '体育运动', 18),
  ('decrypto', 'instruments', '乐器', 19),
  ('decrypto', 'music', '音乐活动', 20),
  ('decrypto', 'art', '艺术创作', 21),
  ('decrypto', 'literature', '书籍文学', 22),
  ('decrypto', 'filmAndTelevision', '影视娱乐', 23),
  ('decrypto', 'festivals', '节日习俗', 24),
  ('decrypto', 'geography', '地理地貌', 25),
  ('decrypto', 'weather', '天气气候', 26),
  ('decrypto', 'space', '太空天文', 27),
  ('decrypto', 'architecture', '建筑地标', 28),
  ('decrypto', 'oceanLife', '海洋生物', 29),
  ('decrypto', 'insects', '昆虫', 30),
  ('decrypto', 'pets', '宠物', 31),
  ('decrypto', 'health', '健康生活', 32),
  ('decrypto', 'medicalSupplies', '医疗用品', 33),
  ('decrypto', 'bodyParts', '身体部位', 34),
  ('decrypto', 'school', '校园学习', 35),
  ('decrypto', 'work', '职场事务', 36),
  ('decrypto', 'travel', '旅行出行', 37),
  ('decrypto', 'outdoorActivities', '户外活动', 38),
  ('decrypto', 'crafts', '手工技艺', 39);

CREATE TABLE rooms_next (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE CHECK (code GLOB '[1-9][0-9][0-9][0-9]'),
  game_type TEXT NOT NULL REFERENCES game_types(id),
  host_user_id TEXT NOT NULL,
  creation_id TEXT NOT NULL UNIQUE CHECK (length(creation_id) > 0),
  config_json TEXT NOT NULL CHECK (json_valid(config_json) AND json_type(config_json) = 'object'),
  status TEXT NOT NULL CHECK (status IN ('creating', 'active', 'deleting', 'failed')),
  failure_operation TEXT CHECK (failure_operation IN ('create', 'delete')),
  last_error TEXT,
  reconciliation_attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (reconciliation_attempt_count >= 0),
  reconcile_after TEXT,
  delete_requested_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  games_started INTEGER NOT NULL DEFAULT 0,
  last_started_at TEXT,
  CHECK ((status = 'failed') = (failure_operation IS NOT NULL)),
  CHECK (status NOT IN ('deleting', 'failed') OR failure_operation = 'create' OR delete_requested_by IS NOT NULL)
);
INSERT INTO rooms_next SELECT * FROM rooms;

CREATE TABLE room_game_starts_next (
  effect_id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms_next(id) ON DELETE CASCADE,
  started_revision INTEGER NOT NULL CHECK (started_revision > 0),
  started_at TEXT NOT NULL,
  UNIQUE (room_id, started_revision)
);
INSERT INTO room_game_starts_next SELECT * FROM room_game_starts;

CREATE TABLE room_participants_next (
  room_id TEXT NOT NULL REFERENCES rooms_next(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (room_id, user_id)
);
INSERT INTO room_participants_next SELECT * FROM room_participants;

CREATE TABLE fib_round_word_selections_next (
  room_id TEXT NOT NULL,
  room_creation_id TEXT NOT NULL,
  effect_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  word_id TEXT REFERENCES fib_words(id) ON DELETE RESTRICT,
  word TEXT NOT NULL,
  core_meaning TEXT NOT NULL,
  usage_note TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('local', 'gemini')),
  selection_tier TEXT NOT NULL CHECK (selection_tier IN (
    'category_unseen', 'any_unseen', 'category_recent', 'any_active', 'local_fallback'
  )),
  selected_at TEXT NOT NULL,
  sequence_number INTEGER,
  participant_user_ids TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (room_id, effect_id),
  UNIQUE (room_id, round_id),
  FOREIGN KEY (room_id) REFERENCES rooms_next(id) ON DELETE CASCADE
);
INSERT INTO fib_round_word_selections_next SELECT * FROM fib_round_word_selections;

CREATE TABLE undercover_round_word_selections_next (
  room_id TEXT NOT NULL REFERENCES rooms_next(id) ON DELETE CASCADE,
  room_creation_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  word_pair_id TEXT NOT NULL REFERENCES undercover_word_pairs(id) ON DELETE RESTRICT,
  word_a TEXT NOT NULL,
  word_b TEXT NOT NULL,
  category TEXT NOT NULL,
  selected_at TEXT NOT NULL,
  PRIMARY KEY (room_id, round_id)
);
INSERT INTO undercover_round_word_selections_next SELECT * FROM undercover_round_word_selections;

CREATE TABLE decrypto_round_word_selections_next (
  room_id TEXT NOT NULL REFERENCES rooms_next(id) ON DELETE CASCADE,
  room_creation_id TEXT NOT NULL,
  game_sequence INTEGER NOT NULL CHECK (game_sequence > 0),
  request_id TEXT NOT NULL,
  keywords_json TEXT NOT NULL CHECK (json_valid(keywords_json) AND json_type(keywords_json) = 'object'),
  selected_at TEXT NOT NULL,
  PRIMARY KEY (room_id, game_sequence),
  UNIQUE (room_id, request_id)
);
INSERT INTO decrypto_round_word_selections_next SELECT * FROM decrypto_round_word_selections;

DROP TABLE room_game_starts;
DROP TABLE room_participants;
DROP TABLE fib_round_word_selections;
DROP TABLE undercover_round_word_selections;
DROP TABLE decrypto_round_word_selections;
DROP TABLE rooms;
ALTER TABLE rooms_next RENAME TO rooms;
ALTER TABLE room_game_starts_next RENAME TO room_game_starts;
ALTER TABLE room_participants_next RENAME TO room_participants;
ALTER TABLE fib_round_word_selections_next RENAME TO fib_round_word_selections;
ALTER TABLE undercover_round_word_selections_next RENAME TO undercover_round_word_selections;
ALTER TABLE decrypto_round_word_selections_next RENAME TO decrypto_round_word_selections;
CREATE INDEX idx_rooms_status_reconcile ON rooms(status, reconcile_after);
CREATE INDEX idx_rooms_host_user ON rooms(host_user_id);
CREATE INDEX idx_room_game_starts_room_started ON room_game_starts(room_id, started_at);
CREATE INDEX idx_room_participants_user_id ON room_participants(user_id);
CREATE INDEX idx_fib_round_word_selections_word ON fib_round_word_selections(word_id, selected_at);
CREATE INDEX idx_undercover_selections_history ON undercover_round_word_selections(room_id, room_creation_id, word_pair_id);
CREATE INDEX idx_decrypto_word_selections_history
  ON decrypto_round_word_selections(room_id, room_creation_id, game_sequence);

CREATE TABLE product_game_reward_results_next (
  settlement_id TEXT NOT NULL REFERENCES product_game_reward_claims(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL REFERENCES game_types(id),
  reward_kind TEXT NOT NULL CHECK (reward_kind IN ('completion', 'mvp')),
  reward_date TEXT NOT NULL,
  previous_xp INTEGER NOT NULL CHECK (previous_xp >= 0),
  xp_earned INTEGER NOT NULL CHECK (xp_earned >= 0),
  new_xp INTEGER NOT NULL CHECK (new_xp = previous_xp + xp_earned),
  previous_level INTEGER NOT NULL CHECK (previous_level >= 0),
  new_level INTEGER NOT NULL CHECK (new_level >= 0),
  normal_draws_earned INTEGER NOT NULL CHECK (normal_draws_earned >= 0),
  golden_draws_earned INTEGER NOT NULL CHECK (golden_draws_earned >= 0),
  stats_applied INTEGER NOT NULL DEFAULT 0 CHECK (stats_applied IN (0, 1)),
  PRIMARY KEY (settlement_id, user_id)
);
INSERT INTO product_game_reward_results_next SELECT * FROM product_game_reward_results;
DROP TABLE product_game_reward_results;
ALTER TABLE product_game_reward_results_next RENAME TO product_game_reward_results;
CREATE INDEX idx_product_game_reward_daily ON product_game_reward_results(user_id, game_type, reward_kind, reward_date);

-- Draw pools: pool drops its CHECK list and references word_games. Triggers on other tables
-- reference these three tables, and RENAME (legacy_alter_table=OFF) validates every trigger,
-- so they are dropped first and recreated verbatim afterwards.

DROP TRIGGER drawguess_words_draw_delete;

DROP TRIGGER drawguess_words_draw_insert;

DROP TRIGGER drawguess_words_draw_update;

DROP TRIGGER fib_word_sequence_draw_delete;

DROP TRIGGER fib_word_sequence_draw_insert;

DROP TRIGGER fib_words_draw_delete;

DROP TRIGGER fib_words_draw_insert;

DROP TRIGGER fib_words_draw_update;

DROP TRIGGER undercover_word_pairs_draw_delete;

DROP TRIGGER undercover_word_pairs_draw_insert;

DROP TRIGGER undercover_word_pairs_draw_update;

CREATE TABLE word_draw_index_next (
  pool TEXT NOT NULL REFERENCES word_games(game), -- Word source; never shared between games.
  partition_key TEXT NOT NULL CHECK (length(partition_key) > 0), -- 'all', or an undercover category.
  members TEXT NOT NULL DEFAULT ',' CHECK (members GLOB ',*' AND substr(members, -1) = ','), -- Drawable ordinals, e.g. ",3,17,42,".
  PRIMARY KEY (pool, partition_key)
) WITHOUT ROWID;

INSERT INTO word_draw_index_next (pool, partition_key, members) SELECT pool, partition_key, members FROM word_draw_index;

CREATE TABLE word_seen_next (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pool TEXT NOT NULL REFERENCES word_games(game),
  seen TEXT NOT NULL CHECK (seen GLOB ',*' AND substr(seen, -1) = ','), -- Seen ordinals and inclusive ranges, e.g. ",1-250,263,301,".
  PRIMARY KEY (user_id, pool)
) WITHOUT ROWID;

INSERT INTO word_seen_next (user_id, pool, seen) SELECT user_id, pool, seen FROM word_seen;

CREATE TABLE word_draw_ordinals_next (
  pool TEXT PRIMARY KEY NOT NULL REFERENCES word_games(game), -- Counter-fed pools; fibking numbers come from fib_word_sequence.
  last_ordinal INTEGER NOT NULL CHECK (last_ordinal >= 0) -- Highest ordinal ever issued; only grows.
) WITHOUT ROWID;

INSERT INTO word_draw_ordinals_next (pool, last_ordinal) SELECT pool, last_ordinal FROM word_draw_ordinals;

DROP TABLE word_draw_index;

DROP TABLE word_seen;

DROP TABLE word_draw_ordinals;

ALTER TABLE word_draw_index_next RENAME TO word_draw_index;

ALTER TABLE word_seen_next RENAME TO word_seen;

ALTER TABLE word_draw_ordinals_next RENAME TO word_draw_ordinals;

CREATE TRIGGER drawguess_words_draw_delete
AFTER DELETE ON drawguess_words
WHEN OLD.draw_ordinal IS NOT NULL
BEGIN
  UPDATE word_draw_index
  SET members = replace(members, ',' || OLD.draw_ordinal || ',', ',')
  WHERE pool = 'drawguess' AND partition_key = 'all';
END;

CREATE TRIGGER drawguess_words_draw_insert
AFTER INSERT ON drawguess_words
BEGIN
  UPDATE word_draw_ordinals SET last_ordinal = last_ordinal + 1 WHERE pool = 'drawguess';
  UPDATE drawguess_words
  SET draw_ordinal = (SELECT last_ordinal FROM word_draw_ordinals WHERE pool = 'drawguess')
  WHERE id = NEW.id;
  UPDATE word_draw_index
  SET members = members || (SELECT last_ordinal FROM word_draw_ordinals WHERE pool = 'drawguess') || ','
  WHERE pool = 'drawguess' AND partition_key = 'all' AND NEW.status = 'active';
END;

CREATE TRIGGER drawguess_words_draw_update
AFTER UPDATE OF status ON drawguess_words
WHEN NEW.draw_ordinal IS NOT NULL
BEGIN
  UPDATE word_draw_index
  SET members = replace(members, ',' || OLD.draw_ordinal || ',', ',')
  WHERE pool = 'drawguess' AND partition_key = 'all';
  UPDATE word_draw_index
  SET members = members || NEW.draw_ordinal || ','
  WHERE pool = 'drawguess' AND partition_key = 'all' AND NEW.status = 'active';
END;

CREATE TRIGGER fib_word_sequence_draw_delete
AFTER DELETE ON fib_word_sequence
BEGIN
  UPDATE word_draw_index
  SET members = replace(members, ',' || OLD.id || ',', ',')
  WHERE pool = 'fibking' AND partition_key = 'all';
END;

CREATE TRIGGER fib_word_sequence_draw_insert
AFTER INSERT ON fib_word_sequence
BEGIN
  UPDATE word_draw_index
  SET members = members || NEW.id || ','
  WHERE pool = 'fibking' AND partition_key = 'all'
    AND EXISTS (SELECT 1 FROM fib_words WHERE word = NEW.word AND status = 'active')
    AND instr(members, ',' || NEW.id || ',') = 0;
END;

CREATE TRIGGER fib_words_draw_delete
AFTER DELETE ON fib_words
BEGIN
  UPDATE word_draw_index
  SET members = replace(members, ',' || (SELECT id FROM fib_word_sequence WHERE word = OLD.word) || ',', ',')
  WHERE pool = 'fibking' AND partition_key = 'all'
    AND EXISTS (SELECT 1 FROM fib_word_sequence WHERE word = OLD.word);
END;

CREATE TRIGGER fib_words_draw_insert
AFTER INSERT ON fib_words
WHEN NEW.status = 'active'
BEGIN
  UPDATE word_draw_index
  SET members = members || (SELECT id FROM fib_word_sequence WHERE word = NEW.word) || ','
  WHERE pool = 'fibking' AND partition_key = 'all'
    AND EXISTS (SELECT 1 FROM fib_word_sequence WHERE word = NEW.word)
    AND instr(members, ',' || (SELECT id FROM fib_word_sequence WHERE word = NEW.word) || ',') = 0;
END;

CREATE TRIGGER fib_words_draw_update
AFTER UPDATE OF status, word ON fib_words
BEGIN
  UPDATE word_draw_index
  SET members = replace(members, ',' || (SELECT id FROM fib_word_sequence WHERE word = OLD.word) || ',', ',')
  WHERE pool = 'fibking' AND partition_key = 'all'
    AND EXISTS (SELECT 1 FROM fib_word_sequence WHERE word = OLD.word);
  UPDATE word_draw_index
  SET members = members || (SELECT id FROM fib_word_sequence WHERE word = NEW.word) || ','
  WHERE pool = 'fibking' AND partition_key = 'all' AND NEW.status = 'active'
    AND EXISTS (SELECT 1 FROM fib_word_sequence WHERE word = NEW.word);
END;

CREATE TRIGGER undercover_word_pairs_draw_delete
AFTER DELETE ON undercover_word_pairs
WHEN OLD.draw_ordinal IS NOT NULL
BEGIN
  UPDATE word_draw_index
  SET members = replace(members, ',' || OLD.draw_ordinal || ',', ',')
  WHERE pool = 'undercover' AND partition_key IN ('all', OLD.category);
END;

CREATE TRIGGER undercover_word_pairs_draw_insert
AFTER INSERT ON undercover_word_pairs
BEGIN
  UPDATE word_draw_ordinals SET last_ordinal = last_ordinal + 1 WHERE pool = 'undercover';
  UPDATE undercover_word_pairs
  SET draw_ordinal = (SELECT last_ordinal FROM word_draw_ordinals WHERE pool = 'undercover')
  WHERE id = NEW.id;
  UPDATE word_draw_index
  SET members = members || (SELECT last_ordinal FROM word_draw_ordinals WHERE pool = 'undercover') || ','
  WHERE pool = 'undercover' AND partition_key IN ('all', NEW.category) AND NEW.status = 'active';
END;

CREATE TRIGGER undercover_word_pairs_draw_update
AFTER UPDATE OF status, category ON undercover_word_pairs
WHEN NEW.draw_ordinal IS NOT NULL
BEGIN
  UPDATE word_draw_index
  SET members = replace(members, ',' || OLD.draw_ordinal || ',', ',')
  WHERE pool = 'undercover' AND partition_key IN ('all', OLD.category);
  UPDATE word_draw_index
  SET members = members || NEW.draw_ordinal || ','
  WHERE pool = 'undercover' AND partition_key IN ('all', NEW.category) AND NEW.status = 'active';
END;

-- Undercover draw partitions project the undercover category rows: inserting or deleting a
-- category creates or removes its empty partition, so migrations never hand-copy partition rows.
CREATE TRIGGER word_categories_undercover_partition_insert
AFTER INSERT ON word_categories
WHEN NEW.game = 'undercover'
BEGIN
  INSERT OR IGNORE INTO word_draw_index (pool, partition_key, members) VALUES ('undercover', NEW.id, ',');
END;
CREATE TRIGGER word_categories_undercover_partition_delete
AFTER DELETE ON word_categories
WHEN OLD.game = 'undercover'
BEGIN
  DELETE FROM word_draw_index WHERE pool = 'undercover' AND partition_key = OLD.id;
END;

DROP INDEX idx_users_email;
DROP TABLE fib_word_progress;
DROP TABLE fib_word_exposures;

