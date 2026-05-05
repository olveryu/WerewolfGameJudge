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
import * as Sentry from '@sentry/react-native';
import type React from 'react';
import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';

import { useServices } from '@/contexts/ServiceContext';
import type { AuthUser } from '@/services/types/IAuthService';
import {
  getUserFacingMessage,
  isAbortError,
  isExpectedError,
  isNetworkError,
} from '@/utils/errorUtils';
import { authLog } from '@/utils/logger';

export interface User {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  /** Persisted remote URL from last upload — survives builtin avatar switch */
  customAvatarUrl: string | null;
  /** Selected avatar frame ID (e.g. 'lunar', 'wolfFang') */
  avatarFrame: string | null;
  /** Selected seat flair ID (decoration around seat tile) */
  seatFlair: string | null;
  /** Selected name style ID (text effect on player name) */
  nameStyle: string | null;
  /** Selected role reveal effect ID (animation when viewing role) */
  equippedEffect: string | null;
  /** Selected seat entrance animation ID */
  seatAnimation: string | null;
  isAnonymous: boolean;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  /** 小程序微信登录是否失败（App 层根据此值渲染全屏错误页） */
  wechatLoginFailed: boolean;
  /** Re-fetch current user from service and update local state. */
  refreshUser: () => Promise<void>;
  /** Re-run initial auth (waitForInit + getCurrentUser). Used by boot error retry. */
  retryInit: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Shallow equality check for User objects to prevent unnecessary re-renders
const userEquals = (a: User | null, b: User | null): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.email === b.email &&
    a.displayName === b.displayName &&
    a.avatarUrl === b.avatarUrl &&
    a.customAvatarUrl === b.customAvatarUrl &&
    a.avatarFrame === b.avatarFrame &&
    a.seatFlair === b.seatFlair &&
    a.nameStyle === b.nameStyle &&
    a.equippedEffect === b.equippedEffect &&
    a.seatAnimation === b.seatAnimation &&
    a.isAnonymous === b.isAnonymous
  );
};

/** Normalize empty string to null (server may send "" for unequipped fields). */
function emptyToNull(val: string | null | undefined): string | null {
  return val && val !== '' ? val : null;
}

// Convert auth user to our User type
const toUser = (authUser: AuthUser | null): User | null => {
  if (!authUser) return null;
  const meta = authUser.user_metadata;
  return {
    id: authUser.id,
    email: authUser.email ?? null,
    displayName: emptyToNull(meta?.display_name),
    avatarUrl: emptyToNull(meta?.avatar_url),
    customAvatarUrl: emptyToNull(meta?.custom_avatar_url),
    avatarFrame: emptyToNull(meta?.avatar_frame),
    seatFlair: emptyToNull(meta?.seat_flair),
    nameStyle: emptyToNull(meta?.name_style),
    equippedEffect: emptyToNull(meta?.equipped_effect),
    seatAnimation: emptyToNull(meta?.seat_animation),
    isAnonymous: authUser.is_anonymous ?? false,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get services from composition root (via ServiceContext)
  const { authService } = useServices();

  // Only update user state if data actually changed (prevents unnecessary re-renders)
  const updateUserIfChanged = useCallback((newUser: User | null) => {
    setUser((prev) => (userEquals(prev, newUser) ? prev : newUser));
  }, []);

  // Load current user — called on mount and by retryInit.
  const loadUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await authService.waitForInit();
      const result = await authService.getCurrentUser();
      if (result?.data?.user) {
        const u = toUser(result.data.user);
        updateUserIfChanged(u);
        if (u) {
          authLog.info('User loaded', { id: u.id, isAnonymous: u.isAnonymous });
        }
      } else {
        authLog.info('No stored user');
      }
    } catch (e: unknown) {
      const friendly = getUserFacingMessage(e);
      authLog.error('auth error', { label: 'Failed to load user' }, e);
      if (!isExpectedError(e) && !isAbortError(e) && !isNetworkError(e)) Sentry.captureException(e);
      setError(friendly);
    } finally {
      setLoading(false);
    }
  }, [authService, updateUserIfChanged]);

  // Run once at app startup
  // wxcode auth is handled by CFAuthService.#autoSignIn (service layer),
  // so waitForInit() guarantees #currentUserId is ready before we read user state.
  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  /** Re-run initial auth. Used by boot error retry UI. */
  const retryInit = useCallback(() => {
    void loadUser();
  }, [loadUser]);

  /** Re-fetch current user from service and update local state. */
  const refreshUser = useCallback(async () => {
    try {
      const result = await authService.getCurrentUser();
      const u = result?.data?.user ? toUser(result.data.user) : null;
      updateUserIfChanged(u);
    } catch (e: unknown) {
      authLog.warn('refreshUser failed, keeping current state', e);
    }
  }, [authService, updateUserIfChanged]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      isAuthenticated: !!user,
      wechatLoginFailed: authService.wechatLoginFailed,
      refreshUser,
      retryInit,
    }),
    [user, loading, error, authService.wechatLoginFailed, refreshUser, retryInit],
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
