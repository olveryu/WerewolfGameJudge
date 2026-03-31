/**
 * alertPresets — Commonly used alert patterns built on top of showAlert
 *
 * Provides preset wrappers for the 4 most common showAlert patterns:
 * error, dismiss, confirm, destructive. Each delegates to showAlert()
 * from alert.ts, reducing boilerplate at call sites.
 *
 * Separated from alert.ts so Jest module mocks on showAlert are correctly
 * intercepted when these helpers call through the mocked module export.
 */
import { CANCEL_BUTTON, confirmButton, DISMISS_BUTTON, showAlert } from './alert';

/** Error alert — single "确定" button. Auto-fallback message '请稍后重试'. */
export const showErrorAlert = (title: string, message?: string): boolean =>
  showAlert(title, message ?? '请稍后重试');

/** Dismiss alert — single "知道了" button with optional callback. */
export const showDismissAlert = (title: string, message: string, onDismiss?: () => void): boolean =>
  showAlert(title, message, [
    onDismiss ? { ...DISMISS_BUTTON, onPress: onDismiss } : DISMISS_BUTTON,
  ]);

/** Confirm alert — "取消" + "确定" buttons. */
export const showConfirmAlert = (
  title: string,
  message: string,
  onConfirm: () => void,
  options?: { onCancel?: () => void; confirmText?: string },
): boolean =>
  showAlert(title, message, [
    options?.onCancel ? { ...CANCEL_BUTTON, onPress: options.onCancel } : CANCEL_BUTTON,
    options?.confirmText
      ? { text: options.confirmText, onPress: onConfirm }
      : confirmButton(onConfirm),
  ]);

/** Destructive confirm — "取消" + destructive action button. */
export const showDestructiveAlert = (
  title: string,
  message: string,
  actionText: string,
  onConfirm: () => void,
): boolean =>
  showAlert(title, message, [
    CANCEL_BUTTON,
    { text: actionText, style: 'destructive', onPress: onConfirm },
  ]);
