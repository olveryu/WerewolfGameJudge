import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from '../../features/account/dbSchema';

/** @public Avalon cumulative statistics by account and role. */
export const avalonUserStats = sqliteTable(
  'avalon_user_stats',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    gamesPlayed: integer('games_played').notNull(),
    wins: integer('wins').notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.role] })],
);
