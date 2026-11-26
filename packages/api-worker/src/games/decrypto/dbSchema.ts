import { DECRYPTO_WORD_CATEGORY_CATALOG } from '@game-judge/game-engine/games/decrypto/public';
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import { users } from '../../features/account/dbSchema';
import { rooms } from '../../platform/room/dbSchema';

/** @public 解码战 cumulative completed games and wins. */
export const decryptoUserStats = sqliteTable(
  'decrypto_user_stats',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    gamesPlayed: integer('games_played').notNull(),
    wins: integer('wins').notNull(),
  },
  (table) => [
    check(
      'decrypto_user_stats_games_played_check',
      sql`typeof(${table.gamesPlayed}) = 'integer' AND ${table.gamesPlayed} >= 0`,
    ),
    check(
      'decrypto_user_stats_wins_check',
      sql`typeof(${table.wins}) = 'integer' AND ${table.wins} >= 0`,
    ),
  ],
);

/** @public Approved and active words available for in-game Decrypto rounds. */
export const decryptoWords = sqliteTable(
  'decrypto_words',
  {
    id: text('id').primaryKey(),
    word: text('word').notNull(),
    category: text('category', { enum: DECRYPTO_WORD_CATEGORY_CATALOG.ids }).notNull(),
    status: text('status', { enum: ['active', 'disabled'] }).notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('decrypto_words_word_unique').on(table.word),
    index('idx_decrypto_words_active').on(table.status, table.id),
    check('decrypto_words_word_check', sql`length(trim(${table.word})) > 0`),
    check('decrypto_words_status_check', sql`${table.status} IN ('active', 'disabled')`),
  ],
);

/** @public Durable records for manually triggered editorial supply runs. */
export const decryptoWordPacks = sqliteTable(
  'decrypto_word_packs',
  {
    id: text('id').primaryKey(),
    category: text('category', { enum: DECRYPTO_WORD_CATEGORY_CATALOG.ids }).notNull(),
    requestToken: text('request_token').notNull(),
    status: text('status', { enum: ['reserved', 'published', 'failed'] }).notNull(),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    reviewVersion: text('review_version').notNull(),
    generationJson: text('generation_json'),
    candidatesJson: text('candidates_json').notNull().default('[]'),
    reviewsJson: text('reviews_json').notNull().default('[]'),
    failureReason: text('failure_reason'),
    createdAt: text('created_at').notNull(),
    completedAt: text('completed_at'),
  },
  (table) => [
    check(
      'decrypto_word_packs_status_check',
      sql`${table.status} IN ('reserved', 'published', 'failed')`,
    ),
    check(
      'decrypto_word_packs_generation_json_check',
      sql`${table.generationJson} IS NULL OR json_valid(${table.generationJson})`,
    ),
    check('decrypto_word_packs_candidates_json_check', sql`json_valid(${table.candidatesJson})`),
    check('decrypto_word_packs_reviews_json_check', sql`json_valid(${table.reviewsJson})`),
    index('idx_decrypto_word_packs_created').on(table.createdAt),
  ],
);

/** @public Idempotent keyword snapshot for a specific room game sequence. */
export const decryptoRoundWordSelections = sqliteTable(
  'decrypto_round_word_selections',
  {
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    roomCreationId: text('room_creation_id').notNull(),
    gameSequence: integer('game_sequence').notNull(),
    requestId: text('request_id').notNull(),
    keywordsJson: text('keywords_json').notNull(),
    selectedAt: text('selected_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.gameSequence] }),
    uniqueIndex('decrypto_round_word_selections_request_unique').on(table.roomId, table.requestId),
    index('idx_decrypto_word_selections_history').on(
      table.roomId,
      table.roomCreationId,
      table.gameSequence,
    ),
    check('decrypto_word_selections_game_sequence_check', sql`${table.gameSequence} > 0`),
    check(
      'decrypto_word_selections_keywords_json_check',
      sql`json_valid(${table.keywordsJson}) AND json_type(${table.keywordsJson}) = 'object'`,
    ),
  ],
);
