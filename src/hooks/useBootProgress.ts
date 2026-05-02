/**
 * useBootProgress — Tracks real app initialization during boot.
 *
 * Waits for auth + avatar prefetch (web-only) before signalling ready.
 * Font.loadAsync registers the @font-face early, but actual font rendering
 * is gated by document.fonts.ready in handleNavReady (App.tsx).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Font from 'expo-font';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { isGeneratedAvatar } from '@/components/GeneratedAvatar';
import { useAuthContext } from '@/contexts/AuthContext';
import { getBuiltinAvatarId, getBuiltinAvatarImage, isBuiltinAvatarUrl } from '@/utils/avatar';
import { log } from '@/utils/logger';

interface BootProgress {
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
  // Avatar prefetch: skip on native, mark done immediately when no avatar to prefetch
  const [avatarPrefetched, setAvatarPrefetched] = useState(Platform.OS !== 'web');

  // Register icon font @font-face early (web only).
  // This does NOT guarantee the font file is downloaded — that happens lazily
  // when DOM elements reference the font family. document.fonts.ready in
  // handleNavReady (App.tsx) gates splash dismiss on actual rendering.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    Font.loadAsync(Ionicons.font)
      .then(() => bootLog.debug('Icon font @font-face registered'))
      .catch((err: Error) =>
        bootLog.warn('Icon font registration failed (graceful degradation)', err.message),
      );
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

  const isReady = !authLoading && authError == null && avatarPrefetched;
  return { isReady, error: authError, retry: retryInit };
}
