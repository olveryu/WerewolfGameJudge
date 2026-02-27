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
import type { User as SupabaseUser } from '@supabase/supabase-js';
import React, { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';

import { LAST_ROOM_NUMBER_KEY } from '@/config/storageKeys';
import { useServices } from '@/contexts/ServiceContext';
import { isSupabaseConfigured, supabase } from '@/services/infra/supabaseClient';
import { authLog, isExpectedAuthError, mapAuthError } from '@/utils/logger';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
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
  updateProfile: (updates: { displayName?: string; avatarUrl?: string }) => Promise<void>;
  uploadAvatar: (fileUri: string) => Promise<string>;
  signOut: () => Promise<void>;
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
    a.isAnonymous === b.isAnonymous
  );
};

// Convert Supabase user to our User type
const toUser = (supabaseUser: SupabaseUser | null): User | null => {
  if (!supabaseUser) return null;
  return {
    uid: supabaseUser.id,
    email: supabaseUser.email || null,
    displayName: supabaseUser.user_metadata?.display_name || null,
    avatarUrl: supabaseUser.user_metadata?.avatar_url || null,
    isAnonymous: supabaseUser.is_anonymous || false,
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
  const handleAuthError = useCallback(
    (e: unknown, label: string, opts?: { rethrow?: boolean }) => {
      const raw = e instanceof Error ? e.message : String(e);
      const friendly = mapAuthError(raw);
      authLog.error(`${label}:`, raw, e);
      if (!isExpectedAuthError(raw)) Sentry.captureException(e);
      setError(friendly);
      if (opts?.rethrow) throw new Error(friendly);
    },
    [],
  );

  // Load current user on mount - runs ONCE at app startup
  useEffect(() => {
    // Don't do anything if Supabase is not configured
    if (!isSupabaseConfigured() || !supabase) {
      setLoading(false);
      return;
    }

    const loadUser = async () => {
      try {
        const result = await authService.getCurrentUser();
        if (result?.data?.user) {
          updateUserIfChanged(toUser(result.data.user));
        }
      } catch (e: unknown) {
        handleAuthError(e, 'Failed to load user');
      } finally {
        setLoading(false);
      }
    };

    loadUser();

    // Listen for auth state changes - single subscription for entire app
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      authLog.info('Auth state changed:', event);
      if (session?.user) {
        updateUserIfChanged(toUser(session.user));
      } else {
        setUser(null);
      }
      // Only set loading false if it was true (avoid unnecessary re-render)
      setLoading((prev) => (prev ? false : prev));
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [authService, handleAuthError, updateUserIfChanged]);

  const signInAnonymously = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await authService.signInAnonymously();
    } catch (e: unknown) {
      handleAuthError(e, 'Anonymous sign-in failed', { rethrow: true });
    } finally {
      setLoading(false);
    }
  }, [authService, handleAuthError]);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await authService.signUpWithEmail(email, password, displayName);
        if (result.user) {
          setUser(toUser(result.user));
        }
      } catch (e: unknown) {
        handleAuthError(e, 'Email sign-up failed', { rethrow: true });
      } finally {
        setLoading(false);
      }
    },
    [authService, handleAuthError],
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        await authService.signInWithEmail(email, password);
        const result = await authService.getCurrentUser();
        if (result?.data?.user) {
          setUser(toUser(result.data.user));
        }
      } catch (e: unknown) {
        handleAuthError(e, 'Email sign-in failed', { rethrow: true });
      } finally {
        setLoading(false);
      }
    },
    [authService, handleAuthError],
  );

  const updateProfile = useCallback(
    async (updates: { displayName?: string; avatarUrl?: string }) => {
      setError(null);
      try {
        await authService.updateProfile(updates);
        const result = await authService.getCurrentUser();
        if (result?.data?.user) {
          setUser(toUser(result.data.user));
        }
      } catch (e: unknown) {
        handleAuthError(e, 'Update profile failed', { rethrow: true });
      }
    },
    [authService, handleAuthError],
  );

  const uploadAvatar = useCallback(
    async (fileUri: string): Promise<string> => {
      setError(null);
      try {
        const url = await avatarUploadService.uploadAvatar(fileUri);
        const result = await authService.getCurrentUser();
        if (result?.data?.user) {
          setUser(toUser(result.data.user));
        }
        return url;
      } catch (e: unknown) {
        // handleAuthError with rethrow always throws; explicit throw satisfies TS return type
        handleAuthError(e, 'Upload avatar failed', { rethrow: true });
        throw e; // unreachable — TS control-flow hint
      }
    },
    [authService, avatarUploadService, handleAuthError],
  );

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await authService.signOut();
      await AsyncStorage.removeItem(LAST_ROOM_NUMBER_KEY);
      setUser(null);
    } catch (e: unknown) {
      handleAuthError(e, 'Sign-out failed');
    } finally {
      setLoading(false);
    }
  }, [authService, handleAuthError]);

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
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = (): AuthContextValue => {
  const context = use(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
