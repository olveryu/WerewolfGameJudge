/** Gacha-owned D1 table definitions. */

import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import { users } from '../account/dbSchema';

export const GACHA_MUTATION_OPERATIONS = ['draw', 'exchange'] as const;
export type GachaMutationOperation = (typeof GACHA_MUTATION_OPERATIONS)[number];

/** Immutable gacha draw history. */
export const drawHistory = sqliteTable('draw_history', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  drawType: text('draw_type').notNull(),
  rarity: text('rarity').notNull(),
  rewardType: text('reward_type').notNull(),
  rewardId: text('reward_id').notNull(),
  pityCount: integer('pity_count').notNull(),
  isPityTriggered: integer('is_pity_triggered').notNull().default(0),
  isDuplicate: integer('is_duplicate').notNull().default(0),
  shardsAwarded: integer('shards_awarded').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

/** Gacha mutation replay protection. */
export const idempotencyKeys = sqliteTable(
  'idempotency_keys',
  {
    key: text('key').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    claimId: text('claim_id').notNull(),
    operation: text('operation', { enum: GACHA_MUTATION_OPERATIONS }).notNull(),
    isApplied: integer('is_applied').notNull(),
    response: text('response').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_idempotency_keys_claim_id').on(table.claimId),
    index('idx_idempotency_keys_created_at').on(table.createdAt),
  ],
);
