import { requestSpecAt, respondWithJson, spyOnApiJson } from '@/test-utils/apiClient';

import {
  getFeedbackHistory,
  getUnreadFeedbackCount,
  markFeedbackRead,
  replyToFeedback,
  resolveFeedback,
  submitFeedback,
  syncFeedbackDelivery,
} from '../feedbackApi';

const jsonSpy = spyOnApiJson();

function respondToGet(value: unknown): void {
  respondWithJson(jsonSpy, value);
}

function respondToPost(value: unknown): void {
  respondWithJson(jsonSpy, value);
}

describe('feedbackApi response contracts', () => {
  beforeEach(() => {
    jsonSpy.mockReset();
  });

  it('decodes submit, history, unread, and mutation acknowledgements', async () => {
    respondToPost({ success: true, feedbackId: 'feedback-1', syncStatus: 'uncertain' });
    respondToGet({
      feedbacks: [
        {
          id: 'feedback-1',
          syncStatus: 'synced',
          content: '内容',
          appVersion: '1.0.0',
          githubIssueNumber: 42,
          status: 'open',
          createdAt: '2026-07-15T00:00:00.000Z',
          replies: [
            {
              id: 'reply-1',
              syncStatus: 'synced',
              isAdmin: 1,
              body: '回复',
              isRead: 0,
              createdAt: '2026-07-15T00:01:00.000Z',
            },
          ],
        },
      ],
    });
    respondToGet({ count: 1 });
    respondToPost({ success: true, replyId: 'reply-2', syncStatus: 'synced' });
    respondToPost({ success: true });
    respondToPost({ success: true });

    await expect(submitFeedback('内容', '1.0.0', 'feedback-1')).resolves.toEqual({
      feedbackId: 'feedback-1',
      syncStatus: 'uncertain',
    });
    expect(requestSpecAt(jsonSpy, 0)).toMatchObject({
      method: 'POST',
      path: '/api/feedback',
      body: { id: 'feedback-1', content: '内容', appVersion: '1.0.0' },
      idempotent: true,
    });
    await expect(getFeedbackHistory()).resolves.toMatchObject([
      { id: 'feedback-1', replies: [{ isAdmin: 1, isRead: 0 }] },
    ]);
    await expect(getUnreadFeedbackCount()).resolves.toBe(1);
    await expect(replyToFeedback('feedback-1', '追问', 'reply-2')).resolves.toMatchObject({
      replyId: 'reply-2',
      syncStatus: 'synced',
    });
    await expect(markFeedbackRead('feedback-1')).resolves.toBeUndefined();
    await expect(resolveFeedback('feedback-1', 'resolve')).resolves.toBeUndefined();
    respondToPost({ success: true, syncStatus: 'needs_review' });
    await expect(syncFeedbackDelivery('reply-2')).resolves.toMatchObject({
      syncStatus: 'needs_review',
    });
  });

  it('rejects non-SQLite booleans in feedback history', async () => {
    respondToGet({
      feedbacks: [
        {
          id: 'feedback-1',
          syncStatus: 'synced',
          content: '内容',
          appVersion: '1.0.0',
          githubIssueNumber: 42,
          status: 'open',
          createdAt: '2026-07-15T00:00:00.000Z',
          replies: [
            {
              id: 'reply-1',
              syncStatus: 'synced',
              isAdmin: 2,
              body: '回复',
              isRead: 0,
              createdAt: '2026-07-15T00:01:00.000Z',
            },
          ],
        },
      ],
    });

    await expect(getFeedbackHistory()).rejects.toThrow();
  });
});
