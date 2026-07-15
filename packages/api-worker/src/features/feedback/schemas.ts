/** Zod schemas for /api/feedback endpoints */

import { z } from 'zod';

/** POST /api/feedback — submit new feedback */
export const feedbackSchema = z.object({
  content: z.string().min(1).max(500),
  appVersion: z.string().min(1).max(20),
});

/** POST /api/feedback/:feedbackId/reply — user follow-up reply */
export const feedbackReplySchema = z.object({
  content: z.string().min(1).max(500),
});

/** POST /api/feedback/mark-read — mark replies as read */
export const feedbackMarkReadSchema = z.object({
  feedbackId: z.string().min(1),
});

/** POST /api/feedback/:feedbackId/resolve — resolve or reopen feedback */
export const feedbackResolveSchema = z.object({
  action: z.enum(['resolve', 'reopen']),
});

// ── GitHub Webhook payload schemas ──────────────────────────────────────────

const githubUserSchema = z.object({
  login: z.string(),
  type: z.string(),
});

const githubLabelSchema = z.object({
  name: z.string(),
});

const githubIssueSchema = z.object({
  number: z.number(),
  state: z.string(),
  labels: z.array(githubLabelSchema),
});

/** Webhook payload for `issue_comment` event */
export const githubIssueCommentPayloadSchema = z.object({
  action: z.string(),
  issue: githubIssueSchema,
  comment: z.object({
    id: z.number(),
    body: z.string(),
    user: githubUserSchema,
  }),
});

/** Webhook payload for `issues` event (opened/closed/reopened) */
export const githubIssuesPayloadSchema = z.object({
  action: z.string(),
  issue: githubIssueSchema,
});
