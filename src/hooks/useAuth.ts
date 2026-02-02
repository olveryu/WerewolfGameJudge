import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthService } from '../services/infra/AuthService';
import { AvatarUploadService } from '../services/infra/AvatarUploadService';
import { supabase, isSupabaseConfigured } from '../config/supabase';
import { authLog } from '../utils/logger';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isAnonymous: boolean;
}

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

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authService = AuthService.getInstance();
  const avatarUploadService = AvatarUploadService.getInstance();

  // Convert Supabase user to our User type
  const toUser = useCallback((supabaseUser: any): User | null => {
    if (!supabaseUser) return null;
    return {
      uid: supabaseUser.id,
      email: supabaseUser.email || null,
      displayName: supabaseUser.user_metadata?.display_name || null,
      avatarUrl: supabaseUser.user_metadata?.avatar_url || null,
      isAnonymous: supabaseUser.is_anonymous || false,
    };
  }, []);

  // Only update user state if data actually changed (prevents unnecessary re-renders)
  const updateUserIfChanged = useCallback((newUser: User | null) => {
    setUser((prev) => (userEquals(prev, newUser) ? prev : newUser));
  }, []);

  // Load current user on mount
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
        const message = e instanceof Error ? e.message : String(e);
        authLog.error(' Failed to load user:', message, e);
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadUser();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      authLog.info('Auth state changed:', event);
      if (session?.user) {
        updateUserIfChanged(toUser(session.user));
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [authService, toUser, updateUserIfChanged]);

  const signInAnonymously = async () => {
    setLoading(true);
    setError(null);
    try {
      await authService.signInAnonymously();
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await authService.signUpWithEmail(email, password, displayName);
      // Use the user data returned from signup directly
      if (result.user) {
        setUser(toUser(result.user));
      }
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      await authService.signInWithEmail(email, password);
      // Refresh user data after login
      const result = await authService.getCurrentUser();
      if (result?.data?.user) {
        setUser(toUser(result.data.user));
      }
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: { displayName?: string; avatarUrl?: string }) => {
    setError(null);
    try {
      await authService.updateProfile(updates);
      // Refresh user data
      const result = await authService.getCurrentUser();
      if (result?.data?.user) {
        setUser(toUser(result.data.user));
      }
    } catch (e: any) {
      setError(e.message);
      throw e;
    }
  };

  const uploadAvatar = async (fileUri: string): Promise<string> => {
    setError(null);
    try {
      const url = await avatarUploadService.uploadAvatar(fileUri);
      // Refresh user data
      const result = await authService.getCurrentUser();
      if (result?.data?.user) {
        setUser(toUser(result.data.user));
      }
      return url;
    } catch (e: any) {
      setError(e.message);
      throw e;
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await authService.signOut();
      // 清除上次房间记录（匿名用户退出后无法返回之前的房间）
      await AsyncStorage.removeItem('lastRoomNumber');
      setUser(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return {
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
  };
};
