/** Feedback UI preserves operation identity and exposes uncertain delivery recovery. */
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import * as feedbackApi from '@/features/feedback/services/feedbackApi';
import { TESTIDS } from '@/testids';

import { FeedbackTab } from '../components/FeedbackTab';

jest.mock('@/features/feedback/services/feedbackApi');
jest.mock('@/utils/errorPipeline', () => ({ handleError: jest.fn() }));
jest.mock('sonner-native', () => ({ toast: { success: jest.fn(), info: jest.fn() } }));

it('reuses the operation after a lost response, shows uncertainty, and reconciles the stored record', async () => {
  const getHistory = jest.mocked(feedbackApi.getFeedbackHistory).mockResolvedValue([]);
  const submit = jest
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
  const screen = render(
    <FeedbackTab scrollMaxHeight={600} isLoggedIn onUnreadChange={jest.fn()} />,
  );
  fireEvent.press(await screen.findByTestId(TESTIDS.feedbackNewButton));
  fireEvent.changeText(screen.getByTestId(TESTIDS.feedbackInput), '反馈内容');
  fireEvent.press(screen.getByTestId(TESTIDS.feedbackSubmitButton));
  await waitFor(() => expect(screen.getByTestId(TESTIDS.feedbackSubmitButton)).not.toBeDisabled());
  getHistory.mockResolvedValue([item]);
  fireEvent.press(screen.getByTestId(TESTIDS.feedbackSubmitButton));
  await screen.findByText('待同步');
  expect(submit).toHaveBeenCalledTimes(2);
  expect(submit.mock.calls[0]?.[2]).toEqual(submit.mock.calls[1]?.[2]);
  expect(submit.mock.calls[0]?.[2]).toEqual(expect.any(String));
  fireEvent.press(screen.getByTestId(TESTIDS.feedbackHistoryItem(item.id)));
  expect(screen.getByText('远端结果待核对')).toBeTruthy();
  expect(screen.getByTestId(TESTIDS.feedbackResolveButton)).toBeDisabled();
  jest
    .mocked(feedbackApi.syncFeedbackDelivery)
    .mockResolvedValue({ success: true, syncStatus: 'synced' });
  getHistory.mockResolvedValue([{ ...item, syncStatus: 'synced', githubIssueNumber: 42 }]);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '核对反馈同步状态' })).not.toBeDisabled(),
  );
  fireEvent.press(screen.getByRole('button', { name: '核对反馈同步状态' }));
  await waitFor(() => expect(screen.queryByText('远端结果待核对')).toBeNull());
  expect(feedbackApi.syncFeedbackDelivery).toHaveBeenCalledWith(item.id);
  expect(submit).toHaveBeenCalledTimes(2);
});
