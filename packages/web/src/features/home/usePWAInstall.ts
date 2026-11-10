/**
 * PWA "add to home screen": replays the boot-captured `beforeinstallprompt` (Android / desktop
 * Chromium) or asks the caller to show the manual iOS guide. Hidden once installed (standalone)
 * and in browsers that support neither.
 */
import { useSyncExternalStore } from 'react';

import {
  clearPwaInstallPrompt,
  getPwaInstallPrompt,
  subscribePwaInstallPrompt,
} from '@/boot/pwaInstallPrompt';
import { homeLog } from '@/utils/logger';

declare global {
  interface Navigator {
    /** Apple Web App standalone mode flag. */
    readonly standalone?: boolean;
  }
}

type PWAInstallMode = 'prompt' | 'ios-guide' | 'hidden';

/** iOS browser type, used to display the matching guide steps. */
type IOSBrowser = 'safari' | 'chrome' | 'other';

interface PWAInstallResult {
  readonly mode: PWAInstallMode;
  /** Only meaningful in `ios-guide` mode. */
  readonly iosBrowser: IOSBrowser | null;
  /** Shows the system install dialog in `prompt` mode. */
  readonly install: () => Promise<void>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  );
}

/** iOS browser outside WeChat (the WeChat browser is handled by the boot guide). */
function isIOSBrowser(): boolean {
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isIOS && !/MicroMessenger/i.test(ua);
}

function detectIOSBrowser(): IOSBrowser {
  const ua = navigator.userAgent;
  if (/CriOS/i.test(ua)) return 'chrome';
  if (!/FxiOS|EdgiOS|OPiOS/i.test(ua)) return 'safari';
  return 'other';
}

/** Install mode for the current browser and the action that triggers the system dialog. */
export function usePWAInstall(): PWAInstallResult {
  const prompt = useSyncExternalStore(subscribePwaInstallPrompt, getPwaInstallPrompt);
  const standalone = isStandalone();
  const iosGuide = !standalone && prompt === null && isIOSBrowser();
  const mode: PWAInstallMode = standalone
    ? 'hidden'
    : prompt !== null
      ? 'prompt'
      : iosGuide
        ? 'ios-guide'
        : 'hidden';

  const install = async () => {
    if (prompt === null) return;
    homeLog.info('PWA install triggered', { mode });
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') clearPwaInstallPrompt();
  };

  return { mode, iosBrowser: iosGuide ? detectIOSBrowser() : null, install };
}
