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
import { FIB_WORD_CATEGORIES } from './wordProviders/types';

const FIB_WORD_STATUSES = ['active', 'disabled'] as const;
export const FIB_WORD_SELECTION_TIERS = [
  'category_unseen',
  'any_unseen',
  'category_recent',
  'any_active',
  'local_fallback',
] as const;

/** @public Reusable FibKing questions; retained for the D1 ownership contract. */
export const fibWords = sqliteTable(
  'fib_words',
  {
    id: text('id').primaryKey(),
    word: text('word').notNull(),
    coreMeaning: text('core_meaning').notNull(),
    usageNote: text('usage_note').notNull(),
    category: text('category', { enum: FIB_WORD_CATEGORIES }).notNull(),
    source: text('source', { enum: FIB_WORD_SOURCES }).notNull(),
    status: text('status', { enum: FIB_WORD_STATUSES }).notNull(),
    selectionKey: integer('selection_key').notNull(),
    generationCycleId: text('generation_cycle_id'),
    createdAt: text('created_at').notNull(),
    activatedAt: text('activated_at').notNull(),
    disabledAt: text('disabled_at'),
    statusReason: text('status_reason'),
  },
  (table) => [
    uniqueIndex('idx_fib_words_word').on(table.word),
    index('idx_fib_words_selection').on(table.status, table.category, table.selectionKey, table.id),
  ],
);

/** @public Supply lease state; retained for the D1 ownership contract. */
export const fibWordSupplyState = sqliteTable('fib_word_supply_state', {
  id: integer('id').primaryKey(),
  activeCycleId: text('active_cycle_id'),
  activeCycleStartedAt: text('active_cycle_started_at'),
  leaseOwner: text('lease_owner'),
  leaseExpiresAt: text('lease_expires_at'),
  lastCompletedAt: text('last_completed_at'),
  updatedAt: text('updated_at').notNull(),
});

/** @public Generation audit records; retained for the D1 ownership contract. */
export const fibWordGenerationCycles = sqliteTable(
  'fib_word_generation_cycles',
  {
    id: text('id').primaryKey(),
    status: text('status', { enum: ['running', 'completed', 'failed'] }).notNull(),
    provider: text('provider', { enum: ['gemini'] }).notNull(),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    requestCount: integer('request_count').notNull().default(0),
    acceptedCount: integer('accepted_count').notNull().default(0),
    duplicateCount: integer('duplicate_count').notNull().default(0),
    startedAt: text('started_at').notNull(),
    completedAt: text('completed_at'),
    errorCode: text('error_code'),
  },
  (table) => [
    index('idx_fib_word_generation_cycles_status_started').on(table.status, table.startedAt),
  ],
);

/** Idempotent question snapshot selected for a room round. */
export const fibRoundWordSelections = sqliteTable(
  'fib_round_word_selections',
  {
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    roomCreationId: text('room_creation_id').notNull(),
    effectId: text('effect_id').notNull(),
    roundId: text('round_id').notNull(),
    requestFingerprint: text('request_fingerprint').notNull(),
    wordId: text('word_id').references(() => fibWords.id, { onDelete: 'restrict' }),
    word: text('word').notNull(),
    coreMeaning: text('core_meaning').notNull(),
    usageNote: text('usage_note').notNull(),
    source: text('source', { enum: FIB_WORD_SOURCES }).notNull(),
    selectionTier: text('selection_tier', { enum: FIB_WORD_SELECTION_TIERS }).notNull(),
    selectedAt: text('selected_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.effectId] }),
    uniqueIndex('idx_fib_round_word_selections_room_round').on(table.roomId, table.roundId),
    index('idx_fib_round_word_selections_word').on(table.wordId, table.selectedAt),
  ],
);

/** Committed round usage ledger; selection alone never counts as usage. */
export const fibWordUsages = sqliteTable(
  'fib_word_usages',
  {
    roomCreationId: text('room_creation_id').notNull(),
    roundId: text('round_id').notNull(),
    wordId: text('word_id').references(() => fibWords.id, { onDelete: 'restrict' }),
    word: text('word').notNull(),
    source: text('source', { enum: FIB_WORD_SOURCES }).notNull(),
    usedAt: text('used_at').notNull(),
    participantCount: integer('participant_count').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roomCreationId, table.roundId] }),
    index('idx_fib_word_usages_word_used').on(table.wordId, table.usedAt),
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
