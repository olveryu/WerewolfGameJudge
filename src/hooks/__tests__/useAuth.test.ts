import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

// This test exercises the real AuthProvider — undo the global mock from jest.setup.ts
jest.unmock('../../contexts/AuthContext');

import { useAuthContext as useAuth, type User } from '@/contexts/AuthContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { useServices } from '@/contexts/ServiceContext';

// Mock service functions used by AuthProvider via useServices()
const mockGetCurrentUser = jest.fn();

// Access the jest-mocked useServices to override return values
const mockUseServices = useServices as jest.Mock;

// Wrapper for renderHook that includes AuthProvider
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthProvider, null, children);

describe('useAuth hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ data: { user: null } });

    // Override global ServiceContext mock with test-specific mock functions
    mockUseServices.mockReturnValue({
      authService: {
        getCurrentUser: mockGetCurrentUser,
        waitForInit: jest.fn().mockResolvedValue(undefined),
        getCurrentUserId: jest.fn().mockReturnValue('test-uid'),
        onAuthStateChange: jest
          .fn()
          .mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
      },
      roomService: {
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
      const mockAuthUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { display_name: 'Test User' },
        is_anonymous: false,
      };
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
    it('should update user state from getCurrentUser', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();

      // Simulate sign-in happening externally (via mutation hook)
      const mockAuthUser = {
        id: 'user-456',
        email: 'refresh@example.com',
        user_metadata: { display_name: 'Refreshed User' },
        is_anonymous: false,
      };
      mockGetCurrentUser.mockResolvedValue({ data: { user: mockAuthUser } });

      await act(async () => {
        await result.current.refreshUser();
      });

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

    it('should clear user state when getCurrentUser returns null', async () => {
      // Start with a user
      const mockAuthUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: {},
        is_anonymous: false,
      };
      mockGetCurrentUser.mockResolvedValue({ data: { user: mockAuthUser } });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(true);

      // Simulate sign-out: getCurrentUser now returns null
      mockGetCurrentUser.mockResolvedValue({ data: { user: null } });

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should keep current state when getCurrentUser throws', async () => {
      // Start with a user
      const mockAuthUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: {},
        is_anonymous: false,
      };
      mockGetCurrentUser.mockResolvedValue({ data: { user: mockAuthUser } });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(true);

      // Simulate network error during refresh
      mockGetCurrentUser.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        await result.current.refreshUser();
      });

      // User state kept (not cleared)
      expect(result.current.user?.id).toBe('user-123');
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('User type conversion', () => {
    it('should correctly convert auth user to User type', async () => {
      const mockAuthUser = {
        id: 'user-456',
        email: 'full@example.com',
        user_metadata: {
          display_name: 'Full User',
          avatar_url: 'https://example.com/avatar.png',
        },
        is_anonymous: false,
      };
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
      const mockAuthUser = {
        id: 'anon-123',
        email: null,
        user_metadata: {},
        is_anonymous: true,
      };
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

    it('should handle missing user_metadata', async () => {
      const mockAuthUser = {
        id: 'user-789',
        email: 'test@example.com',
        is_anonymous: false,
      };
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
