/** Feedback publication journal: one create attempt, followed only by remote reconciliation. */
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import * as Sentry from '@sentry/cloudflare';
import { and, eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

import type { Db } from '../../db';
import { createLogger } from '../../platform/observability/logger';
import { feedbackDeliveries, feedbackReplies, feedbacks } from './dbSchema';
import type { GitHubFeedbackProvider } from './providers/github';

const log = createLogger('feedback-delivery');
type FeedbackDelivery = typeof feedbackDeliveries.$inferSelect;
type DeliveryInput = Pick<
  FeedbackDelivery,
  'id' | 'userId' | 'kind' | 'feedbackId' | 'content' | 'appVersion' | 'title' | 'githubBody'
>;

/** Persist the user's operation identity before contacting GitHub. */
export async function prepareFeedbackDelivery(
  db: Db,
  input: DeliveryInput,
): Promise<FeedbackDelivery> {
  const requestJson = canonicalJson({
    kind: input.kind,
    feedbackId: input.feedbackId,
    content: input.content,
    appVersion: input.appVersion,
  });
  await db
    .insert(feedbackDeliveries)
    .values({ ...input, requestJson, createdAt: new Date().toISOString() })
    .onConflictDoNothing({ target: feedbackDeliveries.id });
  const delivery = await db
    .select()
    .from(feedbackDeliveries)
    .where(eq(feedbackDeliveries.id, input.id))
    .get();
  if (delivery === undefined) throw new Error('Feedback delivery disappeared after insert');
  if (delivery.userId !== input.userId || delivery.requestJson !== requestJson) {
    throw new HTTPException(409, { message: 'FEEDBACK_REQUEST_CONFLICT' });
  }
  return delivery;
}

async function completeDelivery(
  db: Db,
  delivery: FeedbackDelivery,
  remoteId: number,
): Promise<void> {
  const insert =
    delivery.kind === 'issue'
      ? db
          .insert(feedbacks)
          .values({
            id: delivery.id,
            userId: delivery.userId,
            content: delivery.content,
            appVersion: delivery.appVersion,
            githubIssueNumber: remoteId,
            createdAt: delivery.createdAt,
          })
          .onConflictDoNothing({ target: feedbacks.id })
      : db
          .insert(feedbackReplies)
          .values({
            id: delivery.id,
            feedbackId: requireFeedbackId(delivery),
            isAdmin: 0,
            body: delivery.content,
            githubCommentId: remoteId,
            isRead: 1,
            createdAt: delivery.createdAt,
          })
          .onConflictDoNothing({ target: feedbackReplies.id });
  const finish = db
    .update(feedbackDeliveries)
    .set({ status: 'synced', remoteId })
    .where(eq(feedbackDeliveries.id, delivery.id));
  if (delivery.kind === 'reply') {
    await db.batch([
      insert,
      finish,
      db
        .update(feedbacks)
        .set({ status: 'open' })
        .where(eq(feedbacks.id, requireFeedbackId(delivery))),
    ]);
  } else {
    await db.batch([insert, finish]);
  }
}

function requireFeedbackId(delivery: FeedbackDelivery): string {
  if (delivery.feedbackId === null) throw new Error('Reply delivery must reference feedback');
  return delivery.feedbackId;
}

/** Deliver pending work once; recover uncertain responses using the stable GitHub body marker. */
export async function syncFeedbackDelivery(
  db: Db,
  github: GitHubFeedbackProvider,
  delivery: FeedbackDelivery,
): Promise<FeedbackDelivery> {
  if (delivery.status === 'synced') return delivery;
  const marker = `<!-- feedback:${delivery.id} -->`;
  try {
    const claimed = await db
      .update(feedbackDeliveries)
      .set({ status: 'uncertain' })
      .where(and(eq(feedbackDeliveries.id, delivery.id), eq(feedbackDeliveries.status, 'pending')))
      .returning({ id: feedbackDeliveries.id });
    let remoteId: number | null;
    if (delivery.kind === 'issue') {
      remoteId =
        claimed.length === 1
          ? (
              await github.createIssue({
                title: delivery.title,
                body: `${marker}\n${delivery.githubBody}`,
                labels: ['user-feedback'],
              })
            ).number
          : await github.findIssue(marker);
    } else {
      const feedback = await db
        .select()
        .from(feedbacks)
        .where(eq(feedbacks.id, requireFeedbackId(delivery)))
        .get();
      if (feedback === undefined) throw new Error('Reply feedback disappeared');
      remoteId =
        claimed.length === 1
          ? (
              await github.createComment(
                feedback.githubIssueNumber,
                `${marker}\n${delivery.githubBody}`,
              )
            ).id
          : await github.findComment(feedback.githubIssueNumber, marker);
      if (remoteId !== null && feedback.status === 'resolved')
        await github.setIssueState(feedback.githubIssueNumber, 'open');
    }
    if (remoteId === null) {
      await db
        .update(feedbackDeliveries)
        .set({ status: 'needs_review' })
        .where(
          and(eq(feedbackDeliveries.id, delivery.id), eq(feedbackDeliveries.status, 'uncertain')),
        );
    } else {
      await completeDelivery(db, delivery, remoteId);
    }
  } catch (error) {
    log.error('feedback delivery requires reconciliation', { deliveryId: delivery.id, error });
    Sentry.captureException(error);
  }
  const current = await db
    .select()
    .from(feedbackDeliveries)
    .where(eq(feedbackDeliveries.id, delivery.id))
    .get();
  if (current === undefined)
    throw new Error('Feedback delivery disappeared during synchronization');
  return current;
}
