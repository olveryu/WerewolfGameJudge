/**
 * useBootProgress — Tracks real app initialization steps during boot.
 *
 * Reports step states for font loading (web-only), auth, and avatar prefetch (web-only).
 * Consumed by LoadingScreen in step-based mode during app startup.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Font from 'expo-font';
import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { isGeneratedAvatar } from '@/components/GeneratedAvatar';
import type { BootStep } from '@/components/LoadingScreen';
import { useAuthContext } from '@/contexts/AuthContext';
import { getBuiltinAvatarId, getBuiltinAvatarImage, isBuiltinAvatarUrl } from '@/utils/avatar';
import { log } from '@/utils/logger';

interface BootProgress {
  readonly steps: readonly BootStep[];
  readonly isReady: boolean;
  readonly error: string | null;
  readonly retry: () => void;
}

const bootLog = log.extend('Boot');

/**
 * Resolve user's avatarUrl to a browser-fetchable URL string.
 * Returns null when no prefetch is needed (generated SVG, default icon, or native).
 */
function resolveAvatarPrefetchUrl(avatarUrl: string | null | undefined): string | null {
  if (Platform.OS !== 'web' || !avatarUrl) return null;

  // builtin:// → resolve to bundled webp (Metro returns URL string on web)
  if (isBuiltinAvatarUrl(avatarUrl)) {
    const id = getBuiltinAvatarId(avatarUrl);
    // Generated avatars are SVG, no prefetch needed
    if (isGeneratedAvatar(id)) return null;
    const source = getBuiltinAvatarImage(avatarUrl);
    // On web, Metro import returns a string URL despite the `number` type annotation
    if (source != null && typeof source === 'string') return source;
    // In production builds, Metro may return { uri: '...' }
    if (
      source != null &&
      typeof source === 'object' &&
      'uri' in (source as Record<string, unknown>)
    ) {
      return (source as Record<string, string>).uri ?? null;
    }
    return null;
  }

  // Remote URL → prefetch directly
  return avatarUrl;
}

export function useBootProgress(): BootProgress {
  const { user, loading: authLoading, error: authError, retryInit } = useAuthContext();
  const [fontsLoaded, setFontsLoaded] = useState(Platform.OS !== 'web');
  // Avatar prefetch: skip on native, mark done immediately when no avatar to prefetch
  const [avatarPrefetched, setAvatarPrefetched] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    Font.loadAsync(Ionicons.font)
      .then(() => {
        bootLog.debug('Icon fonts loaded');
        setFontsLoaded(true);
      })
      .catch((err: Error) => {
        bootLog.warn('Icon font load failed (graceful degradation)', err.message);
        setFontsLoaded(true);
      });
  }, []);

  // Prefetch user avatar image after auth completes (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (authLoading) return; // Wait for auth to settle

    const url = resolveAvatarPrefetchUrl(user?.avatarUrl);
    if (!url) {
      // No image to prefetch (no user, generated avatar, or default icon)
      setAvatarPrefetched(true);
      return;
    }

    bootLog.debug('Prefetching avatar', url);
    const img = new window.Image();
    img.onload = () => {
      bootLog.debug('Avatar prefetched');
      setAvatarPrefetched(true);
    };
    img.onerror = () => {
      bootLog.warn('Avatar prefetch failed (graceful degradation)');
      setAvatarPrefetched(true);
    };
    img.src = url;
  }, [authLoading, user?.avatarUrl]);

  const steps = useMemo<readonly BootStep[]>(() => {
    const list: BootStep[] = [];
    if (Platform.OS === 'web') {
      list.push({ id: 'fonts', label: '加载资源', done: fontsLoaded });
    }
    list.push({ id: 'auth', label: '验证身份', done: !authLoading });
    if (Platform.OS === 'web') {
      list.push({ id: 'avatar', label: '加载头像', done: avatarPrefetched });
    }
    return list;
  }, [fontsLoaded, authLoading, avatarPrefetched]);

  const isReady = fontsLoaded && !authLoading && authError == null && avatarPrefetched;
  return { steps, isReady, error: authError, retry: retryInit };
}
