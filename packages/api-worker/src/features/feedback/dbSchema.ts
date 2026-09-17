/** Feedback-owned D1 table definitions. */

import { index, integer, sqliteTable, text, unique, uniqueIndex } from 'drizzle-orm/sqlite-core';

import { users } from '../account/dbSchema';

/** Durable publication intent; uncertain creates are reconciled, never blindly repeated. */
export const feedbackDeliveries = sqliteTable(
  'feedback_deliveries',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    feedbackId: text('feedback_id').references(() => feedbacks.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['issue', 'reply'] }).notNull(),
    requestJson: text('request_json').notNull(),
    content: text('content').notNull(),
    appVersion: text('app_version').notNull(),
    title: text('title').notNull(),
    githubBody: text('github_body').notNull(),
    status: text('status', { enum: ['pending', 'uncertain', 'needs_review', 'synced'] })
      .notNull()
      .default('pending'),
    remoteId: integer('remote_id'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_feedback_deliveries_user_status').on(table.userId, table.status)],
);

/** User feedback synchronized with GitHub issues. */
export const feedbacks = sqliteTable(
  'feedbacks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    githubIssueNumber: integer('github_issue_number').notNull(),
    content: text('content').notNull(),
    appVersion: text('app_version').notNull(),
    status: text('status').notNull().default('open'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_feedbacks_user_id').on(table.userId),
    uniqueIndex('idx_feedbacks_github_issue_number').on(table.githubIssueNumber),
  ],
);

/** Replies synchronized with GitHub issue comments. */
export const feedbackReplies = sqliteTable(
  'feedback_replies',
  {
    id: text('id').primaryKey(),
    feedbackId: text('feedback_id')
      .notNull()
      .references(() => feedbacks.id, { onDelete: 'cascade' }),
    isAdmin: integer('is_admin').notNull().default(0),
    body: text('body').notNull(),
    githubCommentId: integer('github_comment_id'),
    isRead: integer('is_read').notNull().default(0),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_feedback_replies_feedback_id').on(table.feedbackId),
    unique('idx_feedback_replies_github_comment_id').on(table.githubCommentId),
  ],
);
