/**
 * usePWAInstall - PWA 安装到主屏幕
 *
 * 封装 `beforeinstallprompt`（Android/桌面 Chrome）与 iOS Safari 手动引导逻辑。
 * 仅在 Web 平台 + 非 standalone 模式下有效。
 *
 * ✅ 允许：平台检测、localStorage 读写、触发系统安装弹窗
 * ❌ 禁止：import service / 直接操作 DOM
 */
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

const DISMISS_KEY = '@werewolf_pwa_install_dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __pwaInstallPrompt?: BeforeInstallPromptEvent;
  }
}

export type PWAInstallMode = 'prompt' | 'ios-guide' | 'hidden';

export interface PWAInstallResult {
  /** 当前安装模式：prompt（可一键安装）、ios-guide（需引导）、hidden（不显示） */
  mode: PWAInstallMode;
  /** 触发安装。prompt 模式调用系统弹窗；ios-guide 模式由调用方展示引导 UI */
  install: () => Promise<void>;
  /** 用户关闭引导后调用，记住不再显示 */
  dismiss: () => void;
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
 * 检测 iOS Safari（非 Chrome/Firefox on iOS）
 */
function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // 排除 CriOS (Chrome) / FxiOS (Firefox) / 微信
  const isSafari = !/CriOS|FxiOS|MicroMessenger/i.test(ua);
  return isIOS && isSafari;
}

export function usePWAInstall(): PWAInstallResult {
  const [mode, setMode] = useState<PWAInstallMode>('hidden');

  useEffect(() => {
    // 非 Web 平台或已安装，不显示
    if (Platform.OS !== 'web' || isStandalone()) {
      setMode('hidden');
      return;
    }

    // 用户已关闭过
    try {
      if (localStorage.getItem(DISMISS_KEY) === 'true') {
        setMode('hidden');
        return;
      }
    } catch {
      // localStorage 不可用
    }

    // Android/桌面 Chrome 已捕获 prompt 事件
    if (window.__pwaInstallPrompt) {
      setMode('prompt');
      return;
    }

    // 监听后续触发的 beforeinstallprompt
    const handler = () => {
      setMode('prompt');
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS Safari
    if (isIOSSafari()) {
      setMode('ios-guide');
      return;
    }

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

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      // localStorage 不可用
    }
    setMode('hidden');
  }, []);

  return { mode, install, dismiss };
}
