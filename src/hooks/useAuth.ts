import { useState, useEffect, useCallback } from 'react';
import { SupabaseService } from '../services/SupabaseService';
import { supabase, isSupabaseConfigured } from '../config/supabase';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isAnonymous: boolean;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabaseService = SupabaseService.getInstance();

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

  // Load current user on mount
  useEffect(() => {
    // Don't do anything if Supabase is not configured
    if (!isSupabaseConfigured() || !supabase) {
      setLoading(false);
      return;
    }

    const loadUser = async () => {
      try {
        const result = await supabaseService.getCurrentUser();
        if (result?.data?.user) {
          setUser(toUser(result.data.user));
        }
      } catch (e) {
        console.error('Failed to load user:', e);
      } finally {
        setLoading(false);
      }
    };
    
    loadUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        if (session?.user) {
          setUser(toUser(session.user));
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabaseService, toUser]);

  const signInAnonymously = async () => {
    setLoading(true);
    setError(null);
    try {
      await supabaseService.signInAnonymously();
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
      const result = await supabaseService.signUpWithEmail(email, password, displayName);
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
      await supabaseService.signInWithEmail(email, password);
      // Refresh user data after login
      const result = await supabaseService.getCurrentUser();
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
      await supabaseService.updateProfile(updates);
      // Refresh user data
      const result = await supabaseService.getCurrentUser();
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
      const url = await supabaseService.uploadAvatar(fileUri);
      // Refresh user data
      const result = await supabaseService.getCurrentUser();
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
      await supabaseService.signOut();
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
