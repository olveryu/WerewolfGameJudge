/** Read confirmed conversations and pending delivery intents from one D1 snapshot. */
import { and, eq, ne } from 'drizzle-orm';

import type { Db } from '../../db';
import { feedbackDeliveries, feedbackReplies, feedbacks } from './dbSchema';

/** Pending issues and replies remain visible even when GitHub has not confirmed delivery. */
export async function readFeedbackHistory(db: Db, userId: string) {
  const [confirmed, replies, deliveries] = await db.batch([
    db
      .select({
        id: feedbacks.id,
        content: feedbacks.content,
        appVersion: feedbacks.appVersion,
        githubIssueNumber: feedbacks.githubIssueNumber,
        status: feedbacks.status,
        createdAt: feedbacks.createdAt,
      })
      .from(feedbacks)
      .where(eq(feedbacks.userId, userId)),
    db
      .select({
        id: feedbackReplies.id,
        feedbackId: feedbackReplies.feedbackId,
        isAdmin: feedbackReplies.isAdmin,
        body: feedbackReplies.body,
        isRead: feedbackReplies.isRead,
        createdAt: feedbackReplies.createdAt,
      })
      .from(feedbackReplies)
      .innerJoin(feedbacks, eq(feedbacks.id, feedbackReplies.feedbackId))
      .where(eq(feedbacks.userId, userId)),
    db
      .select()
      .from(feedbackDeliveries)
      .where(and(eq(feedbackDeliveries.userId, userId), ne(feedbackDeliveries.status, 'synced'))),
  ]);
  const allReplies = [
    ...replies.map((reply) => ({ ...reply, syncStatus: 'synced' as const })),
    ...deliveries
      .filter((delivery) => delivery.kind === 'reply')
      .map((delivery) => ({
        id: delivery.id,
        feedbackId: delivery.feedbackId,
        isAdmin: 0,
        body: delivery.content,
        isRead: 1,
        createdAt: delivery.createdAt,
        syncStatus: delivery.status,
      })),
  ];
  return [
    ...confirmed.map((feedback) => ({ ...feedback, syncStatus: 'synced' as const })),
    ...deliveries
      .filter((delivery) => delivery.kind === 'issue')
      .map((delivery) => ({
        id: delivery.id,
        content: delivery.content,
        appVersion: delivery.appVersion,
        githubIssueNumber: null,
        status: 'open' as const,
        createdAt: delivery.createdAt,
        syncStatus: delivery.status,
      })),
  ]
    .map((feedback) => ({
      ...feedback,
      replies: allReplies
        .filter((reply) => reply.feedbackId === feedback.id)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .map(({ id, isAdmin, body, isRead, createdAt, syncStatus }) => ({
          id,
          isAdmin,
          body,
          isRead,
          createdAt,
          syncStatus,
        })),
    }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
