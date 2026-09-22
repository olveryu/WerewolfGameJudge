/** Cross-game editorial request ownership; rows are claimed before external calls. */
import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** @public Uncertain requests remain consumed; no game-specific provider records live here. */
export const editorialModelRequests = sqliteTable(
  'editorial_model_requests',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    model: text('model').notNull(),
    claimedAt: text('claimed_at').notNull(),
  },
  (table) => [index('idx_editorial_model_requests_time').on(table.claimedAt)],
);
