/** FibKing-owned D1 table definitions imported directly by FibKing persistence. */

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

/** Exact catalog selections used to replay at-least-once effects. */
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
    catalogEntryId: text('catalog_entry_id').notNull(),
    catalogVersion: integer('catalog_version').notNull(),
    word: text('word').notNull(),
    coreMeaning: text('core_meaning').notNull(),
    usageNote: text('usage_note').notNull(),
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
