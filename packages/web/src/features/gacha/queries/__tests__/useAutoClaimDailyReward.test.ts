/** Daily rewards follow account lifecycle without requiring a Home screen mount. */
import { act, renderHook } from '@testing-library/react';
import { toast } from 'sonner';

import type { DailyRewardResponse } from '@/features/gacha/services/gachaApi';

import { useAutoClaimDailyReward } from '../useAutoClaimDailyReward';

let mockUserId: string | null = 'first';
let mockSession: { userId: string } | null = { userId: 'first' };
const mockAuthService = { getAuthSession: () => mockSession };
const mockClaim = vi.fn<
  (
    variables: undefined,
    callbacks: {
      onSuccess: (data: DailyRewardResponse) => void;
      onError: (error: Error) => void;
    },
  ) => void
>();
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({ user: mockUserId === null ? null : { id: mockUserId } }),
}));
vi.mock('@/contexts/ServiceContext', () => ({
  useServices: () => ({ authService: mockAuthService }),
}));
vi.mock('@/features/auth/queries/useAuthenticatedQuery', () => ({
  useAuthenticatedQuery: () => ({ data: {} }),
}));
vi.mock('@tanstack/react-query', () => ({
  queryOptions: (options: unknown) => options,
  useQueryClient: () => ({}),
  useMutation: () => ({ mutate: mockClaim, isPending: false }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUserId = 'first';
  mockSession = { userId: 'first' };
});

it('claims once without Home and ignores a late response from the previous account', () => {
  const { rerender } = renderHook(useAutoClaimDailyReward);
  rerender();
  expect(mockClaim).toHaveBeenCalledTimes(1);
  const first = mockClaim.mock.calls[0]![1];
  mockUserId = 'second';
  mockSession = { userId: 'second' };
  rerender();
  expect(mockClaim).toHaveBeenCalledTimes(2);
  act(() => first.onSuccess({ claimed: true, normalDrawsAdded: 1, goldenDrawsAdded: 1 }));
  expect(toast.success).not.toHaveBeenCalled();
});

it('permits a new login session after logout without claiming while logged out', () => {
  const { rerender } = renderHook(useAutoClaimDailyReward);
  mockUserId = null;
  mockSession = null;
  rerender();
  expect(mockClaim).toHaveBeenCalledTimes(1);
  mockUserId = 'first';
  mockSession = { userId: 'first' };
  rerender();
  expect(mockClaim).toHaveBeenCalledTimes(2);
});
