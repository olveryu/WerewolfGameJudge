/**
 * Feedback feature routes.
 *
 * POST /api/feedback              — submit feedback (auth required); creates a GitHub Issue + D1 record
 * GET  /api/feedback/history      — retrieve all feedback and replies for the current user
 * POST /api/feedback/:feedbackId/reply — user follow-up (auth required); appends a GitHub Issue comment
 * GET  /api/feedback/unread-count — get the count of unread admin replies
 * POST /api/feedback/mark-read    — mark admin replies under a feedback as read
 * POST /api/feedback/webhook      — GitHub Webhook receiver for admin replies
 *
 * @throws 401 — requireAuth failed (except webhook)
 * @throws 400 — zod validation failed
 * @throws 500 — GitHub API call failed (logged + Sentry)
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { createDb } from '../../db';
import type { AppEnv } from '../../env';
import { jsonBody } from '../../platform/http/jsonBody';
import { createLogger } from '../../platform/observability/logger';
import { users } from '../account/dbSchema';
import { requireAuth } from '../auth/tokenAuth';
import { feedbackReplies, feedbacks } from './dbSchema';
import { githubIssueCommentPayloadSchema, githubIssuesPayloadSchema } from './githubWebhookSchemas';
import { createGitHubFeedbackProvider } from './providers/github';
import {
  feedbackMarkReadSchema,
  feedbackReplySchema,
  feedbackResolveSchema,
  feedbackSchema,
} from './schemas';

const log = createLogger('feedback');

/** Feedback routes (submit / list / reply). */
export const feedbackRoutes = new Hono<AppEnv>();

// ── POST /feedback — submit new feedback ────────────────────────────────────

feedbackRoutes.post('/feedback', requireAuth, jsonBody(feedbackSchema), async (c) => {
  const userId = c.var.userId;
  const { content, appVersion } = c.req.valid('json');

  const titlePreview = content.length > 20 ? `${content.slice(0, 20)}…` : content;

  // Fetch user profile for richer issue context
  const db = createDb(c.env.DB);
  const user = await db
    .select({
      displayName: users.displayName,
      lastCountry: users.lastCountry,
      lastColo: users.lastColo,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (user === undefined) throw new Error(`Authenticated user ${userId} disappeared`);

  const metaLines = [
    `**用户 ID：** \`${userId}\``,
    `**昵称：** ${user.displayName ?? '（未设置）'}`,
    `**地区：** ${user.lastCountry ?? '未知'} / ${user.lastColo ?? '未知'}`,
    `**版本：** ${appVersion}`,
  ];

  const github = createGitHubFeedbackProvider(c.env.GITHUB_TOKEN);
  const issueData = await github.createIssue({
    title: `[反馈] ${titlePreview}`,
    body: [...metaLines, '', '---', '', content].join('\n'),
    labels: ['user-feedback'],
  });

  // Store in D1
  const feedbackId = crypto.randomUUID();
  await db.insert(feedbacks).values({
    id: feedbackId,
    userId,
    githubIssueNumber: issueData.number,
    content,
    appVersion,
    createdAt: new Date().toISOString(),
  });

  log.info('feedback submitted as GitHub issue', {
    userId,
    appVersion,
    contentLength: content.length,
    issueNumber: issueData.number,
    feedbackId,
  });

  return c.json({ success: true, feedbackId, githubIssueNumber: issueData.number }, 201);
});

// ── GET /feedback/history — user's feedback + replies ───────────────────────

feedbackRoutes.get('/feedback/history', requireAuth, async (c) => {
  const userId = c.var.userId;
  const db = createDb(c.env.DB);

  const userFeedbacks = await db
    .select({
      id: feedbacks.id,
      content: feedbacks.content,
      appVersion: feedbacks.appVersion,
      githubIssueNumber: feedbacks.githubIssueNumber,
      status: feedbacks.status,
      createdAt: feedbacks.createdAt,
    })
    .from(feedbacks)
    .where(eq(feedbacks.userId, userId))
    .orderBy(desc(feedbacks.createdAt));

  if (userFeedbacks.length === 0) {
    return c.json({ feedbacks: [] });
  }

  const feedbackIds = userFeedbacks.map((f) => f.id);
  const allReplies = await db
    .select({
      id: feedbackReplies.id,
      feedbackId: feedbackReplies.feedbackId,
      isAdmin: feedbackReplies.isAdmin,
      body: feedbackReplies.body,
      isRead: feedbackReplies.isRead,
      createdAt: feedbackReplies.createdAt,
    })
    .from(feedbackReplies)
    .where(
      feedbackIds.length === 1
        ? eq(feedbackReplies.feedbackId, feedbackIds[0])
        : sql`${feedbackReplies.feedbackId} IN (${sql.join(
            feedbackIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
    )
    .orderBy(feedbackReplies.createdAt);

  // Group replies by feedbackId
  const repliesByFeedbackId = new Map<
    string,
    Array<{ id: string; isAdmin: number; body: string; isRead: number; createdAt: string }>
  >();
  for (const reply of allReplies) {
    let group = repliesByFeedbackId.get(reply.feedbackId);
    if (!group) {
      group = [];
      repliesByFeedbackId.set(reply.feedbackId, group);
    }
    group.push({
      id: reply.id,
      isAdmin: reply.isAdmin,
      body: reply.body,
      isRead: reply.isRead,
      createdAt: reply.createdAt,
    });
  }

  const result = userFeedbacks.map((f) => ({
    ...f,
    replies: repliesByFeedbackId.get(f.id) ?? [],
  }));

  return c.json({ feedbacks: result });
});

// ── POST /feedback/:feedbackId/reply — user follow-up ───────────────────────

feedbackRoutes.post(
  '/feedback/:feedbackId/reply',
  requireAuth,
  jsonBody(feedbackReplySchema),
  async (c) => {
    const userId = c.var.userId;
    const feedbackId = c.req.param('feedbackId');
    const { content } = c.req.valid('json');

    const db = createDb(c.env.DB);

    // Verify ownership
    const feedback = await db
      .select({
        id: feedbacks.id,
        githubIssueNumber: feedbacks.githubIssueNumber,
        status: feedbacks.status,
      })
      .from(feedbacks)
      .where(and(eq(feedbacks.id, feedbackId), eq(feedbacks.userId, userId)))
      .get();

    if (!feedback) {
      return c.json({ success: false, reason: 'NOT_FOUND' }, 404);
    }

    const github = createGitHubFeedbackProvider(c.env.GITHUB_TOKEN);
    if (feedback.status === 'resolved') {
      await github.setIssueState(feedback.githubIssueNumber, 'open');
    }
    const commentData = await github.createComment(
      feedback.githubIssueNumber,
      `**用户追问（\`${userId}\`）：**\n\n${content}`,
    );

    // Store reply in D1
    const replyId = crypto.randomUUID();
    const insertReply = db.insert(feedbackReplies).values({
      id: replyId,
      feedbackId,
      isAdmin: 0,
      body: content,
      githubCommentId: commentData.id,
      isRead: 1, // User's own reply is inherently read
      createdAt: new Date().toISOString(),
    });

    if (feedback.status === 'resolved') {
      await db.batch([
        insertReply,
        db.update(feedbacks).set({ status: 'open' }).where(eq(feedbacks.id, feedbackId)),
      ]);
    } else {
      await insertReply;
    }

    log.info('user reply added to feedback', {
      userId,
      feedbackId,
      issueNumber: feedback.githubIssueNumber,
    });

    if (feedback.status === 'resolved') {
      log.info('auto-reopened resolved feedback on user reply', { feedbackId });
    }

    return c.json({ success: true, replyId }, 201);
  },
);

// ── POST /feedback/:feedbackId/resolve — resolve or reopen feedback ─────────

feedbackRoutes.post(
  '/feedback/:feedbackId/resolve',
  requireAuth,
  jsonBody(feedbackResolveSchema),
  async (c) => {
    const userId = c.var.userId;
    const feedbackId = c.req.param('feedbackId');
    const { action } = c.req.valid('json');

    const db = createDb(c.env.DB);

    // Verify ownership
    const feedback = await db
      .select({
        id: feedbacks.id,
        githubIssueNumber: feedbacks.githubIssueNumber,
        status: feedbacks.status,
      })
      .from(feedbacks)
      .where(and(eq(feedbacks.id, feedbackId), eq(feedbacks.userId, userId)))
      .get();

    if (!feedback) {
      return c.json({ success: false, reason: 'NOT_FOUND' }, 404);
    }

    const newStatus = action === 'resolve' ? 'resolved' : 'open';
    if (feedback.status === newStatus) {
      return c.json({ success: true }); // Already in desired state
    }

    // Sync GitHub Issue state
    const githubState = action === 'resolve' ? 'closed' : 'open';
    const github = createGitHubFeedbackProvider(c.env.GITHUB_TOKEN);
    await github.setIssueState(feedback.githubIssueNumber, githubState);
    const updated = await db
      .update(feedbacks)
      .set({ status: newStatus })
      .where(eq(feedbacks.id, feedbackId))
      .returning({ id: feedbacks.id });
    if (updated.length !== 1) throw new Error(`Feedback ${feedbackId} disappeared during update`);

    log.info('feedback status changed', { feedbackId, from: feedback.status, to: newStatus });
    return c.json({ success: true });
  },
);

// ── GET /feedback/unread-count — unread admin reply count ───────────────────

feedbackRoutes.get('/feedback/unread-count', requireAuth, async (c) => {
  const userId = c.var.userId;
  const db = createDb(c.env.DB);

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(feedbackReplies)
    .innerJoin(feedbacks, eq(feedbackReplies.feedbackId, feedbacks.id))
    .where(
      and(
        eq(feedbacks.userId, userId),
        eq(feedbackReplies.isAdmin, 1),
        eq(feedbackReplies.isRead, 0),
      ),
    )
    .get();

  return c.json({ count: result?.count ?? 0 });
});

// ── POST /feedback/mark-read — mark admin replies as read ───────────────────

feedbackRoutes.post(
  '/feedback/mark-read',
  requireAuth,
  jsonBody(feedbackMarkReadSchema),
  async (c) => {
    const userId = c.var.userId;
    const { feedbackId } = c.req.valid('json');
    const db = createDb(c.env.DB);

    // Verify ownership
    const feedback = await db
      .select({ id: feedbacks.id })
      .from(feedbacks)
      .where(and(eq(feedbacks.id, feedbackId), eq(feedbacks.userId, userId)))
      .get();

    if (!feedback) {
      return c.json({ success: false, reason: 'NOT_FOUND' }, 404);
    }

    await db
      .update(feedbackReplies)
      .set({ isRead: 1 })
      .where(
        and(
          eq(feedbackReplies.feedbackId, feedbackId),
          eq(feedbackReplies.isAdmin, 1),
          eq(feedbackReplies.isRead, 0),
        ),
      );

    return c.json({ success: true });
  },
);

// ── Webhook routes (no requireAuth, separate mount) ─────────────────────────
/** GitHub webhook callback routes (no auth). */ export const feedbackWebhookRoutes =
  new Hono<AppEnv>();

/**
 * Verify GitHub webhook signature using HMAC-SHA256 (timing-safe).
 * Signature format: `sha256=<hex_digest>`
 */
async function verifyWebhookSignature(
  secret: string,
  payload: ArrayBuffer,
  signatureHeader: string,
): Promise<boolean> {
  const prefix = 'sha256=';
  if (!signatureHeader.startsWith(prefix)) return false;

  const receivedHex = signatureHeader.slice(prefix.length);
  const receivedBytes = hexToBytes(receivedHex);
  if (!receivedBytes) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const expectedBuf = await crypto.subtle.sign('HMAC', key, payload);
  const expectedBytes = new Uint8Array(expectedBuf);

  if (receivedBytes.length !== expectedBytes.length) return false;

  // Timing-safe comparison via constant-time XOR accumulation
  let diff = 0;
  for (let i = 0; i < expectedBytes.length; i++) {
    diff |= expectedBytes[i] ^ receivedBytes[i];
  }
  return diff === 0;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) return null;
    bytes[i / 2] = byte;
  }
  return bytes;
}

feedbackWebhookRoutes.post('/feedback/webhook', async (c) => {
  const secret = c.env.GITHUB_WEBHOOK_SECRET;

  const event = c.req.header('x-github-event');

  // Verify signature
  const signature = c.req.header('x-hub-signature-256');
  if (!signature) {
    log.warn('webhook missing signature');
    return c.body(null, 401);
  }

  const rawBody = await c.req.arrayBuffer();
  const valid = await verifyWebhookSignature(secret, rawBody, signature);
  if (!valid) {
    log.warn('webhook signature verification failed');
    return c.body(null, 401);
  }

  const rawPayload: unknown = JSON.parse(new TextDecoder().decode(rawBody));

  if (event === 'issue_comment') {
    return handleIssueCommentEvent(c, rawPayload);
  }

  if (event === 'issues') {
    return handleIssuesEvent(c, rawPayload);
  }

  // Unhandled event type
  return c.body(null, 204);
});

// ── Webhook: issue_comment event ────────────────────────────────────────────

async function handleIssueCommentEvent(
  c: import('hono').Context<AppEnv>,
  rawPayload: unknown,
): Promise<Response> {
  const parsed = githubIssueCommentPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    log.warn('webhook payload validation failed', { error: parsed.error.message });
    return c.body(null, 400);
  }
  const payload = parsed.data;

  // Only process newly created comments
  if (payload.action !== 'created') {
    return c.body(null, 204);
  }

  // Filter: only issues with user-feedback label
  const hasLabel = payload.issue.labels.some((l) => l.name === 'user-feedback');
  if (!hasLabel) {
    return c.body(null, 204);
  }

  // Ignore bot comments and non-admin comments
  if (payload.comment.user.type === 'Bot') {
    return c.body(null, 204);
  }

  const adminLogin = c.env.GITHUB_REPO_OWNER;
  if (payload.comment.user.login !== adminLogin) {
    log.info('webhook ignored non-admin comment', { login: payload.comment.user.login });
    return c.body(null, 204);
  }

  const db = createDb(c.env.DB);

  // Find matching feedback by issue number
  const feedback = await db
    .select({ id: feedbacks.id, status: feedbacks.status })
    .from(feedbacks)
    .where(eq(feedbacks.githubIssueNumber, payload.issue.number))
    .get();

  if (!feedback) {
    log.warn('webhook received for unknown issue', { issueNumber: payload.issue.number });
    return c.body(null, 204);
  }

  // Deduplicate by github_comment_id (unique index handles concurrent deliveries)
  const replyId = crypto.randomUUID();
  try {
    await db.insert(feedbackReplies).values({
      id: replyId,
      feedbackId: feedback.id,
      isAdmin: 1,
      body: payload.comment.body,
      githubCommentId: payload.comment.id,
      isRead: 0,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    // UNIQUE constraint violation = duplicate delivery, safe to ignore
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      log.info('webhook duplicate delivery ignored', { commentId: payload.comment.id });
      return c.body(null, 204);
    }
    throw err;
  }

  // Admin reply auto-reopens resolved feedback
  if (feedback.status === 'resolved') {
    await db.update(feedbacks).set({ status: 'open' }).where(eq(feedbacks.id, feedback.id));
    log.info('auto-reopened resolved feedback on admin reply', { feedbackId: feedback.id });
  }

  log.info('admin reply recorded from webhook', {
    feedbackId: feedback.id,
    commentId: payload.comment.id,
    issueNumber: payload.issue.number,
  });

  return c.body(null, 204);
}

// ── Webhook: issues event (state sync) ──────────────────────────────────────

async function handleIssuesEvent(
  c: import('hono').Context<AppEnv>,
  rawPayload: unknown,
): Promise<Response> {
  const parsed = githubIssuesPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    log.warn('webhook issues payload validation failed', { error: parsed.error.message });
    return c.body(null, 400);
  }
  const payload = parsed.data;

  // Only sync close/reopen state changes
  if (payload.action !== 'closed' && payload.action !== 'reopened') {
    return c.body(null, 204);
  }

  // Filter: only issues with user-feedback label
  const hasLabel = payload.issue.labels.some((l) => l.name === 'user-feedback');
  if (!hasLabel) {
    return c.body(null, 204);
  }

  const db = createDb(c.env.DB);
  const newStatus = payload.action === 'closed' ? 'resolved' : 'open';

  const updated = await db
    .update(feedbacks)
    .set({ status: newStatus })
    .where(eq(feedbacks.githubIssueNumber, payload.issue.number))
    .returning({ id: feedbacks.id });

  if (updated.length > 0) {
    log.info('feedback status synced from GitHub', {
      issueNumber: payload.issue.number,
      newStatus,
      feedbackId: updated[0].id,
    });
  }

  return c.body(null, 204);
}
