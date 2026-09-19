/** Admin-owned reward audit records; balances remain owned by account.userStats. */
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from '../account/dbSchema';

export const adminRewardGrants = sqliteTable(
  'admin_reward_grants',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    claimId: text('claim_id').notNull(),
    drawType: text('draw_type', { enum: ['normal', 'golden'] }).notNull(),
    count: integer('count').notNull(),
    reason: text('reason').notNull(),
    balanceBefore: integer('balance_before').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_admin_reward_grants_user_created').on(table.userId, table.createdAt, table.id),
  ],
);
