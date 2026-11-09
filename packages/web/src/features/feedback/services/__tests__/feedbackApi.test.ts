import { requestSpecAt, respondWithJson, spyOnApiJson } from '@/test-utils/apiClient';

import {
  getFeedbackHistory,
  markFeedbackRead,
  replyToFeedback,
  resolveFeedback,
  submitFeedback,
  syncFeedbackDelivery,
} from '../feedbackApi';
import { getUnreadFeedbackCount } from '../unreadFeedbackApi';

const jsonSpy = spyOnApiJson();

function historyWithReplyFlag(isAdmin: number) {
  return {
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
            isAdmin,
            body: '回复',
            isRead: 0,
            createdAt: '2026-07-15T00:01:00.000Z',
          },
        ],
      },
    ],
  };
}

describe('feedbackApi response contracts', () => {
  beforeEach(() => {
    jsonSpy.mockReset();
  });

  it('decodes submit, history, unread, and mutation acknowledgements', async () => {
    respondWithJson(jsonSpy, { success: true, feedbackId: 'feedback-1', syncStatus: 'uncertain' });
    respondWithJson(jsonSpy, historyWithReplyFlag(1));
    respondWithJson(jsonSpy, { count: 1 });
    respondWithJson(jsonSpy, { success: true, replyId: 'reply-2', syncStatus: 'synced' });
    respondWithJson(jsonSpy, { success: true });
    respondWithJson(jsonSpy, { success: true });

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
    respondWithJson(jsonSpy, { success: true, syncStatus: 'needs_review' });
    await expect(syncFeedbackDelivery('reply-2')).resolves.toMatchObject({
      syncStatus: 'needs_review',
    });
  });

  it('rejects non-SQLite booleans in feedback history', async () => {
    respondWithJson(jsonSpy, historyWithReplyFlag(2));

    await expect(getFeedbackHistory()).rejects.toThrow();
  });
});
