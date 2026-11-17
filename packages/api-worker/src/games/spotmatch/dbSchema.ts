import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from '../../features/account/dbSchema';

/** @public 一眼成对 cumulative completed games. */
export const spotmatchUserStats = sqliteTable(
  'spotmatch_user_stats',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    gamesPlayed: integer('games_played').notNull(),
    wins: integer('wins').notNull(),
    correctCards: integer('correct_cards').notNull(),
    mistakes: integer('mistakes').notNull(),
  },
  (table) => [
    check(
      'spotmatch_user_stats_games_played_check',
      sql`typeof(${table.gamesPlayed}) = 'integer' AND ${table.gamesPlayed} >= 0`,
    ),
    check(
      'spotmatch_user_stats_wins_check',
      sql`typeof(${table.wins}) = 'integer' AND ${table.wins} >= 0 AND ${table.wins} <= ${table.gamesPlayed}`,
    ),
    check(
      'spotmatch_user_stats_correct_check',
      sql`typeof(${table.correctCards}) = 'integer' AND ${table.correctCards} >= 0`,
    ),
    check(
      'spotmatch_user_stats_mistakes_check',
      sql`typeof(${table.mistakes}) = 'integer' AND ${table.mistakes} >= 0`,
    ),
  ],
);
