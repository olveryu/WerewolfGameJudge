/**
 * alert - 跨平台 Alert 封装
 *
 * 提供统一的 showAlert API，在 Web 端使用自定义 Modal，
 * 在 Native 端使用 RN Alert.alert。支持 listener 模式驱动 AlertModal。
 *
 * ✅ 允许：showAlert / setAlertListener
 * ❌ 禁止：import React 组件 / service / 游戏状态
 */
import { Alert, Platform } from 'react-native';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

// Global alert state for custom modal
type AlertListener = (config: AlertConfig | null) => void;
let alertListener: AlertListener | null = null;

export interface AlertConfig {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

export const setAlertListener = (listener: AlertListener | null) => {
  alertListener = listener;
};

/**
 * Cross-platform alert function that works on both native and web
 * Uses custom modal for consistent UI across all platforms
 */
export const showAlert = (title: string, message?: string, buttons?: AlertButton[]) => {
  const alertButtons = buttons || [{ text: '确定' }];

  // Use custom modal if listener is set (preferred for consistent UI)
  if (alertListener) {
    alertListener({
      title,
      message,
      buttons: alertButtons,
    });
    return;
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
};

export default showAlert;
