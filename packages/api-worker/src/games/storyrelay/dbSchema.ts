import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from '../../features/account/dbSchema';

/** @public Story Relay cumulative statistics. */
export const storyRelayUserStats = sqliteTable('storyrelay_user_stats', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  gamesPlayed: integer('games_played').notNull(),
  paragraphsSubmitted: integer('paragraphs_submitted').notNull(),
});
