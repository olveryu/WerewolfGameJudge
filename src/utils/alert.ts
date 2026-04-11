/**
 * alert - 跨平台 Alert 封装
 *
 * 提供统一的 showAlert / setAlertListener API，在 Web 端使用自定义 Modal，
 * 在 Native 端使用 RN Alert.alert。支持 listener 模式驱动 AlertModal。
 * 不引入 React 组件、service 或游戏状态。
 */
import { Alert, Platform } from 'react-native';

import type { AlertInputConfig } from '@/components/AlertModal';

interface AlertButton {
  text: string;
  onPress?: (inputValue?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
  loading?: boolean;
  disabled?: boolean;
}

// ── Common button presets (DRY) ──────────────────────────────────────────
/** "知道了" dismiss button (default style, no action) */
export const DISMISS_BUTTON: AlertButton = { text: '知道了', style: 'default' } as const;
/** "取消" cancel button */
export const CANCEL_BUTTON: AlertButton = { text: '取消', style: 'cancel' } as const;
/** Create a "确定" confirm button with the given onPress handler */
export const confirmButton = (onPress: () => void): AlertButton => ({
  text: '确定',
  onPress,
});

// Global alert state for custom modal
type AlertListener = (config: AlertConfig | null) => void;
let alertListener: AlertListener | null = null;

/**
 * When blocked, showAlert() is a no-op.
 * Used by the "继续游戏" overlay to prevent lower-priority alerts
 * (e.g. 夜间行动) from covering the continue-game button.
 */
let alertBlocked = false;

/**
 * Block or unblock showAlert(). While blocked:
 * - New calls to showAlert() are silently dropped.
 * - The current visible alert (if any) is dismissed immediately.
 */
export const setAlertBlocked = (blocked: boolean) => {
  alertBlocked = blocked;
  if (blocked) {
    // Dismiss any currently visible alert
    alertListener?.(null);
  }
};

export interface AlertConfig {
  title: string;
  message?: string;
  buttons: AlertButton[];
  input?: AlertInputConfig;
}

export const setAlertListener = (listener: AlertListener | null) => {
  alertListener = listener;
};

/**
 * Cross-platform alert function that works on both native and web
 * Uses custom modal for consistent UI across all platforms
 */
export const showAlert = (title: string, message?: string, buttons?: AlertButton[]): boolean => {
  if (alertBlocked) return false;

  const alertButtons = buttons || [{ text: '确定' }];

  // Use custom modal if listener is set (preferred for consistent UI)
  if (alertListener) {
    alertListener({
      title,
      message,
      buttons: alertButtons,
    });
    return true;
  }

  // Fallback to native alert
  if (Platform.OS === 'web') {
    // For web without custom modal, use prompt for multiple buttons
    if (alertButtons.length <= 1) {
      window.alert(message ? `${title}\n\n${message}` : title);
      alertButtons[0]?.onPress?.();
    } else if (alertButtons.length === 2) {
      const confirmed = window.confirm(
        message
          ? `${title}\n\n${message}\n\n点击"确定"选择: ${alertButtons[1].text}\n点击"取消"选择: ${alertButtons[0].text}`
          : `${title}\n\n点击"确定"选择: ${alertButtons[1].text}\n点击"取消"选择: ${alertButtons[0].text}`,
      );
      if (confirmed) {
        alertButtons[1]?.onPress?.();
      } else {
        alertButtons[0]?.onPress?.();
      }
    } else {
      const optionsText = alertButtons.map((b, i) => `${i + 1}. ${b.text}`).join('\n');
      const result = window.prompt(
        message
          ? `${title}\n\n${message}\n\n请输入选项编号:\n${optionsText}`
          : `${title}\n\n请输入选项编号:\n${optionsText}`,
        '1',
      );
      if (result !== null) {
        const index = parseInt(result, 10) - 1;
        if (index >= 0 && index < alertButtons.length) {
          alertButtons[index]?.onPress?.();
        }
      }
    }
  } else {
    Alert.alert(title, message || '', alertButtons);
  }
  return true;
};

/**
 * Show a prompt modal with a text input field.
 * On confirm, calls onConfirm with the trimmed input value.
 * Uses the custom AlertModal when a listener is set.
 */
export const showPrompt = (
  title: string,
  options: {
    message?: string;
    placeholder?: string;
    defaultValue?: string;
    onConfirm: (value: string) => void;
  },
): boolean => {
  const { message, placeholder, defaultValue = '', onConfirm } = options;

  if (alertBlocked) return false;

  const buttons: AlertButton[] = [
    { text: '取消', style: 'cancel' },
    {
      text: '确定',
      onPress: (inputValue?: string) => onConfirm(inputValue ?? defaultValue),
    },
  ];

  const input: AlertInputConfig = { placeholder, defaultValue };

  // Prefer custom modal
  if (alertListener) {
    alertListener({ title, message, buttons, input });
    return true;
  }

  // Fallback: native prompt
  if (Platform.OS === 'web') {
    const result = window.prompt(message ? `${title}\n\n${message}` : title, defaultValue);
    if (result !== null) {
      onConfirm(result);
    }
  } else {
    Alert.prompt(
      title,
      message || '',
      [
        { text: '取消', style: 'cancel' },
        { text: '确定', onPress: (value?: string) => onConfirm(value ?? defaultValue) },
      ],
      'plain-text',
      defaultValue,
      placeholder,
    );
  }
  return true;
};
