/** Common alert shapes built on `showAlert`. */
import { showAlert } from './alert';

/** Error alert with a single 确定 button; defaults the message to 请稍后重试. */
export function showErrorAlert(title: string, message?: string): void {
  showAlert(title, message ?? '请稍后重试');
}

/** 取消 plus a confirm button (确定 unless `confirmText` is given). */
export function showConfirmAlert(
  title: string,
  message: string,
  onConfirm: () => void | Promise<void>,
  options?: { onCancel?: () => void; confirmText?: string },
): void {
  showAlert(title, message, [
    { text: '取消', style: 'cancel', onPress: options?.onCancel },
    { text: options?.confirmText ?? '确定', onPress: onConfirm },
  ]);
}

/** 取消 plus a destructive action button. */
export function showDestructiveAlert(
  title: string,
  message: string,
  actionText: string,
  onConfirm: () => void | Promise<void>,
): void {
  showAlert(title, message, [
    { text: '取消', style: 'cancel' },
    { text: actionText, style: 'destructive', onPress: onConfirm },
  ]);
}
