/**
 * feedbackApi — user feedback submission, history, follow-up replies, and unread state
 *
 * POST /api/feedback — submit new feedback
 * GET  /api/feedback/history — fetch feedback history with replies
 * POST /api/feedback/:feedbackId/reply — add a follow-up reply
 * GET  /api/feedback/unread-count — count of unread admin replies
 * POST /api/feedback/mark-read — mark as read
 */

import { z } from 'zod';

import { cfGet, cfPost } from '@/services/cloudflare/cfFetch';

const nonnegativeIntegerSchema = z.number().int().nonnegative();
const sqliteBooleanSchema = z.union([z.literal(0), z.literal(1)]);

const feedbackReplySchema = z.strictObject({
  id: z.string().min(1),
  isAdmin: sqliteBooleanSchema,
  body: z.string(),
  isRead: sqliteBooleanSchema,
  createdAt: z.iso.datetime(),
});

const feedbackItemSchema = z.strictObject({
  id: z.string().min(1),
  content: z.string(),
  appVersion: z.string().min(1),
  githubIssueNumber: nonnegativeIntegerSchema,
  status: z.enum(['open', 'resolved']),
  createdAt: z.iso.datetime(),
  replies: z.array(feedbackReplySchema),
});

const submitFeedbackResponseSchema = z.strictObject({
  success: z.literal(true),
  feedbackId: z.string().min(1),
  githubIssueNumber: nonnegativeIntegerSchema,
});

const feedbackHistoryResponseSchema = z.strictObject({
  feedbacks: z.array(feedbackItemSchema),
});

const unreadCountResponseSchema = z.strictObject({ count: nonnegativeIntegerSchema });
const replyResponseSchema = z.strictObject({
  success: z.literal(true),
  replyId: z.string().min(1),
});
const successResponseSchema = z.strictObject({ success: z.literal(true) });

/** A single reply entry. */
export type FeedbackReply = z.infer<typeof feedbackReplySchema>;

/** Single feedback item with replies. */
export type FeedbackItem = z.infer<typeof feedbackItemSchema>;

interface SubmitFeedbackResult {
  feedbackId: string;
  githubIssueNumber: number;
}

/**
 * Submits new feedback.
 *
 * @param content - feedback body
 * @param appVersion - current app version
 */
export async function submitFeedback(
  content: string,
  appVersion: string,
): Promise<SubmitFeedbackResult> {
  const res = await cfPost('/api/feedback', { content, appVersion }, (value) =>
    submitFeedbackResponseSchema.parse(value),
  );
  return { feedbackId: res.feedbackId, githubIssueNumber: res.githubIssueNumber };
}

/** Fetches the current user's feedback history (including replies). */
export async function getFeedbackHistory(): Promise<FeedbackItem[]> {
  const res = await cfGet('/api/feedback/history', (value) =>
    feedbackHistoryResponseSchema.parse(value),
  );
  return res.feedbacks;
}

/**
 * Appends a follow-up reply to an existing feedback item.
 *
 * @param feedbackId - feedback ID
 * @param content - reply body
 */
export async function replyToFeedback(feedbackId: string, content: string): Promise<void> {
  await cfPost(`/api/feedback/${feedbackId}/reply`, { content }, (value) => {
    replyResponseSchema.parse(value);
  });
}

/** Fetches the count of unread admin replies. */
export async function getUnreadFeedbackCount(): Promise<number> {
  const res = await cfGet('/api/feedback/unread-count', (value) =>
    unreadCountResponseSchema.parse(value),
  );
  return res.count;
}

/** Marks replies for the specified feedback as read. */
export async function markFeedbackRead(feedbackId: string): Promise<void> {
  await cfPost('/api/feedback/mark-read', { feedbackId }, (value) => {
    successResponseSchema.parse(value);
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
  await cfPost(`/api/feedback/${feedbackId}/resolve`, { action }, (value) => {
    successResponseSchema.parse(value);
  });
}
