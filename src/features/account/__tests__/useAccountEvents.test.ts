/** Foreground account consumption is independent of room identity and protects auth changes. */
import { act, renderHook } from '@testing-library/react-native';
import { toast } from 'sonner-native';

import { useAccountEvents } from '@/features/account/hooks/useAccountEvents';
import { cfGet, cfPost } from '@/services/cloudflare/cfFetch';
import type { AuthSession } from '@/services/types/IAuthService';
import { handleError } from '@/utils/errorPipeline';

let mockSession: AuthSession | null;
let mockIsVisible = true;
let mockAuthListener: () => void;
let mockVisibilityListener: () => void;
const mockAuthService = {
  getAuthSession: () => mockSession,
  subscribeAuth: (listener: () => void) => {
    mockAuthListener = listener;
    return jest.fn();
  },
};
const mockInvalidateQueries = jest.fn().mockResolvedValue(undefined);
const mockQueryClient = { invalidateQueries: mockInvalidateQueries };
jest.mock('@/contexts/ServiceContext', () => ({
  useServices: () => ({ authService: mockAuthService }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockQueryClient,
  queryOptions: (options: unknown) => options,
}));
jest.mock('@/services/infra/appVisibility', () => ({
  appVisibilityStore: {
    getSnapshot: () => mockIsVisible,
    subscribe: (listener: () => void) => {
      mockVisibilityListener = listener;
      return jest.fn();
    },
  },
}));
jest.mock('@/services/cloudflare/cfFetch');
jest.mock('@/utils/errorPipeline');

const event = {
  eventId: 'settlement-1',
  message: {
    type: 'SETTLE_RESULT',
    eventId: 'settlement-1',
    gameType: 'werewolf',
    settlementId: 'settlement-1',
    endedRevision: 12,
    xpEarned: 15,
    newXp: 40,
    newLevel: 2,
    previousLevel: 1,
    normalDrawsEarned: 2,
    goldenDrawsEarned: 1,
  },
};
const mockGet = jest.mocked(cfGet);
const mockPost = jest.mocked(cfPost);

function createDeferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockSession = { userId: 'owner', initialUser: null };
  mockIsVisible = true;
  mockGet.mockReset().mockResolvedValue({ event: null });
  mockPost.mockReset().mockResolvedValue({ success: true });
  mockInvalidateQueries.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  jest.useRealTimers();
});

it.each(['fibking', 'pictionary'])(
  'presents %s daily golden rewards without requiring a level-up',
  async (gameType) => {
    mockGet.mockResolvedValueOnce({
      event: {
        ...event,
        message: {
          ...event.message,
          gameType,
          previousLevel: 2,
          goldenDrawsEarned: 2,
        },
      },
    });
    const { unmount } = renderHook(useAccountEvents);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(toast.info).toHaveBeenCalledWith(
      '对局奖励到账',
      expect.objectContaining({
        description: `+${event.message.xpEarned} 经验 · ${event.message.normalDrawsEarned} 普通抽 · 2 黄金抽`,
      }),
    );
    expect(mockPost).toHaveBeenCalledTimes(1);
    unmount();
  },
);

it('refreshes before presentation, retries an uncertain ACK without another toast, and pauses hidden', async () => {
  mockGet.mockResolvedValueOnce({ event }).mockResolvedValueOnce({ event });
  mockPost.mockRejectedValueOnce(new Error('ack response lost'));
  const invalidation = createDeferred<void>();
  mockInvalidateQueries.mockReturnValueOnce(invalidation.promise);
  const { unmount } = renderHook(useAccountEvents);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(mockPost).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
  await act(async () => {
    invalidation.resolve();
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(toast.success).toHaveBeenCalledTimes(1);
  expect(handleError).toHaveBeenCalledWith(
    expect.any(Error),
    expect.objectContaining({ feedback: 'toast' }),
  );
  act(() => {
    mockIsVisible = false;
    mockVisibilityListener();
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30_000);
  });
  expect(mockGet).toHaveBeenCalledTimes(1);
  act(() => {
    mockIsVisible = true;
    mockVisibilityListener();
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(mockPost).toHaveBeenCalledTimes(2);
  expect(toast.success).toHaveBeenCalledTimes(1);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
});

it('cancels the old account read and never presents or acknowledges its late response', async () => {
  const pending = createDeferred<unknown>();
  mockGet.mockReturnValueOnce(pending.promise);
  const { unmount } = renderHook(useAccountEvents);
  const signal = mockGet.mock.calls[0]?.[2]?.signal;
  act(() => {
    mockSession = { userId: 'other', initialUser: null };
    mockAuthListener();
  });
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    pending.resolve({ event });
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(mockPost).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
  unmount();
});

it('keeps failed processing unacknowledged for retry', async () => {
  mockGet.mockResolvedValueOnce({ event }).mockResolvedValueOnce({ event });
  mockInvalidateQueries.mockRejectedValueOnce(new Error('refresh failed'));
  const { unmount } = renderHook(useAccountEvents);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(mockPost).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30_000);
  });
  expect(mockPost).toHaveBeenCalledTimes(1);
  expect(toast.success).toHaveBeenCalledTimes(1);
  unmount();
});
