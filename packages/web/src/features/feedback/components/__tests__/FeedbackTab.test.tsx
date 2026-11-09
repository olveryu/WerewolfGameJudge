/** Feedback UI preserves operation identity and exposes uncertain delivery recovery. */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import * as feedbackApi from '@/features/feedback/services/feedbackApi';
import { TESTIDS } from '@/testids';

import { FeedbackTab } from '../FeedbackTab';

vi.mock('@/features/feedback/services/feedbackApi');
vi.mock('@/utils/errorPipeline', () => ({ handleError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn() } }));

function createDeferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

it('reuses the operation after a lost response, shows uncertainty, and reconciles the stored record', async () => {
  const user = userEvent.setup();
  const getHistory = vi.mocked(feedbackApi.getFeedbackHistory).mockResolvedValue([]);
  const submit = vi
    .mocked(feedbackApi.submitFeedback)
    .mockRejectedValueOnce(new Error('response lost'))
    .mockResolvedValueOnce({ feedbackId: 'stored-id', syncStatus: 'uncertain' });
  const item: feedbackApi.FeedbackItem = {
    id: 'stored-id',
    content: '反馈内容',
    appVersion: '1.0',
    githubIssueNumber: null,
    status: 'open',
    syncStatus: 'uncertain',
    createdAt: '2026-09-17T00:00:00.000Z',
    replies: [],
  };
  render(<FeedbackTab isLoggedIn onUnreadChange={vi.fn()} />);

  await user.click(await screen.findByTestId(TESTIDS.feedbackNewButton));
  await user.type(screen.getByTestId(TESTIDS.feedbackInput), '反馈内容');
  await user.click(screen.getByTestId(TESTIDS.feedbackSubmitButton));
  expect(screen.getByTestId(TESTIDS.feedbackSubmitButton)).toBeEnabled();
  getHistory.mockResolvedValue([item]);
  await user.click(screen.getByTestId(TESTIDS.feedbackSubmitButton));
  expect(await screen.findByText('待同步')).toBeInTheDocument();
  expect(submit).toHaveBeenCalledTimes(2);
  expect(submit.mock.calls[0]?.[2]).toEqual(submit.mock.calls[1]?.[2]);
  expect(submit.mock.calls[0]?.[2]).toEqual(expect.any(String));

  await user.click(screen.getByTestId(TESTIDS.feedbackHistoryItem(item.id)));
  expect(screen.getByText('远端结果待核对')).toBeInTheDocument();
  expect(screen.getByTestId(TESTIDS.feedbackResolveButton)).toBeDisabled();

  const synchronization =
    createDeferred<Awaited<ReturnType<typeof feedbackApi.syncFeedbackDelivery>>>();
  const refreshedHistory = createDeferred<feedbackApi.FeedbackItem[]>();
  vi.mocked(feedbackApi.syncFeedbackDelivery).mockReturnValueOnce(synchronization.promise);
  getHistory.mockReturnValueOnce(refreshedHistory.promise);
  const syncButton = screen.getByRole('button', { name: '核对反馈同步状态' });
  expect(syncButton).toBeEnabled();
  await user.click(syncButton);
  expect(feedbackApi.syncFeedbackDelivery).toHaveBeenCalledWith(item.id);
  expect(getHistory).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', { name: '核对反馈同步状态' })).toBeDisabled();

  await act(async () => {
    synchronization.resolve({ success: true, syncStatus: 'synced' });
    await synchronization.promise;
  });
  expect(getHistory).toHaveBeenCalledTimes(3);
  expect(screen.getByText('远端结果待核对')).toBeInTheDocument();

  await act(async () => {
    refreshedHistory.resolve([{ ...item, syncStatus: 'synced', githubIssueNumber: 42 }]);
    await refreshedHistory.promise;
  });
  expect(screen.queryByText('远端结果待核对')).toBeNull();
  expect(screen.getByTestId(TESTIDS.feedbackResolveButton)).toBeEnabled();
  expect(submit).toHaveBeenCalledTimes(2);
});
