/** Owns bounded web font and avatar loading; does not decide authentication or dismiss splash. */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Font from 'expo-font';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { isGeneratedAvatar } from '@/components/GeneratedAvatar';
import { getBuiltinAvatarId, getBuiltinAvatarImage, isBuiltinAvatarUrl } from '@/utils/avatar';
import { log } from '@/utils/logger';

const bootLog = log.extend('Boot');
const FONT_TIMEOUT_MS = 5_000;
export const AVATAR_PREFETCH_TIMEOUT_MS = 5_000;

function resolveAvatarPrefetchUrl(avatarUrl: string | null | undefined): string | null {
  if (Platform.OS !== 'web' || !avatarUrl) return null;
  if (!isBuiltinAvatarUrl(avatarUrl)) return avatarUrl;
  if (isGeneratedAvatar(getBuiltinAvatarId(avatarUrl))) return null;
  const source: unknown = getBuiltinAvatarImage(avatarUrl);
  if (typeof source === 'string') return source;
  if (source === null || typeof source !== 'object' || !('uri' in source)) return null;
  return typeof source.uri === 'string' ? source.uri : null;
}

/** Wait for bounded resources without allowing an obsolete task to update a later mount. */
export function useBootAssets(avatarUrl: string | null | undefined, authLoading: boolean) {
  const avatarPrefetchUrl = resolveAvatarPrefetchUrl(avatarUrl);
  const [prefetchedAvatarUrl, setPrefetchedAvatarUrl] = useState<string | null>(null);
  const [fontLoaded, setFontLoaded] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let isActive = true;
    const timer = setTimeout(() => {
      bootLog.warn('Icon font load timed out');
      setFontLoaded(true);
    }, FONT_TIMEOUT_MS);
    void Font.loadAsync(Ionicons.font)
      .then(() => (isActive ? document.fonts.load('1em ionicons') : undefined))
      .then(() => {
        if (!isActive) return;
        clearTimeout(timer);
        setFontLoaded(true);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        bootLog.warn('Icon font load failed', error);
        clearTimeout(timer);
        setFontLoaded(true);
      });
    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || authLoading || avatarPrefetchUrl === null) return;
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
      setPrefetchedAvatarUrl(avatarPrefetchUrl);
    };
    image.onerror = () => {
      if (!dispose()) return;
      bootLog.warn('Avatar prefetch failed');
      setPrefetchedAvatarUrl(avatarPrefetchUrl);
    };
    timeout = setTimeout(() => {
      if (!dispose()) return;
      bootLog.warn('Avatar prefetch timed out');
      image.removeAttribute('src');
      setPrefetchedAvatarUrl(avatarPrefetchUrl);
    }, AVATAR_PREFETCH_TIMEOUT_MS);
    image.src = avatarPrefetchUrl;
    return () => {
      if (dispose()) image.removeAttribute('src');
    };
  }, [authLoading, avatarPrefetchUrl]);

  const avatarPrefetched =
    Platform.OS !== 'web' ||
    (!authLoading && (avatarPrefetchUrl === null || prefetchedAvatarUrl === avatarPrefetchUrl));
  return { avatarPrefetched, fontLoaded };
}
