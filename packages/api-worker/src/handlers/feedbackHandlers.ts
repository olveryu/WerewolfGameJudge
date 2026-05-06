/**
 * handlers/feedbackHandlers — 用户反馈 Hono routes
 *
 * POST /api/feedback — 提交反馈/建议（需认证），自动创建 GitHub Issue。
 */

import { Hono } from 'hono';

import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';
import { createLogger } from '../lib/logger';
import { feedbackSchema } from '../schemas/feedback';
import { jsonBody } from './shared';

const log = createLogger('feedback');

export const feedbackRoutes = new Hono<AppEnv>();

/** GitHub repo receiving feedback issues */
const GITHUB_REPO = 'olveryu/WerewolfGameJudge';

feedbackRoutes.post('/feedback', requireAuth, jsonBody(feedbackSchema), async (c) => {
  const userId = c.var.userId;
  const { content, appVersion } = c.req.valid('json');

  const token = c.env.GITHUB_TOKEN;
  if (!token) {
    log.error('GITHUB_TOKEN not configured');
    return c.json({ success: false, reason: 'INTERNAL_ERROR' }, 500);
  }

  const titlePreview = content.length > 20 ? `${content.slice(0, 20)}…` : content;

  const resp = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'WerewolfGameJudge-Worker',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `[反馈] ${titlePreview}`,
      body: [
        `**用户 ID：** \`${userId}\``,
        `**版本：** ${appVersion}`,
        '',
        '---',
        '',
        content,
      ].join('\n'),
      labels: ['user-feedback'],
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text();
    log.error('GitHub issue creation failed', { status: resp.status, detail });
    return c.json({ success: false, reason: 'INTERNAL_ERROR' }, 500);
  }

  log.info('feedback submitted as GitHub issue', {
    userId,
    appVersion,
    contentLength: content.length,
  });

  return c.json({ success: true }, 201);
});
