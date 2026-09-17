/** Real D1 failure-window coverage for feedback publication and reconciliation. */
import { env, SELF } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { beforeEach, expect, it, vi } from 'vitest';

import { clearUploadTestState, createAnonymousSession } from '../../../../test/uploadTestSupport';
import { createDb } from '../../../db';
import { feedbackDeliveries, feedbackReplies, feedbacks } from '../dbSchema';
import { prepareFeedbackDelivery, syncFeedbackDelivery } from '../delivery';
import { readFeedbackHistory } from '../history';
import type { GitHubFeedbackProvider } from '../providers/github';

beforeEach(async () => {
  await env.DB.exec(
    'DROP TRIGGER IF EXISTS reject_feedback; DROP TRIGGER IF EXISTS reject_reply; DELETE FROM feedback_deliveries; DELETE FROM feedback_replies; DELETE FROM feedbacks;',
  );
  await clearUploadTestState();
});

function createProvider() {
  return {
    createIssue: vi.fn<GitHubFeedbackProvider['createIssue']>().mockResolvedValue({ number: 42 }),
    createComment: vi.fn<GitHubFeedbackProvider['createComment']>().mockResolvedValue({ id: 91 }),
    setIssueState: vi.fn<GitHubFeedbackProvider['setIssueState']>().mockResolvedValue(undefined),
    findIssue: vi.fn<GitHubFeedbackProvider['findIssue']>().mockResolvedValue(42),
    findComment: vi.fn<GitHubFeedbackProvider['findComment']>().mockResolvedValue(91),
  };
}

it('keeps the accepted issue visible after D1 failure and reconciles without a second create', async () => {
  const owner = await createAnonymousSession();
  const other = await createAnonymousSession();
  const db = createDb(env.DB);
  const input = {
    id: crypto.randomUUID(),
    userId: owner.user.id,
    kind: 'issue' as const,
    feedbackId: null,
    content: 'issue content',
    appVersion: '1.0',
    title: 'title',
    githubBody: 'body',
  };
  const delivery = await prepareFeedbackDelivery(db, input);
  const github = createProvider();
  github.createIssue.mockImplementationOnce(async () => {
    expect(
      (await db.select().from(feedbackDeliveries).where(eq(feedbackDeliveries.id, input.id)).get())
        ?.status,
    ).toBe('uncertain');
    return { number: 42 };
  });
  await env.DB.prepare(
    "CREATE TRIGGER reject_feedback BEFORE INSERT ON feedbacks BEGIN SELECT RAISE(FAIL, 'injected local failure'); END",
  ).run();
  const uncertain = await syncFeedbackDelivery(db, github, delivery);
  expect(uncertain.status).toBe('uncertain');
  expect(await readFeedbackHistory(db, owner.user.id)).toMatchObject([
    { id: input.id, githubIssueNumber: null, syncStatus: 'uncertain' },
  ]);
  await expect(prepareFeedbackDelivery(db, { ...input, content: 'different' })).rejects.toThrow(
    'FEEDBACK_REQUEST_CONFLICT',
  );
  await expect(prepareFeedbackDelivery(db, { ...input, userId: other.user.id })).rejects.toThrow(
    'FEEDBACK_REQUEST_CONFLICT',
  );
  const denied = await SELF.fetch(`https://test.local/api/feedback/deliveries/${input.id}/sync`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${other.access_token}` },
  });
  expect(denied.status).toBe(404);
  await env.DB.exec('DROP TRIGGER reject_feedback');
  await Promise.all([
    syncFeedbackDelivery(db, github, uncertain),
    syncFeedbackDelivery(db, github, uncertain),
  ]);
  expect(github.createIssue).toHaveBeenCalledTimes(1);
  expect(github.findIssue).toHaveBeenCalledWith(`<!-- feedback:${input.id} -->`);
  expect(await db.select().from(feedbacks)).toHaveLength(1);
  const history = await SELF.fetch('https://test.local/api/feedback/history', {
    headers: { Authorization: `Bearer ${owner.access_token}` },
  });
  expect(await history.json()).toMatchObject({
    feedbacks: [{ id: input.id, syncStatus: 'synced', githubIssueNumber: 42 }],
  });
});

it('recovers a lost comment response and reopens a resolved conversation without duplicating the reply', async () => {
  const owner = await createAnonymousSession();
  const db = createDb(env.DB);
  const feedbackId = crypto.randomUUID();
  await db.insert(feedbacks).values({
    id: feedbackId,
    userId: owner.user.id,
    content: 'original',
    appVersion: '1.0',
    githubIssueNumber: 42,
    status: 'resolved',
    createdAt: new Date().toISOString(),
  });
  const delivery = await prepareFeedbackDelivery(db, {
    id: crypto.randomUUID(),
    userId: owner.user.id,
    kind: 'reply',
    feedbackId,
    content: 'reply',
    appVersion: '',
    title: '',
    githubBody: 'reply body',
  });
  const github = createProvider();
  github.createComment.mockRejectedValueOnce(new Error('response lost after remote commit'));
  const uncertain = await syncFeedbackDelivery(db, github, delivery);
  expect(uncertain.status).toBe('uncertain');
  github.findComment.mockResolvedValueOnce(null);
  expect((await syncFeedbackDelivery(db, github, uncertain)).status).toBe('needs_review');
  expect(await readFeedbackHistory(db, owner.user.id)).toMatchObject([
    { replies: [{ id: delivery.id, syncStatus: 'needs_review' }] },
  ]);
  await env.DB.prepare(
    "CREATE TRIGGER reject_reply BEFORE INSERT ON feedback_replies BEGIN SELECT RAISE(FAIL, 'injected reply failure'); END",
  ).run();
  const failedCommit = await syncFeedbackDelivery(db, github, uncertain);
  expect(failedCommit.status).toBe('needs_review');
  await env.DB.exec('DROP TRIGGER reject_reply');
  expect((await syncFeedbackDelivery(db, github, failedCommit)).status).toBe('synced');
  expect(github.createComment).toHaveBeenCalledTimes(1);
  expect(github.setIssueState).toHaveBeenCalledWith(42, 'open');
  expect(await db.select().from(feedbackReplies)).toMatchObject([
    { id: delivery.id, githubCommentId: 91 },
  ]);
  expect(await readFeedbackHistory(db, owner.user.id)).toMatchObject([
    { status: 'open', replies: [{ syncStatus: 'synced' }] },
  ]);
});
