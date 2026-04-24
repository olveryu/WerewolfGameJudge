/**
 * useBootProgress — Tracks real app initialization steps during boot.
 *
 * Reports step states for font loading (web-only) and auth initialization.
 * Consumed by LoadingScreen in step-based mode during app startup.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Font from 'expo-font';
import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import type { BootStep } from '@/components/LoadingScreen';
import { useAuthContext } from '@/contexts/AuthContext';
import { log } from '@/utils/logger';

interface BootProgress {
  readonly steps: readonly BootStep[];
  readonly isReady: boolean;
  readonly error: string | null;
  readonly retry: () => void;
}

const bootLog = log.extend('Boot');

export function useBootProgress(): BootProgress {
  const { loading: authLoading, error: authError, retryInit } = useAuthContext();
  const [fontsLoaded, setFontsLoaded] = useState(Platform.OS !== 'web');

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

  const steps = useMemo<readonly BootStep[]>(() => {
    const list: BootStep[] = [];
    if (Platform.OS === 'web') {
      list.push({ id: 'fonts', label: '加载资源', done: fontsLoaded });
    }
    list.push({ id: 'auth', label: '验证身份', done: !authLoading });
    return list;
  }, [fontsLoaded, authLoading]);

  const isReady = fontsLoaded && !authLoading && authError == null;
  return { steps, isReady, error: authError, retry: retryInit };
}
