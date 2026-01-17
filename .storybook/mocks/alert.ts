/**
 * Storybook mock for alert utilities
 * Uses browser alert instead of React Native Alert
 */

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

/**
 * Mock showAlert that uses browser's alert/confirm
 */
export const showAlert = (
  title: string,
  message?: string,
  buttons?: AlertButton[]
): void => {
  const fullMessage = message ? `${title}\n\n${message}` : title;
  
  if (buttons && buttons.length > 1) {
    // Has multiple buttons - use confirm
    const confirmed = globalThis.confirm(fullMessage);
    if (confirmed) {
      const confirmButton = buttons.find(b => b.style !== 'cancel');
      confirmButton?.onPress?.();
    } else {
      const cancelButton = buttons.find(b => b.style === 'cancel');
      cancelButton?.onPress?.();
    }
  } else {
    // Single button or no buttons - use alert
    globalThis.alert(fullMessage);
    buttons?.[0]?.onPress?.();
  }
};
