/** Gacha-owned D1 table definitions. */

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from '../account/dbSchema';

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
    response: text('response').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_idempotency_keys_created_at').on(table.createdAt)],
);
