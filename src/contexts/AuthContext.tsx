/**
 * AuthContext composes the service identity snapshot and the current-user Query cache.
 * Owns initialization feedback and cache isolation, not credentials or game state.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { createContext, use, useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { useServices } from '@/contexts/ServiceContext';
import { authQueryKeys, currentUserOptions } from '@/features/auth/queries/authQueryOptions';
import { navigationRef } from '@/navigation/navigationRef';
import type { AuthUser } from '@/services/types/IAuthService';
import { handleError } from '@/utils/errorPipeline';
import { getUserFacingMessage } from '@/utils/errorUtils';
import { authLog } from '@/utils/logger';
import { isMiniProgram } from '@/utils/miniProgram';

/** Client-side user info (mapped from AuthUser metadata). */
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
  /** Mini-program requires the user to manually sign in via WeChat (App layer renders the login entry page based on this value) */
  needsWechatLogin: boolean;
  /** Refresh profile data; rejects on failure without discarding the last confirmed profile. */
  refreshUser: () => Promise<void>;
  /** Re-run initial auth (waitForInit + getCurrentUser). Used by boot error retry. */
  retryInit: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Normalize empty string to null (server may send "" for unequipped fields). */
function emptyToNull(val: string | null): string | null {
  return val && val !== '' ? val : null;
}

// Convert auth user to our User type
const toUser = (authUser: AuthUser | null): User | null => {
  if (!authUser) return null;
  const meta = authUser.user_metadata;
  return {
    id: authUser.id,
    email: authUser.email,
    displayName: emptyToNull(meta.display_name),
    avatarUrl: emptyToNull(meta.avatar_url),
    customAvatarUrl: emptyToNull(meta.custom_avatar_url),
    avatarFrame: emptyToNull(meta.avatar_frame),
    seatFlair: emptyToNull(meta.seat_flair),
    nameStyle: emptyToNull(meta.name_style),
    equippedEffect: emptyToNull(meta.equipped_effect),
    seatAnimation: emptyToNull(meta.seat_animation),
    isAnonymous: authUser.is_anonymous,
  };
};

/**
 * Global auth state Provider.
 *
 * Maintains a single auth subscription at the App level to prevent state-reset flicker on screen transitions.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authService } = useServices();
  const queryClient = useQueryClient();
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const subscribe = useCallback(
    (onChange: () => void) =>
      authService.subscribeAuth(() => {
        setInitError(null);
        void queryClient.cancelQueries();
        queryClient.removeQueries();
        const session = authService.getAuthSession();
        if (session !== null && session.initialUser !== null) {
          queryClient.setQueryData(authQueryKeys.user(session.userId), session.initialUser);
        }
        onChange();
      }),
    [authService, queryClient],
  );
  const getSnapshot = useCallback(() => authService.getAuthSession(), [authService]);
  const session = useSyncExternalStore(subscribe, getSnapshot);
  const profile = useQuery({
    ...currentUserOptions(authService, session),
    enabled: !isInitializing && initError === null && session !== null,
    select: toUser,
  });
  const user = session === null ? null : (profile.data ?? null);
  const loading = isInitializing || (initError === null && session !== null && profile.isPending);
  const error =
    initError ?? (profile.isError && user === null ? getUserFacingMessage(profile.error) : null);

  const loadUser = useCallback(
    async (isRetry = false) => {
      setIsInitializing(true);
      setInitError(null);
      let currentSession = authService.getAuthSession();
      try {
        await authService.waitForInit({ retry: isRetry });
        currentSession = authService.getAuthSession();
        if (currentSession !== null) {
          await queryClient.fetchQuery(currentUserOptions(authService, currentSession));
        }
      } catch (e: unknown) {
        if (authService.getAuthSession() !== currentSession) return;
        handleError(e, { label: '加载用户信息', logger: authLog, feedback: false });
        setInitError(getUserFacingMessage(e));
      } finally {
        setIsInitializing(false);
      }
    },
    [authService, queryClient],
  );

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  /** Re-run initial auth. Used by boot error retry UI. */
  const retryInit = useCallback(() => {
    void loadUser(true);
  }, [loadUser]);

  /** Refresh the current profile without converting a failed request into success. */
  const refreshUser = useCallback(async () => {
    const currentSession = authService.getAuthSession();
    if (currentSession === null) {
      throw new Error('Cannot refresh a signed-out profile');
    }
    await queryClient.invalidateQueries({
      queryKey: authQueryKeys.user(currentSession.userId),
      refetchType: 'none',
    });
    await queryClient.fetchQuery({
      ...currentUserOptions(authService, currentSession),
      staleTime: 0,
    });
    if (authService.getAuthSession() !== currentSession) {
      throw new DOMException('Authentication changed', 'AbortError');
    }
  }, [authService, queryClient]);

  // Session fully expired (both tokens dead) — clear user so UI transitions to login
  useEffect(() => {
    return authService.onAuthExpired(() => {
      // Non-miniProgram: open AuthLogin modal so user can re-authenticate
      // miniProgram path is handled by App.tsx reading needsWechatLogin=true
      if (!isMiniProgram() && navigationRef.isReady()) {
        navigationRef.navigate('AuthLogin', { loginTitle: '会话已过期，请重新登录' });
      }
    });
  }, [authService]);

  const value: AuthContextValue = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    needsWechatLogin: authService.needsWechatLogin,
    refreshUser,
    retryInit,
  };

  return <AuthContext value={value}>{children}</AuthContext>;
};

/**
 * Access global auth state.
 *
 * Must be called within the AuthProvider tree, otherwise throws.
 */
export const useAuthContext = (): AuthContextValue => {
  const context = use(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
