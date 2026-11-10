/**
 * feedbackApi — user feedback submission, history, follow-up replies, and read state
 *
 * POST /api/feedback — submit new feedback
 * GET  /api/feedback/history — fetch feedback history with replies
 * POST /api/feedback/:feedbackId/reply — add a follow-up reply
 * POST /api/feedback/mark-read — mark as read
 *
 * The unread count lives in unreadFeedbackApi so Home can load it without these schemas.
 */

import * as z from 'zod/mini';

import { apiClient } from '@/platform/http/client';

const nonnegativeIntegerSchema = z.int().check(z.nonnegative());
const nonEmptyStringSchema = z.string().check(z.minLength(1));
const sqliteBooleanSchema = z.union([z.literal(0), z.literal(1)]);
const syncStatusSchema = z.enum(['pending', 'uncertain', 'needs_review', 'synced']);

const feedbackReplySchema = z.strictObject({
  syncStatus: syncStatusSchema,
  id: nonEmptyStringSchema,
  isAdmin: sqliteBooleanSchema,
  body: z.string(),
  isRead: sqliteBooleanSchema,
  createdAt: z.iso.datetime(),
});

const feedbackItemSchema = z.strictObject({
  syncStatus: syncStatusSchema,
  id: nonEmptyStringSchema,
  content: z.string(),
  appVersion: nonEmptyStringSchema,
  githubIssueNumber: z.nullable(nonnegativeIntegerSchema),
  status: z.enum(['open', 'resolved']),
  createdAt: z.iso.datetime(),
  replies: z.array(feedbackReplySchema),
});

const submitFeedbackResponseSchema = z.strictObject({
  success: z.literal(true),
  feedbackId: nonEmptyStringSchema,
  syncStatus: syncStatusSchema,
});

const feedbackHistoryResponseSchema = z.strictObject({
  feedbacks: z.array(feedbackItemSchema),
});

const replyResponseSchema = z.strictObject({
  success: z.literal(true),
  replyId: nonEmptyStringSchema,
  syncStatus: syncStatusSchema,
});
const syncResponseSchema = z.strictObject({
  success: z.literal(true),
  syncStatus: syncStatusSchema,
});
const successResponseSchema = z.strictObject({ success: z.literal(true) });

/** Single feedback item with replies. */
export type FeedbackItem = z.infer<typeof feedbackItemSchema>;

type FeedbackSyncStatus = z.infer<typeof syncStatusSchema>;

interface SubmitFeedbackResult {
  feedbackId: string;
  syncStatus: FeedbackSyncStatus;
}

/**
 * Submits new feedback.
 *
 * @param content - feedback body
 * @param appVersion - current app version
 * @param id - client operation id, reused when retrying the same content
 */
export async function submitFeedback(
  content: string,
  appVersion: string,
  id: string,
): Promise<SubmitFeedbackResult> {
  const response = await apiClient.json({
    method: 'POST',
    path: '/api/feedback',
    auth: 'required',
    idempotent: true,
    body: { id, content, appVersion },
    decode: (value) => submitFeedbackResponseSchema.parse(value),
  });
  return { feedbackId: response.feedbackId, syncStatus: response.syncStatus };
}

/** Fetches the current user's feedback history (including replies). */
export async function getFeedbackHistory(signal?: AbortSignal): Promise<FeedbackItem[]> {
  const response = await apiClient.json({
    method: 'GET',
    path: '/api/feedback/history',
    auth: 'required',
    idempotent: true,
    decode: (value) => feedbackHistoryResponseSchema.parse(value),
    signal,
  });
  return response.feedbacks;
}

/**
 * Appends a follow-up reply to an existing feedback item.
 *
 * @param feedbackId - feedback ID
 * @param content - reply body
 * @param id - client operation id, reused when retrying the same reply
 */
export async function replyToFeedback(feedbackId: string, content: string, id: string) {
  return apiClient.json({
    method: 'POST',
    path: `/api/feedback/${feedbackId}/reply`,
    auth: 'required',
    idempotent: true,
    body: { id, content },
    decode: (value) => replyResponseSchema.parse(value),
  });
}

/** Reconcile a previously accepted delivery; uncertain creates are never repeated. */
export async function syncFeedbackDelivery(id: string) {
  return apiClient.json({
    method: 'POST',
    path: `/api/feedback/deliveries/${id}/sync`,
    auth: 'required',
    idempotent: true,
    body: {},
    decode: (value) => syncResponseSchema.parse(value),
  });
}

/** Marks replies for the specified feedback as read. */
export async function markFeedbackRead(feedbackId: string): Promise<void> {
  await apiClient.json({
    method: 'POST',
    path: '/api/feedback/mark-read',
    auth: 'required',
    idempotent: true,
    body: { feedbackId },
    decode: (value) => {
      successResponseSchema.parse(value);
    },
  });
}

/**
 * Resolves or reopens a feedback item.
 *
 * @param feedbackId - feedback ID
 * @param action - 'resolve' | 'reopen'
 */
export async function resolveFeedback(
  feedbackId: string,
  action: 'resolve' | 'reopen',
): Promise<void> {
  await apiClient.json({
    method: 'POST',
    path: `/api/feedback/${feedbackId}/resolve`,
    auth: 'required',
    idempotent: true,
    body: { action },
    decode: (value) => {
      successResponseSchema.parse(value);
    },
  });
}
