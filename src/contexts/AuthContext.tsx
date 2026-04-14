/**
 * AuthContext - Global auth state shared across all screens
 *
 * Solves the "login flicker" problem where each screen had its own
 * useAuth() state that resets on navigation (mount/unmount).
 *
 * Now auth state lives at App level - single subscription, single state.
 * 管理 auth 状态、订阅 onAuthStateChange、提供 login/logout/updateProfile。
 * 不包含游戏业务逻辑，不直接操作游戏状态。
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import React, { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';

import { LAST_ROOM_NUMBER_KEY } from '@/config/storageKeys';
import { useServices } from '@/contexts/ServiceContext';
import type { AuthUser } from '@/services/types/IAuthService';
import { isAbortError, isNetworkError } from '@/utils/errorUtils';
import { authLog, isExpectedAuthError, mapAuthError } from '@/utils/logger';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  /** Persisted remote URL from last upload — survives builtin avatar switch */
  customAvatarUrl: string | null;
  /** Selected avatar frame ID (e.g. 'lunar', 'wolfFang') */
  avatarFrame: string | null;
  /** Selected seat flair ID (decoration around seat tile) */
  seatFlair: string | null;
  isAnonymous: boolean;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  signInAnonymously: () => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  updateProfile: (updates: {
    displayName?: string;
    avatarUrl?: string;
    avatarFrame?: string;
    seatFlair?: string;
  }) => Promise<void>;
  uploadAvatar: (fileUri: string) => Promise<string>;
  signOut: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  signInWithWechat: (code: string) => Promise<void>;
  bindWechat: (code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Shallow equality check for User objects to prevent unnecessary re-renders
const userEquals = (a: User | null, b: User | null): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.uid === b.uid &&
    a.email === b.email &&
    a.displayName === b.displayName &&
    a.avatarUrl === b.avatarUrl &&
    a.customAvatarUrl === b.customAvatarUrl &&
    a.avatarFrame === b.avatarFrame &&
    a.seatFlair === b.seatFlair &&
    a.isAnonymous === b.isAnonymous
  );
};

// Convert auth user to our User type
const toUser = (authUser: AuthUser | null): User | null => {
  if (!authUser) return null;
  return {
    uid: authUser.id,
    email: authUser.email || null,
    displayName: (authUser.user_metadata?.display_name as string) || null,
    avatarUrl: (authUser.user_metadata?.avatar_url as string) || null,
    customAvatarUrl: (authUser.user_metadata?.custom_avatar_url as string) || null,
    avatarFrame: (authUser.user_metadata?.avatar_frame as string) || null,
    seatFlair: (authUser.user_metadata?.seat_flair as string) || null,
    isAnonymous: authUser.is_anonymous || false,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get services from composition root (via ServiceContext)
  const { authService, avatarUploadService } = useServices();

  // Only update user state if data actually changed (prevents unnecessary re-renders)
  const updateUserIfChanged = useCallback((newUser: User | null) => {
    setUser((prev) => (userEquals(prev, newUser) ? prev : newUser));
  }, []);

  /**
   * Shared auth error handler — DRY extraction of 7 near-identical catch blocks.
   *
   * Logs, conditionally reports to Sentry (skipping expected auth errors),
   * sets error state, and optionally re-throws a user-friendly Error.
   */
  const handleAuthError = useCallback((e: unknown, label: string, opts?: { rethrow?: boolean }) => {
    const raw = e instanceof Error ? e.message : String(e);
    const friendly = mapAuthError(raw);
    authLog.error(`${label}:`, raw, e);
    if (!isExpectedAuthError(raw) && !isAbortError(e) && !isNetworkError(e))
      Sentry.captureException(e);
    setError(friendly);
    if (opts?.rethrow) throw new Error(friendly);
  }, []);

  // Load current user on mount - runs ONCE at app startup
  // wxcode auth is handled by CFAuthService.#autoSignIn (service layer),
  // so waitForInit() guarantees #currentUserId is ready before we read user state.
  useEffect(() => {
    const loadUser = async () => {
      try {
        await authService.waitForInit();
        const result = await authService.getCurrentUser();
        if (result?.data?.user) {
          const u = toUser(result.data.user);
          updateUserIfChanged(u);
          if (u) Sentry.setUser({ id: u.uid });
        }
      } catch (e: unknown) {
        handleAuthError(e, 'Failed to load user');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [authService, handleAuthError, updateUserIfChanged]);

  const signInAnonymously = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await authService.signInAnonymously();
      const result = await authService.getCurrentUser();
      if (result?.data?.user) {
        const u = toUser(result.data.user);
        updateUserIfChanged(u);
        if (u) Sentry.setUser({ id: u.uid });
      }
    } catch (e: unknown) {
      handleAuthError(e, 'Anonymous sign-in failed', { rethrow: true });
    } finally {
      setLoading(false);
    }
  }, [authService, handleAuthError, updateUserIfChanged]);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await authService.signUpWithEmail(email, password, displayName);
        if (result.user) {
          const u = toUser(result.user);
          updateUserIfChanged(u);
          if (u) Sentry.setUser({ id: u.uid });
        }
      } catch (e: unknown) {
        handleAuthError(e, 'Email sign-up failed', { rethrow: true });
      } finally {
        setLoading(false);
      }
    },
    [authService, handleAuthError, updateUserIfChanged],
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        await authService.signInWithEmail(email, password);
        const result = await authService.getCurrentUser();
        if (result?.data?.user) {
          const u = toUser(result.data.user);
          updateUserIfChanged(u);
          if (u) Sentry.setUser({ id: u.uid });
        }
      } catch (e: unknown) {
        handleAuthError(e, 'Email sign-in failed', { rethrow: true });
      } finally {
        setLoading(false);
      }
    },
    [authService, handleAuthError, updateUserIfChanged],
  );

  const updateProfile = useCallback(
    async (updates: { displayName?: string; avatarUrl?: string }) => {
      setError(null);
      try {
        await authService.updateProfile(updates);
        const result = await authService.getCurrentUser();
        if (result?.data?.user) {
          updateUserIfChanged(toUser(result.data.user));
        }
      } catch (e: unknown) {
        handleAuthError(e, 'Update profile failed', { rethrow: true });
      }
    },
    [authService, handleAuthError, updateUserIfChanged],
  );

  const uploadAvatar = useCallback(
    async (fileUri: string): Promise<string> => {
      setError(null);
      try {
        const url = await avatarUploadService.uploadAvatar(fileUri);
        const result = await authService.getCurrentUser();
        if (result?.data?.user) {
          updateUserIfChanged(toUser(result.data.user));
        }
        return url;
      } catch (e: unknown) {
        // handleAuthError with rethrow always throws; explicit throw satisfies TS return type
        handleAuthError(e, 'Upload avatar failed', { rethrow: true });
        throw e; // unreachable — TS control-flow hint
      }
    },
    [authService, avatarUploadService, handleAuthError, updateUserIfChanged],
  );

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await authService.signOut();
      await AsyncStorage.removeItem(LAST_ROOM_NUMBER_KEY);
      setUser(null);
      Sentry.setUser(null);
    } catch (e: unknown) {
      handleAuthError(e, 'Sign-out failed');
    } finally {
      setLoading(false);
    }
  }, [authService, handleAuthError]);

  const changePassword = useCallback(
    async (oldPassword: string, newPassword: string) => {
      setError(null);
      try {
        await authService.changePassword(oldPassword, newPassword);
      } catch (e: unknown) {
        handleAuthError(e, 'Change password failed', { rethrow: true });
      }
    },
    [authService, handleAuthError],
  );

  const forgotPassword = useCallback(
    async (email: string) => {
      setError(null);
      try {
        await authService.forgotPassword(email);
      } catch (e: unknown) {
        handleAuthError(e, 'Forgot password failed', { rethrow: true });
      }
    },
    [authService, handleAuthError],
  );

  const resetPassword = useCallback(
    async (email: string, code: string, newPassword: string) => {
      setLoading(true);
      setError(null);
      try {
        await authService.resetPassword(email, code, newPassword);
        const result = await authService.getCurrentUser();
        if (result?.data?.user) {
          const u = toUser(result.data.user);
          updateUserIfChanged(u);
          if (u) Sentry.setUser({ id: u.uid });
        }
      } catch (e: unknown) {
        handleAuthError(e, 'Reset password failed', { rethrow: true });
      } finally {
        setLoading(false);
      }
    },
    [authService, handleAuthError, updateUserIfChanged],
  );

  const signInWithWechat = useCallback(
    async (code: string) => {
      setLoading(true);
      setError(null);
      try {
        await authService.signInWithWechat(code);
        const result = await authService.getCurrentUser();
        if (result?.data?.user) {
          const u = toUser(result.data.user);
          updateUserIfChanged(u);
          if (u) Sentry.setUser({ id: u.uid });
        }
      } catch (e: unknown) {
        handleAuthError(e, 'WeChat sign-in failed', { rethrow: true });
      } finally {
        setLoading(false);
      }
    },
    [authService, handleAuthError, updateUserIfChanged],
  );

  const bindWechat = useCallback(
    async (code: string) => {
      setError(null);
      try {
        await authService.bindWechat(code);
      } catch (e: unknown) {
        handleAuthError(e, 'Bind WeChat failed', { rethrow: true });
      }
    },
    [authService, handleAuthError],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      isAuthenticated: !!user,
      signInAnonymously,
      signUpWithEmail,
      signInWithEmail,
      updateProfile,
      uploadAvatar,
      signOut,
      changePassword,
      forgotPassword,
      resetPassword,
      signInWithWechat,
      bindWechat,
    }),
    [
      user,
      loading,
      error,
      signInAnonymously,
      signUpWithEmail,
      signInWithEmail,
      updateProfile,
      uploadAvatar,
      signOut,
      changePassword,
      forgotPassword,
      resetPassword,
      signInWithWechat,
      bindWechat,
    ],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
};

export const useAuthContext = (): AuthContextValue => {
  const context = use(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
