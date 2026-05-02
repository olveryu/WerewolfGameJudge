/**
 * useBootProgress — Tracks real app initialization during boot.
 *
 * Waits for auth + avatar prefetch + icon font download (all web-only)
 * before signalling ready. The font is actively downloaded via
 * document.fonts.load() so icons render on the very first paint.
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

/** Font load timeout — don't block boot forever if CDN is unreachable. */
const FONT_TIMEOUT_MS = 5_000;

export function useBootProgress(): BootProgress {
  const { user, loading: authLoading, error: authError, retryInit } = useAuthContext();
  // Avatar prefetch: skip on native, mark done immediately when no avatar to prefetch
  const [avatarPrefetched, setAvatarPrefetched] = useState(Platform.OS !== 'web');
  // Icon font: skip on native (expo-splash-screen handles it)
  const [fontLoaded, setFontLoaded] = useState(Platform.OS !== 'web');

  // Register @font-face then actively trigger font download (web only).
  // Font.loadAsync only injects the CSS rule; the browser won't fetch the .ttf
  // until something references the font-family. document.fonts.load() forces
  // the download so icons are ready before the first paint.
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const timer = setTimeout(() => {
      bootLog.warn('Icon font load timed out — proceeding without icons');
      setFontLoaded(true);
    }, FONT_TIMEOUT_MS);

    Font.loadAsync(Ionicons.font)
      .then(() => {
        bootLog.debug('Icon font @font-face registered');
        // Actively trigger download — CSS Font Loading API standard pattern (MDN).
        return document.fonts.load('1em ionicons');
      })
      .then(() => {
        bootLog.debug('Icon font loaded');
        clearTimeout(timer);
        setFontLoaded(true);
      })
      .catch((err: Error) => {
        bootLog.warn('Icon font load failed (graceful degradation)', err.message);
        clearTimeout(timer);
        setFontLoaded(true);
      });

    return () => clearTimeout(timer);
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

  const isReady = !authLoading && authError == null && avatarPrefetched && fontLoaded;
  return { isReady, error: authError, retry: retryInit };
}
