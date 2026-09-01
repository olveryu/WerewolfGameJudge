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

function resolveImageSourceUri(source: unknown): string | null {
  if (typeof source === 'string') return source;
  if (source === null || typeof source !== 'object' || !('uri' in source)) return null;
  return typeof source.uri === 'string' ? source.uri : null;
}

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
    // Metro declares bundled assets as numbers even though Web emits a URL or { uri } object.
    return resolveImageSourceUri(getBuiltinAvatarImage(avatarUrl));
  }

  // Remote URL → prefetch directly
  return avatarUrl;
}

/** Font load timeout — don't block boot forever if CDN is unreachable. */
const FONT_TIMEOUT_MS = 5_000;

/** Avatar prefetch timeout — the rendered image can retry after boot. */
export const AVATAR_PREFETCH_TIMEOUT_MS = 5_000;

/**
 * Tracks app boot progress (auth + avatar prefetch + font loading).
 *
 * Sets ready=true when all steps complete, allowing SplashScreen to hide.
 */
export function useBootProgress(): BootProgress {
  const { user, loading: authLoading, error: authError, retryInit } = useAuthContext();
  const avatarPrefetchUrl = resolveAvatarPrefetchUrl(user?.avatarUrl);
  const [prefetchedAvatarUrl, setPrefetchedAvatarUrl] = useState<string | null>(null);
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

    if (avatarPrefetchUrl === null) return;

    bootLog.debug('Prefetching avatar', avatarPrefetchUrl);
    const image = new window.Image();
    let isPending = true;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const dispose = (): boolean => {
      if (!isPending) return false;
      isPending = false;
      if (timeout !== null) clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      return true;
    };

    image.onload = () => {
      if (!dispose()) return;
      bootLog.debug('Avatar prefetched');
      setPrefetchedAvatarUrl(avatarPrefetchUrl);
    };
    image.onerror = () => {
      if (!dispose()) return;
      bootLog.warn('Avatar prefetch failed (graceful degradation)');
      setPrefetchedAvatarUrl(avatarPrefetchUrl);
    };

    timeout = setTimeout(() => {
      if (!dispose()) return;
      bootLog.warn('Avatar prefetch timed out — continuing boot');
      image.removeAttribute('src');
      setPrefetchedAvatarUrl(avatarPrefetchUrl);
    }, AVATAR_PREFETCH_TIMEOUT_MS);
    image.src = avatarPrefetchUrl;

    return () => {
      if (!dispose()) return;
      image.removeAttribute('src');
    };
  }, [authLoading, avatarPrefetchUrl]);

  const avatarPrefetched =
    Platform.OS !== 'web' ||
    (!authLoading && (avatarPrefetchUrl === null || prefetchedAvatarUrl === avatarPrefetchUrl));

  const isReady = !authLoading && authError == null && avatarPrefetched && fontLoaded;
  return { isReady, error: authError, retry: retryInit };
}
