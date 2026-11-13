import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from '../../features/account/dbSchema';

/** @public DrawGuess cumulative statistics. */
export const drawguessUserStats = sqliteTable('drawguess_user_stats', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  gamesPlayed: integer('games_played').notNull(),
  guessAttempts: integer('guess_attempts').notNull(),
  guessRounds: integer('guess_rounds').notNull(),
  guessedRounds: integer('guessed_rounds').notNull(),
  guessTimeMs: integer('guess_time_ms').notNull(),
  guessTimedRounds: integer('guess_timed_rounds').notNull(),
  drawingRounds: integer('drawing_rounds').notNull(),
  guessedDrawingRounds: integer('guessed_drawing_rounds').notNull(),
  totalScore: integer('total_score').notNull(),
  flowersReceived: integer('flowers_received').notNull(),
  eggsReceived: integer('eggs_received').notNull(),
  tomatoesReceived: integer('tomatoes_received').notNull(),
});
