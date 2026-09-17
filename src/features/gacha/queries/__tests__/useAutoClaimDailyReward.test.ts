/** Daily rewards follow account lifecycle without requiring a Home screen mount. */
import { act, renderHook } from '@testing-library/react-native';
import { toast } from 'sonner-native';

import type { DailyRewardResponse } from '@/features/gacha/services/gachaApi';

import { useAutoClaimDailyReward } from '../useGachaQuery';

let mockUserId: string | null = 'first';
let mockSession: { userId: string } | null = { userId: 'first' };
const mockAuthService = { getAuthSession: () => mockSession };
const mockClaim = jest.fn<
  void,
  [undefined, { onSuccess: (data: DailyRewardResponse) => void; onError: (error: Error) => void }]
>();
jest.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({ user: mockUserId === null ? null : { id: mockUserId } }),
}));
jest.mock('@/contexts/ServiceContext', () => ({
  useServices: () => ({ authService: mockAuthService }),
}));
jest.mock('@/features/auth/queries/useAuthenticatedQuery', () => ({
  useAuthenticatedQuery: () => ({ data: {} }),
}));
jest.mock('@tanstack/react-query', () => ({
  queryOptions: (options: unknown) => options,
  useQueryClient: () => ({}),
  useMutation: () => ({ mutate: mockClaim, isPending: false }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUserId = 'first';
  mockSession = { userId: 'first' };
});

it('claims once without Home and ignores a late response from the previous account', () => {
  const { rerender } = renderHook(useAutoClaimDailyReward);
  rerender(undefined);
  expect(mockClaim).toHaveBeenCalledTimes(1);
  const first = mockClaim.mock.calls[0]![1];
  mockUserId = 'second';
  mockSession = { userId: 'second' };
  rerender(undefined);
  expect(mockClaim).toHaveBeenCalledTimes(2);
  act(() => first.onSuccess({ claimed: true, normalDrawsAdded: 1, goldenDrawsAdded: 1 }));
  expect(toast.success).not.toHaveBeenCalled();
});

it('permits a new login session after logout without claiming while logged out', () => {
  const { rerender } = renderHook(useAutoClaimDailyReward);
  mockUserId = null;
  mockSession = null;
  rerender(undefined);
  expect(mockClaim).toHaveBeenCalledTimes(1);
  mockUserId = 'first';
  mockSession = { userId: 'first' };
  rerender(undefined);
  expect(mockClaim).toHaveBeenCalledTimes(2);
});
