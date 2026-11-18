import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from '../../features/account/dbSchema';

/** @public 秘密希特勒 cumulative completed games and faction wins. */
export const secrethitlerUserStats = sqliteTable(
  'secrethitler_user_stats',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    gamesPlayed: integer('games_played').notNull(),
    liberalWins: integer('liberal_wins').notNull(),
    fascistWins: integer('fascist_wins').notNull(),
  },
  (table) => [
    check(
      'secrethitler_user_stats_games_played_check',
      sql`typeof(${table.gamesPlayed}) = 'integer' AND ${table.gamesPlayed} >= 0`,
    ),
    check(
      'secrethitler_user_stats_liberal_wins_check',
      sql`typeof(${table.liberalWins}) = 'integer' AND ${table.liberalWins} >= 0 AND ${table.liberalWins} <= ${table.gamesPlayed}`,
    ),
    check(
      'secrethitler_user_stats_fascist_wins_check',
      sql`typeof(${table.fascistWins}) = 'integer' AND ${table.fascistWins} >= 0 AND ${table.fascistWins} <= ${table.gamesPlayed}`,
    ),
    check(
      'secrethitler_user_stats_wins_total_check',
      sql`${table.liberalWins} + ${table.fascistWins} <= ${table.gamesPlayed}`,
    ),
  ],
);
