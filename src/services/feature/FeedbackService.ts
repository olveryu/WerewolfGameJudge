/**
 * FeedbackService — 用户反馈提交
 *
 * 调用 POST /api/feedback 提交建议/问题。需已登录。
 */

import { cfPost } from '@/services/cloudflare/cfFetch';

export async function submitFeedback(content: string, appVersion: string): Promise<void> {
  await cfPost('/api/feedback', { content, appVersion });
}
