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
import { CANCEL_BUTTON, confirmButton, showAlert } from './alert';

/** Error alert — single "确定" button. Auto-fallback message '请稍后重试'. */
/** Confirm alert — "取消" + "确定" buttons. */
export const showConfirmAlert = (
  title: string,
  message: string,
  onConfirm: () => void | Promise<void>,
  options?: { onCancel?: () => void; confirmText?: string },
): boolean =>
  showAlert(title, message, [
    options?.onCancel ? { ...CANCEL_BUTTON, onPress: options.onCancel } : CANCEL_BUTTON,
    options?.confirmText
      ? { text: options.confirmText, onPress: onConfirm }
      : confirmButton(onConfirm),
  ]);
