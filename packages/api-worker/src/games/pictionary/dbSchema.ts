import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from '../../features/account/dbSchema';

/** @public Pictionary cumulative statistics. */
export const pictionaryUserStats = sqliteTable('pictionary_user_stats', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  gamesPlayed: integer('games_played').notNull(),
  textSubmissions: integer('text_submissions').notNull(),
  drawingSubmissions: integer('drawing_submissions').notNull(),
});
