/** Undercover-owned editorial inventory and immutable per-room allocations. */
import { UNDERCOVER_CATEGORIES } from '@game-judge/game-engine/games/undercover/public';
import { index, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

import { rooms } from '../../platform/room/dbSchema';

/** @public Reviewed pairs; disabled records retain their identity and room references. */
export const undercoverWordPairs = sqliteTable(
  'undercover_word_pairs',
  {
    id: text('id').primaryKey(),
    wordA: text('word_a').notNull(),
    wordB: text('word_b').notNull(),
    category: text('category', { enum: UNDERCOVER_CATEGORIES }).notNull(),
    status: text('status', { enum: ['active', 'disabled'] }).notNull(),
    createdAt: text('created_at').notNull(),
    reviewedAt: text('reviewed_at').notNull(),
    reviewJson: text('review_json').notNull(),
  },
  (table) => [
    unique().on(table.wordA, table.wordB),
    index('idx_undercover_word_pairs_category').on(table.status, table.category),
  ],
);

/** @public Allocations outlive word retirement and are removed only with the room. */
export const undercoverRoundWordSelections = sqliteTable(
  'undercover_round_word_selections',
  {
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    roomCreationId: text('room_creation_id').notNull(),
    roundId: text('round_id').notNull(),
    requestFingerprint: text('request_fingerprint').notNull(),
    wordPairId: text('word_pair_id')
      .notNull()
      .references(() => undercoverWordPairs.id, { onDelete: 'restrict' }),
    wordA: text('word_a').notNull(),
    wordB: text('word_b').notNull(),
    category: text('category', { enum: UNDERCOVER_CATEGORIES }).notNull(),
    selectedAt: text('selected_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.roundId] }),
    index('idx_undercover_selections_history').on(
      table.roomId,
      table.roomCreationId,
      table.wordPairId,
    ),
  ],
);

/** @public Durable editorial run records; nullable generation means queued material was reviewed. */
export const undercoverWordPacks = sqliteTable(
  'undercover_word_packs',
  {
    id: text('id').primaryKey(),
    category: text('category', { enum: UNDERCOVER_CATEGORIES }).notNull(),
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
  (table) => [index('idx_undercover_word_packs_created').on(table.createdAt)],
);

/** @public Canonical candidate history doubles as the recoverable pending-review queue. */
export const undercoverWordCandidates = sqliteTable(
  'undercover_word_candidates',
  {
    id: text('id').primaryKey(),
    wordA: text('word_a').notNull(),
    wordB: text('word_b').notNull(),
    category: text('category', { enum: UNDERCOVER_CATEGORIES }).notNull(),
    materialJson: text('material_json').notNull(),
    status: text('status', { enum: ['pending', 'accepted', 'rejected'] }).notNull(),
    claimedPackId: text('claimed_pack_id').references(() => undercoverWordPacks.id),
    createdAt: text('created_at').notNull(),
    reviewedAt: text('reviewed_at'),
  },
  (table) => [
    unique().on(table.wordA, table.wordB),
    index('idx_undercover_word_candidates_pending').on(table.status, table.category),
  ],
);
