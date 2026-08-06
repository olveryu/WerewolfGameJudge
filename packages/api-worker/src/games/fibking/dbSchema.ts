/** FibKing-owned D1 table definitions imported directly by FibKing persistence. */

import { FIB_WORD_SOURCES } from '@game-judge/game-engine/games/fibking/public';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import { users } from '../../features/account/dbSchema';
import { rooms } from '../../platform/room/dbSchema';

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
    requestedAt: integer('requested_at').notNull(),
    deadlineAt: integer('deadline_at').notNull(),
    word: text('word').notNull(),
    coreMeaning: text('core_meaning').notNull(),
    usageNote: text('usage_note').notNull(),
    source: text('source', { enum: FIB_WORD_SOURCES }).notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.effectId] }),
    uniqueIndex('idx_fib_word_generation_results_room_round').on(table.roomId, table.roundId),
    index('idx_fib_word_generation_results_created').on(table.createdAt),
  ],
);

/** Bounded word exposure history used to avoid repeats for current human participants. */
export const fibWordExposures = sqliteTable(
  'fib_word_exposures',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    word: text('word').notNull(),
    lastSeenAt: text('last_seen_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.word] }),
    index('idx_fib_word_exposures_user_seen').on(table.userId, table.lastSeenAt),
  ],
);
