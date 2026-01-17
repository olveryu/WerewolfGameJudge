import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAuth, User } from '../useAuth';

// Mock supabase config
jest.mock('../../config/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: jest.fn(() => false),
}));

// Mock AuthService
const mockSignInAnonymously = jest.fn();
const mockSignUpWithEmail = jest.fn();
const mockSignInWithEmail = jest.fn();
const mockUpdateProfile = jest.fn();
const mockSignOut = jest.fn();
const mockGetCurrentUser = jest.fn();

jest.mock('../../services/AuthService', () => ({
  AuthService: {
    getInstance: jest.fn(() => ({
      signInAnonymously: mockSignInAnonymously,
      signUpWithEmail: mockSignUpWithEmail,
      signInWithEmail: mockSignInWithEmail,
      updateProfile: mockUpdateProfile,
      signOut: mockSignOut,
      getCurrentUser: mockGetCurrentUser,
    })),
  },
}));

// Mock AvatarUploadService
const mockUploadAvatar = jest.fn();

jest.mock('../../services/AvatarUploadService', () => ({
  AvatarUploadService: {
    getInstance: jest.fn(() => ({
      uploadAvatar: mockUploadAvatar,
    })),
  },
}));

describe('useAuth hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ data: { user: null } });
  });

  describe('Initial state', () => {
    it('should start with null user when supabase is not configured', async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should provide all auth methods', () => {
      const { result } = renderHook(() => useAuth());

      expect(typeof result.current.signInAnonymously).toBe('function');
      expect(typeof result.current.signUpWithEmail).toBe('function');
      expect(typeof result.current.signInWithEmail).toBe('function');
      expect(typeof result.current.updateProfile).toBe('function');
      expect(typeof result.current.uploadAvatar).toBe('function');
      expect(typeof result.current.signOut).toBe('function');
    });
  });

  describe('signInAnonymously', () => {
    it('should call authService.signInAnonymously', async () => {
      mockSignInAnonymously.mockResolvedValue({});

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signInAnonymously();
      });

      expect(mockSignInAnonymously).toHaveBeenCalled();
    });

    it('should set error when signInAnonymously fails', async () => {
      const errorMessage = 'Sign in failed';
      mockSignInAnonymously.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.signInAnonymously();
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe('signUpWithEmail', () => {
    it('should call authService.signUpWithEmail with correct params', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { display_name: 'Test User' },
        is_anonymous: false,
      };
      mockSignUpWithEmail.mockResolvedValue({ user: mockUser });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signUpWithEmail('test@example.com', 'password123', 'Test User');
      });

      expect(mockSignUpWithEmail).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
        'Test User',
      );
    });

    it('should update user state after successful signup', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { display_name: 'Test User', avatar_url: null },
        is_anonymous: false,
      };
      mockSignUpWithEmail.mockResolvedValue({ user: mockUser });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signUpWithEmail('test@example.com', 'password123');
      });

      expect(result.current.user).toEqual({
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: null,
        isAnonymous: false,
      });
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should set error when signUpWithEmail fails', async () => {
      const errorMessage = 'Email already exists';
      mockSignUpWithEmail.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.signUpWithEmail('test@example.com', 'password123');
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe('signInWithEmail', () => {
    it('should call authService.signInWithEmail', async () => {
      mockSignInWithEmail.mockResolvedValue({});
      mockGetCurrentUser.mockResolvedValue({ data: { user: null } });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signInWithEmail('test@example.com', 'password123');
      });

      expect(mockSignInWithEmail).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    it('should set error when signInWithEmail fails', async () => {
      const errorMessage = 'Invalid credentials';
      mockSignInWithEmail.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.signInWithEmail('test@example.com', 'wrongpassword');
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe('updateProfile', () => {
    it('should call authService.updateProfile', async () => {
      mockUpdateProfile.mockResolvedValue({});
      mockGetCurrentUser.mockResolvedValue({ data: { user: null } });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateProfile({ displayName: 'New Name' });
      });

      expect(mockUpdateProfile).toHaveBeenCalledWith({ displayName: 'New Name' });
    });

    it('should set error when updateProfile fails', async () => {
      const errorMessage = 'Update failed';
      mockUpdateProfile.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.updateProfile({ displayName: 'New Name' });
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe('uploadAvatar', () => {
    it('should call avatarUploadService.uploadAvatar and return URL', async () => {
      const avatarUrl = 'https://example.com/avatar.jpg';
      mockUploadAvatar.mockResolvedValue(avatarUrl);
      mockGetCurrentUser.mockResolvedValue({ data: { user: null } });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let returnedUrl: string = '';
      await act(async () => {
        returnedUrl = await result.current.uploadAvatar('file:///path/to/image.jpg');
      });

      expect(mockUploadAvatar).toHaveBeenCalledWith('file:///path/to/image.jpg');
      expect(returnedUrl).toBe(avatarUrl);
    });

    it('should set error when uploadAvatar fails', async () => {
      const errorMessage = 'Upload failed';
      mockUploadAvatar.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.uploadAvatar('file:///path/to/image.jpg');
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe('signOut', () => {
    it('should call authService.signOut and clear user', async () => {
      mockSignOut.mockResolvedValue({});

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockSignOut).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should set error when signOut fails', async () => {
      const errorMessage = 'Sign out failed';
      mockSignOut.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe('User type conversion', () => {
    it('should correctly convert supabase user to User type', async () => {
      const mockSupabaseUser = {
        id: 'user-456',
        email: 'full@example.com',
        user_metadata: {
          display_name: 'Full User',
          avatar_url: 'https://example.com/avatar.png',
        },
        is_anonymous: false,
      };
      mockSignUpWithEmail.mockResolvedValue({ user: mockSupabaseUser });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signUpWithEmail('full@example.com', 'password123');
      });

      expect(result.current.user).toEqual({
        uid: 'user-456',
        email: 'full@example.com',
        displayName: 'Full User',
        avatarUrl: 'https://example.com/avatar.png',
        isAnonymous: false,
      });
    });

    it('should handle anonymous users correctly', async () => {
      const mockSupabaseUser = {
        id: 'anon-123',
        email: null,
        user_metadata: {},
        is_anonymous: true,
      };
      mockSignUpWithEmail.mockResolvedValue({ user: mockSupabaseUser });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signUpWithEmail('', '');
      });

      expect(result.current.user).toEqual({
        uid: 'anon-123',
        email: null,
        displayName: null,
        avatarUrl: null,
        isAnonymous: true,
      });
    });

    it('should handle missing user_metadata', async () => {
      const mockSupabaseUser = {
        id: 'user-789',
        email: 'test@example.com',
        is_anonymous: false,
      };
      mockSignUpWithEmail.mockResolvedValue({ user: mockSupabaseUser });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signUpWithEmail('test@example.com', 'password123');
      });

      expect(result.current.user?.displayName).toBeNull();
      expect(result.current.user?.avatarUrl).toBeNull();
    });
  });
});

describe('User interface', () => {
  it('should define User interface with correct properties', () => {
    const user: User = {
      uid: 'test-uid',
      email: 'test@example.com',
      displayName: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg',
      isAnonymous: false,
    };

    expect(user.uid).toBe('test-uid');
    expect(user.email).toBe('test@example.com');
    expect(user.displayName).toBe('Test User');
    expect(user.avatarUrl).toBe('https://example.com/avatar.jpg');
    expect(user.isAnonymous).toBe(false);
  });

  it('should allow null values for optional fields', () => {
    const user: User = {
      uid: 'anon-uid',
      email: null,
      displayName: null,
      avatarUrl: null,
      isAnonymous: true,
    };

    expect(user.uid).toBe('anon-uid');
    expect(user.email).toBeNull();
    expect(user.displayName).toBeNull();
    expect(user.avatarUrl).toBeNull();
    expect(user.isAnonymous).toBe(true);
  });
});
