/**
 * usePWAInstall - PWA 安装到主屏幕
 *
 * 封装 `beforeinstallprompt`（Android/桌面 Chrome）与 iOS 浏览器手动引导逻辑。
 * 仅在 Web 平台 + 非 standalone 模式下有效。涵盖平台检测、localStorage 读写、触发系统安装弹窗。
 * 不 import service，不直接操作 DOM。
 */
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

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

/** iOS 浏览器类型，用于展示对应的引导步骤 */
type IOSBrowser = 'safari' | 'chrome' | 'other';

interface PWAInstallResult {
  /** 当前安装模式：prompt（可一键安装）、ios-guide（需引导）、hidden（不显示） */
  mode: PWAInstallMode;
  /** iOS 浏览器类型（仅 ios-guide 模式有意义），用于展示对应引导步骤 */
  iosBrowser: IOSBrowser | null;
  /** 触发安装。prompt 模式调用系统弹窗；ios-guide 模式由调用方展示引导 UI */
  install: () => Promise<void>;
}

/**
 * 检测是否以 standalone 模式运行（已安装 PWA）
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
 * 检测 iOS 浏览器（排除微信 WebView，因为有独立引导蒙层）
 */
function isIOSBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // 仅排除微信（有独立蒙层引导），Chrome/Firefox on iOS 均支持添加到主屏幕
  const isNotWeChat = !/MicroMessenger/i.test(ua);
  return isIOS && isNotWeChat;
}

/**
 * 检测 iOS 上的具体浏览器类型
 */
function detectIOSBrowser(): IOSBrowser {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/CriOS/i.test(ua)) return 'chrome';
  // 排除内嵌 WebView / 其他第三方浏览器后，默认 Safari
  if (!/FxiOS|EdgiOS|OPiOS/i.test(ua)) return 'safari';
  return 'other';
}

export function usePWAInstall(): PWAInstallResult {
  const [mode, setMode] = useState<PWAInstallMode>('hidden');
  const [iosBrowser, setIOSBrowser] = useState<IOSBrowser | null>(null);

  useEffect(() => {
    // 非 Web 平台或已安装，不显示
    if (Platform.OS !== 'web' || isStandalone()) {
      setMode('hidden');
      return;
    }

    // Android/桌面 Chrome 已捕获 prompt 事件
    if (window.__pwaInstallPrompt) {
      setMode('prompt');
      return;
    }

    // iOS 浏览器（Safari / Chrome / Firefox 等）
    if (isIOSBrowser()) {
      setMode('ios-guide');
      setIOSBrowser(detectIOSBrowser());
      return;
    }

    // 监听后续触发的 beforeinstallprompt（iOS 不触发此事件，故移到 iOS 检查之后）
    const handler = () => {
      setMode('prompt');
    };
    window.addEventListener('beforeinstallprompt', handler);

    // 其他浏览器（Firefox 等）不支持安装
    setMode('hidden');

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const install = useCallback(async () => {
    if (mode !== 'prompt' || !window.__pwaInstallPrompt) return;
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
