/** Shared room-platform D1 table definitions. */

import { GAME_TYPES } from '@game-judge/game-engine/platform/protocol/gameTypes';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import { users } from '../../features/account/dbSchema';

export const ROOM_DIRECTORY_STATUSES = ['creating', 'active', 'deleting', 'failed'] as const;
export type RoomDirectoryStatus = (typeof ROOM_DIRECTORY_STATUSES)[number];

export const ROOM_SAGA_OPERATIONS = ['create', 'delete'] as const;
export type RoomSagaOperation = (typeof ROOM_SAGA_OPERATIONS)[number];

/** Public room directory and cross-storage saga state. */
export const rooms = sqliteTable(
  'rooms',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    gameType: text('game_type', { enum: GAME_TYPES }).notNull(),
    hostUserId: text('host_user_id').notNull(),
    creationId: text('creation_id').notNull().unique(),
    configJson: text('config_json').notNull(),
    status: text('status', { enum: ROOM_DIRECTORY_STATUSES }).notNull(),
    failureOperation: text('failure_operation', { enum: ROOM_SAGA_OPERATIONS }),
    lastError: text('last_error'),
    reconciliationAttemptCount: integer('reconciliation_attempt_count').notNull().default(0),
    reconcileAfter: text('reconcile_after'),
    deleteRequestedBy: text('delete_requested_by'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    gamesStarted: integer('games_started').notNull().default(0),
    lastStartedAt: text('last_started_at'),
  },
  (table) => [
    index('idx_rooms_status_reconcile').on(table.status, table.reconcileAfter),
    index('idx_rooms_host_user').on(table.hostUserId),
  ],
);

/** Idempotency ledger for committed setup-to-ongoing transitions. */
export const roomGameStarts = sqliteTable(
  'room_game_starts',
  {
    effectId: text('effect_id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    startedRevision: integer('started_revision').notNull(),
    startedAt: text('started_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_room_game_starts_room_revision').on(table.roomId, table.startedRevision),
    index('idx_room_game_starts_room_started').on(table.roomId, table.startedAt),
  ],
);

/** Users associated with a room directory entry. */
export const roomParticipants = sqliteTable(
  'room_participants',
  {
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: text('joined_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.userId] }),
    index('idx_room_participants_user_id').on(table.userId),
  ],
);
