import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

// This test exercises the real AuthProvider — undo the global mock from jest.setup.ts
jest.unmock('../../contexts/AuthContext');
jest.mock('@tanstack/react-query', () =>
  jest.requireActual<typeof import('@tanstack/react-query')>(
    '../../../node_modules/@tanstack/react-query/build/modern/index.cjs',
  ),
);

import { useAuthContext as useAuth, type User } from '@/contexts/AuthContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { useServices } from '@/contexts/ServiceContext';
import type { AuthSession, AuthUser, UserMetadata } from '@/services/types/IAuthService';

// Mock service functions used by AuthProvider via useServices()
const mockGetCurrentUser = jest.fn();
let mockSession: AuthSession | null = null;
const mockListeners = new Set<() => void>();
let queryClient: QueryClient;

function publishUser(user: AuthUser | null): void {
  mockSession = user === null ? null : { userId: user.id, initialUser: user };
  mockListeners.forEach((listener) => listener());
}

// Access the jest-mocked useServices to override return values
const mockUseServices = useServices as jest.Mock;

const EMPTY_USER_METADATA: UserMetadata = {
  display_name: null,
  avatar_url: null,
  custom_avatar_url: null,
  avatar_frame: null,
  seat_flair: null,
  name_style: null,
  equipped_effect: null,
  seat_animation: null,
};

function createAuthUser(options: {
  id: string;
  email: string | null;
  isAnonymous?: boolean;
  metadata?: Partial<UserMetadata>;
}): AuthUser {
  return {
    id: options.id,
    email: options.email,
    is_anonymous: options.isAnonymous ?? false,
    has_wechat: false,
    user_metadata: { ...EMPTY_USER_METADATA, ...options.metadata },
  };
}

// Wrapper for renderHook that includes AuthProvider
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(
    QueryClientProvider,
    { client: queryClient },
    React.createElement(AuthProvider, null, children),
  );

describe('useAuth hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession = null;
    mockListeners.clear();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    mockGetCurrentUser.mockResolvedValue(null);

    // Override global ServiceContext mock with test-specific mock functions
    mockUseServices.mockReturnValue({
      authService: {
        getCurrentUser: mockGetCurrentUser,
        waitForInit: jest.fn(async () => {
          const response = (await mockGetCurrentUser()) as { data: { user: AuthUser } } | null;
          publishUser(response === null ? null : response.data.user);
        }),
        getAuthSession: () => mockSession,
        subscribeAuth: (listener: () => void) => {
          mockListeners.add(listener);
          return () => mockListeners.delete(listener);
        },
        getCurrentUserId: jest.fn().mockReturnValue('test-uid'),
        onAuthExpired: jest.fn().mockReturnValue(jest.fn()),
      },
      roomDirectory: {
        createRoom: jest.fn(),
        getRoom: jest.fn(),
        deleteRoom: jest.fn(),
      },
      settingsService: {
        load: jest.fn(),
        isBgmEnabled: jest.fn().mockReturnValue(true),
        getBgmTrack: jest.fn().mockReturnValue('random'),
        toggleBgm: jest.fn(),
        addListener: jest.fn().mockReturnValue(jest.fn()),
      },
      audioService: {
        startBgm: jest.fn(),
        stopBgm: jest.fn(),
        cleanup: jest.fn(),
      },
      avatarUploadService: {
        uploadAvatar: jest.fn(),
      },
    });
  });

  describe('Initial state', () => {
    it('surfaces initialization failure and recovers on explicit retry', async () => {
      mockGetCurrentUser.mockRejectedValueOnce(new Error('Initialization failed'));
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error).not.toBeNull();
      const user = createAuthUser({ id: 'restored-user', email: 'restored@example.com' });
      mockGetCurrentUser.mockResolvedValue({ data: { user } });
      act(() => result.current.retryInit());
      await waitFor(() => expect(result.current.user?.id).toBe(user.id));
      expect(result.current.error).toBeNull();
    });

    it('should start with null user when not authenticated', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should provide refreshUser method', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(typeof result.current.refreshUser).toBe('function');
    });

    it('should load user on mount via getCurrentUser', async () => {
      const mockAuthUser = createAuthUser({
        id: 'user-123',
        email: 'test@example.com',
        metadata: { display_name: 'Test User' },
      });
      mockGetCurrentUser.mockResolvedValue({ data: { user: mockAuthUser } });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: null,
        customAvatarUrl: null,
        avatarFrame: null,
        seatFlair: null,
        nameStyle: null,
        equippedEffect: null,
        seatAnimation: null,
        isAnonymous: false,
      });
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('refreshUser', () => {
    it('discards a late profile response after switching accounts', async () => {
      const previousUser = createAuthUser({ id: 'previous-user', email: 'previous@example.com' });
      mockGetCurrentUser.mockResolvedValue({ data: { user: previousUser } });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      queryClient.setQueryData(['userStats', previousUser.id], { level: 99 });
      let finishRefresh!: (response: { data: { user: AuthUser } }) => void;
      mockGetCurrentUser.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishRefresh = resolve;
          }),
      );
      let refreshOutcome!: Promise<void>;
      await act(async () => {
        refreshOutcome = expect(result.current.refreshUser()).rejects.toBeDefined();
        await Promise.resolve();
      });
      const currentUser = createAuthUser({ id: 'current-user', email: 'current@example.com' });
      await act(async () => {
        publishUser(currentUser);
        finishRefresh({ data: { user: previousUser } });
        await refreshOutcome;
      });
      expect(result.current.user?.id).toBe(currentUser.id);
      expect(result.current.error).toBeNull();
      expect(queryClient.getQueryData(['authUser', previousUser.id])).toBeUndefined();
      expect(queryClient.getQueryData(['userStats', previousUser.id])).toBeUndefined();
    });

    it('replaces cached metadata when the same identity is upgraded', async () => {
      const anonymousUser = createAuthUser({ id: 'same-user', email: null, isAnonymous: true });
      mockGetCurrentUser.mockResolvedValue({ data: { user: anonymousUser } });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        publishUser(createAuthUser({ id: 'same-user', email: 'upgraded@example.com' }));
      });
      expect(result.current.user?.isAnonymous).toBe(false);
      expect(result.current.user?.email).toBe('upgraded@example.com');
    });

    it('should publish login without requesting the profile again', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();

      // Simulate sign-in happening externally (via mutation hook)
      const mockAuthUser = createAuthUser({
        id: 'user-456',
        email: 'refresh@example.com',
        metadata: { display_name: 'Refreshed User' },
      });
      mockGetCurrentUser.mockResolvedValue({ data: { user: mockAuthUser } });

      await act(async () => {
        publishUser(mockAuthUser);
      });
      expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);

      expect(result.current.user).toEqual({
        id: 'user-456',
        email: 'refresh@example.com',
        displayName: 'Refreshed User',
        avatarUrl: null,
        customAvatarUrl: null,
        avatarFrame: null,
        seatFlair: null,
        nameStyle: null,
        equippedEffect: null,
        seatAnimation: null,
        isAnonymous: false,
      });
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should clear user and cached data when signed out', async () => {
      // Start with a user
      const mockAuthUser = createAuthUser({ id: 'user-123', email: 'test@example.com' });
      mockGetCurrentUser.mockResolvedValue({ data: { user: mockAuthUser } });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(true);

      // Simulate sign-out: getCurrentUser now returns null
      mockGetCurrentUser.mockResolvedValue(null);

      await act(async () => {
        publishUser(null);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(queryClient.getQueryData(['authUser', 'user-123'])).toBeUndefined();
    });

    it('should reject refresh failure and keep the last confirmed profile', async () => {
      // Start with a user
      const mockAuthUser = createAuthUser({ id: 'user-123', email: 'test@example.com' });
      mockGetCurrentUser.mockResolvedValue({ data: { user: mockAuthUser } });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(true);

      // Simulate network error during refresh
      mockGetCurrentUser.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        await expect(result.current.refreshUser()).rejects.toThrow('Network error');
      });

      // User state kept (not cleared)
      expect(result.current.user?.id).toBe('user-123');
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('User type conversion', () => {
    it('should correctly convert auth user to User type', async () => {
      const mockAuthUser = createAuthUser({
        id: 'user-456',
        email: 'full@example.com',
        metadata: {
          display_name: 'Full User',
          avatar_url: 'https://example.com/avatar.png',
        },
      });
      mockGetCurrentUser.mockResolvedValue({ data: { user: mockAuthUser } });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toEqual({
        id: 'user-456',
        email: 'full@example.com',
        displayName: 'Full User',
        avatarUrl: 'https://example.com/avatar.png',
        customAvatarUrl: null,
        avatarFrame: null,
        seatFlair: null,
        nameStyle: null,
        equippedEffect: null,
        seatAnimation: null,
        isAnonymous: false,
      });
    });

    it('should handle anonymous users correctly', async () => {
      const mockAuthUser = createAuthUser({
        id: 'anon-123',
        email: null,
        isAnonymous: true,
      });
      mockGetCurrentUser.mockResolvedValue({ data: { user: mockAuthUser } });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toEqual({
        id: 'anon-123',
        email: null,
        displayName: null,
        avatarUrl: null,
        customAvatarUrl: null,
        avatarFrame: null,
        seatFlair: null,
        nameStyle: null,
        equippedEffect: null,
        seatAnimation: null,
        isAnonymous: true,
      });
    });

    it('should map empty canonical user metadata to null presentation fields', async () => {
      const mockAuthUser = createAuthUser({ id: 'user-789', email: 'test@example.com' });
      mockGetCurrentUser.mockResolvedValue({ data: { user: mockAuthUser } });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user?.displayName).toBeNull();
      expect(result.current.user?.avatarUrl).toBeNull();
    });
  });
});

describe('User interface', () => {
  it('should define User interface with correct properties', () => {
    const user: User = {
      id: 'test-uid',
      email: 'test@example.com',
      displayName: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg',
      customAvatarUrl: 'https://example.com/avatar.jpg',
      avatarFrame: null,
      seatFlair: null,
      nameStyle: null,
      equippedEffect: null,
      seatAnimation: null,
      isAnonymous: false,
    };

    expect(user.id).toBe('test-uid');
    expect(user.email).toBe('test@example.com');
    expect(user.displayName).toBe('Test User');
    expect(user.avatarUrl).toBe('https://example.com/avatar.jpg');
    expect(user.customAvatarUrl).toBe('https://example.com/avatar.jpg');
    expect(user.isAnonymous).toBe(false);
  });

  it('should allow null values for optional fields', () => {
    const user: User = {
      id: 'anon-uid',
      email: null,
      displayName: null,
      avatarUrl: null,
      customAvatarUrl: null,
      avatarFrame: null,
      seatFlair: null,
      nameStyle: null,
      equippedEffect: null,
      seatAnimation: null,
      isAnonymous: true,
    };

    expect(user.id).toBe('anon-uid');
    expect(user.email).toBeNull();
    expect(user.displayName).toBeNull();
    expect(user.avatarUrl).toBeNull();
    expect(user.isAnonymous).toBe(true);
  });
});
