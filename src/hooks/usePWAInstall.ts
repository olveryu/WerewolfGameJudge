/**
 * usePWAInstall - install PWA to home screen
 *
 * Wraps `beforeinstallprompt` (Android/desktop Chrome) and iOS browser manual guide logic.
 * Only effective on Web platform + non-standalone mode. Covers platform detection, localStorage read/write, triggering the system install dialog.
 * Does not import service, does not directly manipulate DOM.
 */
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { homeLog } from '@/utils/logger';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __pwaInstallPrompt?: BeforeInstallPromptEvent;
  }
}

type PWAInstallMode = 'prompt' | 'ios-guide' | 'hidden';

/** iOS browser type, used to display the corresponding guide steps */
type IOSBrowser = 'safari' | 'chrome' | 'other';

interface PWAInstallResult {
  /** Current install mode: prompt (one-click install), ios-guide (needs guide), hidden (not shown) */
  mode: PWAInstallMode;
  /** iOS browser type (only meaningful in ios-guide mode), used to display the corresponding guide steps */
  iosBrowser: IOSBrowser | null;
  /** Trigger install. prompt mode calls the system dialog; ios-guide mode is shown by caller's guide UI */
  install: () => Promise<void>;
}

/**
 * Detect whether running in standalone mode (PWA installed)
 */
function isStandalone(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Detect iOS browser (excludes WeChat WebView; WeChat is intercepted at the HTML overlay layer)
 */
function isIOSBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isNotWeChat = !/MicroMessenger/i.test(ua);
  return isIOS && isNotWeChat;
}

/**
 * Detect the specific browser type on iOS
 */
function detectIOSBrowser(): IOSBrowser {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/CriOS/i.test(ua)) return 'chrome';
  // After excluding embedded WebView / other third-party browsers, default to Safari
  if (!/FxiOS|EdgiOS|OPiOS/i.test(ua)) return 'safari';
  return 'other';
}

/**
 * Manage PWA install prompt state (Chromium beforeinstallprompt / iOS guide).
 *
 * @returns install mode, iOS browser type, trigger install and close callbacks
 */
export function usePWAInstall(): PWAInstallResult {
  const [mode, setMode] = useState<PWAInstallMode>('hidden');
  const [iosBrowser, setIOSBrowser] = useState<IOSBrowser | null>(null);

  useEffect(() => {
    // Not Web platform or already installed: do not show
    if (Platform.OS !== 'web' || isStandalone()) {
      setMode('hidden');
      return;
    }

    // Android/desktop Chrome has captured the prompt event
    if (window.__pwaInstallPrompt) {
      setMode('prompt');
      return;
    }

    // iOS browser (Safari / Chrome / Firefox, etc.)
    if (isIOSBrowser()) {
      setMode('ios-guide');
      setIOSBrowser(detectIOSBrowser());
      return;
    }

    // Listen for later beforeinstallprompt events (iOS does not fire this, so move after iOS check)
    const handler = () => {
      setMode('prompt');
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Other browsers (Firefox, etc.) do not support installation
    setMode('hidden');

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const install = useCallback(async () => {
    if (mode !== 'prompt' || !window.__pwaInstallPrompt) return;
    homeLog.info('PWA install triggered', { mode });
    const prompt = window.__pwaInstallPrompt;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      window.__pwaInstallPrompt = undefined;
      setMode('hidden');
    }
  }, [mode]);

  return { mode, iosBrowser, install };
}
