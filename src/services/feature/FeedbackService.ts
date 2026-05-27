/**
 * FeedbackService — user feedback submission + history queries + follow-up replies + unread
 *
 * POST /api/feedback — submit new feedback
 * GET  /api/feedback/history — fetch feedback history with replies
 * POST /api/feedback/:feedbackId/reply — add a follow-up reply
 * GET  /api/feedback/unread-count — count of unread admin replies
 * POST /api/feedback/mark-read — mark as read
 */

import { cfGet, cfPost } from '@/services/cloudflare/cfFetch';

/** A single reply entry. */
export interface FeedbackReply {
  id: string;
  isAdmin: number;
  body: string;
  isRead: number;
  createdAt: string;
}

/** Single feedback item with replies */
export interface FeedbackItem {
  id: string;
  content: string;
  appVersion: string;
  githubIssueNumber: number;
  status: 'open' | 'resolved';
  createdAt: string;
  replies: FeedbackReply[];
}

interface SubmitFeedbackResult {
  feedbackId: string;
  githubIssueNumber: number;
}

interface SubmitFeedbackResponse {
  success: boolean;
  feedbackId: string;
  githubIssueNumber: number;
}

interface FeedbackHistoryResponse {
  feedbacks: FeedbackItem[];
}

interface UnreadCountResponse {
  count: number;
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
  const res = await cfPost<SubmitFeedbackResponse>('/api/feedback', { content, appVersion });
  return { feedbackId: res.feedbackId, githubIssueNumber: res.githubIssueNumber };
}

/** Fetches the current user's feedback history (including replies). */
export async function getFeedbackHistory(): Promise<FeedbackItem[]> {
  const res = await cfGet<FeedbackHistoryResponse>('/api/feedback/history');
  return res.feedbacks;
}

/**
 * Appends a follow-up reply to an existing feedback item.
 *
 * @param feedbackId - feedback ID
 * @param content - reply body
 */
export async function replyToFeedback(feedbackId: string, content: string): Promise<void> {
  await cfPost(`/api/feedback/${feedbackId}/reply`, { content });
}

/** Fetches the count of unread admin replies. */
export async function getUnreadFeedbackCount(): Promise<number> {
  const res = await cfGet<UnreadCountResponse>('/api/feedback/unread-count');
  return res.count;
}

/** Marks replies for the specified feedback as read. */
export async function markFeedbackRead(feedbackId: string): Promise<void> {
  await cfPost('/api/feedback/mark-read', { feedbackId });
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
  await cfPost(`/api/feedback/${feedbackId}/resolve`, { action });
}
