/** FibKing-owned D1 table definitions imported directly by FibKing persistence. */

import { FIB_WORD_SOURCES } from '@game-judge/game-engine/games/fibking/public';
import { index, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import { rooms } from '../../db/applicationSchema';

/** Exact word-provider results used to replay nondeterministic effects. */
export const fibWordGenerationResults = sqliteTable(
  'fib_word_generation_results',
  {
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    roomCreationId: text('room_creation_id').notNull(),
    effectId: text('effect_id').notNull(),
    roundId: text('round_id').notNull(),
    requestFingerprint: text('request_fingerprint').notNull(),
    word: text('word').notNull(),
    definition: text('definition').notNull(),
    source: text('source', { enum: FIB_WORD_SOURCES }).notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.effectId] }),
    uniqueIndex('idx_fib_word_generation_results_room_round').on(table.roomId, table.roundId),
    index('idx_fib_word_generation_results_created').on(table.createdAt),
  ],
);
