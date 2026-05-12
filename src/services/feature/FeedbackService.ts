/**
 * FeedbackService — 用户反馈提交 + 历史查询 + 追问 + 未读
 *
 * POST /api/feedback — 提交新反馈
 * GET  /api/feedback/history — 获取历史反馈及回复
 * POST /api/feedback/:feedbackId/reply — 追问
 * GET  /api/feedback/unread-count — 未读管理员回复数
 * POST /api/feedback/mark-read — 标记已读
 */

import { cfGet, cfPost } from '@/services/cloudflare/cfFetch';

/** 单条回复 */
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

export async function submitFeedback(
  content: string,
  appVersion: string,
): Promise<SubmitFeedbackResult> {
  const res = await cfPost<SubmitFeedbackResponse>('/api/feedback', { content, appVersion });
  return { feedbackId: res.feedbackId, githubIssueNumber: res.githubIssueNumber };
}

export async function getFeedbackHistory(): Promise<FeedbackItem[]> {
  const res = await cfGet<FeedbackHistoryResponse>('/api/feedback/history');
  return res.feedbacks;
}

export async function replyToFeedback(feedbackId: string, content: string): Promise<void> {
  await cfPost(`/api/feedback/${feedbackId}/reply`, { content });
}

export async function getUnreadFeedbackCount(): Promise<number> {
  const res = await cfGet<UnreadCountResponse>('/api/feedback/unread-count');
  return res.count;
}

export async function markFeedbackRead(feedbackId: string): Promise<void> {
  await cfPost('/api/feedback/mark-read', { feedbackId });
}

export async function resolveFeedback(
  feedbackId: string,
  action: 'resolve' | 'reopen',
): Promise<void> {
  await cfPost(`/api/feedback/${feedbackId}/resolve`, { action });
}
