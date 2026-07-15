/** User-event platform D1 table definitions. */

import { index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from '../../features/account/dbSchema';

/** Events retained until an authenticated client acknowledges delivery. */
export const userEventInbox = sqliteTable(
  'user_event_inbox',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(),
    payloadJson: text('payload_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.eventId] }),
    index('idx_user_event_inbox_delivery').on(table.userId, table.createdAt, table.eventId),
  ],
);
