/**
 * Auth context stand-in for room UI tests: the signed-in user is `TEST_USER_ID`.
 * Test files install it with
 * `vi.mock('@/contexts/AuthContext', () => import('<harness>/testAuthContext'))`.
 */

import type { User } from '@/contexts/AuthContext';

export const TEST_USER_ID = 'test-uid';

const TEST_USER: User = {
  id: TEST_USER_ID,
  email: null,
  displayName: '测试玩家',
  avatarUrl: null,
  customAvatarUrl: null,
  avatarFrame: null,
  seatFlair: null,
  nameStyle: null,
  equippedEffect: null,
  seatAnimation: null,
  isAnonymous: true,
};

export function useAuthContext() {
  return {
    user: TEST_USER,
    loading: false,
    error: null,
    isAuthenticated: true,
    needsWechatLogin: false,
    refreshUser: async () => undefined,
    retryInit: () => undefined,
  };
}
