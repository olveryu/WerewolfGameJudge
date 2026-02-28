/**
 * AuthService.configured.test.ts — 测试 Supabase configured 状态下的分支
 *
 * 覆盖 ensureAuthenticated 三级 fallback、getCurrentDisplayName 从 user_metadata 读取、
 * autoSignIn 错误上报 Sentry、getCurrentAvatarUrl 成功/失败路径。
 *
 * 与 AuthService.test.ts（unconfigured）互补：
 * - 该文件 mock isSupabaseConfigured=true + supabase 对象
 * - AuthService.test.ts mock supabase=null
 */

import * as Sentry from '@sentry/react-native';

// ─── Mock supabase (configured) ───────────────────────────────────────────────

const mockSignInAnonymously = jest.fn();
const mockGetSession = jest.fn();
const mockGetUser = jest.fn();
const mockSignOut = jest.fn();
const mockUpdateUser = jest.fn();

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}));

jest.mock('../supabaseClient', () => ({
  isSupabaseConfigured: jest.fn(() => true),
  supabase: {
    auth: {
      signInAnonymously: (...args: unknown[]) => mockSignInAnonymously(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    },
  },
}));

import { AuthService } from '@/services/infra/AuthService';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AuthService (configured)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no existing session
    mockGetSession.mockResolvedValue({ data: { session: null } });
  });

  describe('autoSignIn → constructor', () => {
    it('should restore session and set currentUserId on construction', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'restored-uid' } } },
      });

      const service = new AuthService();
      await service.waitForInit();

      expect(service.getCurrentUserId()).toBe('restored-uid');
    });

    it('should captureException when getSession throws', async () => {
      mockGetSession.mockRejectedValue(new Error('network down'));

      const service = new AuthService();
      await service.waitForInit();

      // Should not crash, but Sentry should have the error
      expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
      expect(service.getCurrentUserId()).toBeNull();
    });
  });

  describe('ensureAuthenticated', () => {
    it('should return cached userId if already authenticated', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'cached-uid' } } },
      });

      const service = new AuthService();
      await service.waitForInit();

      // First call should return cached
      const uid = await service.ensureAuthenticated();
      expect(uid).toBe('cached-uid');
      // getSession called once (autoSignIn), not again
      expect(mockGetSession).toHaveBeenCalledTimes(1);
    });

    it('should retry session restore when cached is null', async () => {
      // AutoSignIn: no session
      mockGetSession
        .mockResolvedValueOnce({ data: { session: null } })
        // ensureAuthenticated retry: found session
        .mockResolvedValueOnce({
          data: { session: { user: { id: 'retry-uid' } } },
        });

      const service = new AuthService();
      await service.waitForInit();

      expect(service.getCurrentUserId()).toBeNull();

      const uid = await service.ensureAuthenticated();
      expect(uid).toBe('retry-uid');
      expect(mockGetSession).toHaveBeenCalledTimes(2);
    });

    it('should fall back to signInAnonymously when retry also returns null', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });
      mockSignInAnonymously.mockResolvedValue({
        data: { user: { id: 'anon-uid' } },
        error: null,
      });

      const service = new AuthService();
      await service.waitForInit();

      const uid = await service.ensureAuthenticated();
      expect(uid).toBe('anon-uid');
      expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);
    });

    it('should throw when signInAnonymously fails', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });
      mockSignInAnonymously.mockResolvedValue({
        data: { user: null },
        error: new Error('auth failed'),
      });

      const service = new AuthService();
      await service.waitForInit();

      await expect(service.ensureAuthenticated()).rejects.toThrow('auth failed');
    });

    it('should throw when signInAnonymously succeeds but user.id is missing', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });
      mockSignInAnonymously.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const service = new AuthService();
      await service.waitForInit();

      await expect(service.ensureAuthenticated()).rejects.toThrow('FAIL-FAST');
    });
  });

  describe('getCurrentDisplayName', () => {
    it('should return registered name from user_metadata when available', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } });

      const service = new AuthService();
      await service.waitForInit();

      mockGetSession.mockResolvedValueOnce({
        data: { session: { user: { user_metadata: { display_name: '张三' } } } },
      });

      const name = await service.getCurrentDisplayName();
      expect(name).toBe('张三');
    });

    it('should fallback to generated name when getSession returns no display_name', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } });

      const service = new AuthService();
      await service.waitForInit();

      mockGetSession.mockResolvedValueOnce({
        data: { session: { user: { user_metadata: {} } } },
      });

      const name = await service.getCurrentDisplayName();
      // Should be a generated Chinese name, not 'anonymous'
      expect(name).toMatch(/[\u4e00-\u9fff]/);
    });

    it('should fallback to generated name when getSession throws', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } });

      const service = new AuthService();
      await service.waitForInit();

      mockGetSession.mockRejectedValueOnce(new Error('network error'));

      const name = await service.getCurrentDisplayName();
      expect(name).toMatch(/[\u4e00-\u9fff]/);
    });
  });

  describe('getCurrentAvatarUrl', () => {
    it('should return avatar_url from user_metadata', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } });

      const service = new AuthService();
      await service.waitForInit();

      mockGetSession.mockResolvedValueOnce({
        data: {
          session: { user: { user_metadata: { avatar_url: 'https://example.com/avatar.png' } } },
        },
      });

      const url = await service.getCurrentAvatarUrl();
      expect(url).toBe('https://example.com/avatar.png');
    });

    it('should return null when avatar_url is not set', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } });

      const service = new AuthService();
      await service.waitForInit();

      mockGetSession.mockResolvedValueOnce({
        data: { session: { user: { user_metadata: {} } } },
      });

      const url = await service.getCurrentAvatarUrl();
      expect(url).toBeNull();
    });

    it('should return null when getSession throws', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } });

      const service = new AuthService();
      await service.waitForInit();

      mockGetSession.mockRejectedValueOnce(new Error('network error'));

      const url = await service.getCurrentAvatarUrl();
      expect(url).toBeNull();
    });
  });

  describe('signOut', () => {
    it('should clear currentUserId on signOut', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'uid-1' } } },
      });
      mockSignOut.mockResolvedValue({});

      const service = new AuthService();
      await service.waitForInit();
      expect(service.getCurrentUserId()).toBe('uid-1');

      await service.signOut();
      expect(service.getCurrentUserId()).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should call supabase updateUser with correct metadata', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });
      mockUpdateUser.mockResolvedValue({ error: null });

      const service = new AuthService();
      await service.waitForInit();

      await service.updateProfile({ displayName: '李四', avatarUrl: 'https://img/a.png' });

      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: {
          display_name: '李四',
          avatar_url: 'https://img/a.png',
        },
      });
    });

    it('should throw when updateUser returns error', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });
      mockUpdateUser.mockResolvedValue({ error: new Error('forbidden') });

      const service = new AuthService();
      await service.waitForInit();

      await expect(service.updateProfile({ displayName: 'name' })).rejects.toThrow('forbidden');
    });
  });
});
