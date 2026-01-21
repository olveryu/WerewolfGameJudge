/**
 * Modal Focus Utility
 *
 * Fixes React Native Web aria-hidden warning when Modal closes.
 * The warning occurs when focus remains on an element inside a Modal
 * that gets aria-hidden="true" upon closing.
 *
 * Solution: Blur focused element before closing Modal.
 */

import { Platform } from 'react-native';

/**
 * Blur the currently focused element (web only).
 * Call this before closing a Modal to prevent aria-hidden focus warning.
 */
export function blurFocusedElement(): void {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && activeElement !== document.body) {
      activeElement.blur();
    }
  }
}

/**
 * Create a wrapped callback that blurs focus before executing.
 * Uses requestAnimationFrame to ensure blur happens before React state update.
 */
export function createModalCloseHandler<T extends (...args: unknown[]) => void>(
  callback: T,
): (...args: Parameters<T>) => void {
  return (...args: Parameters<T>) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement !== document.body) {
        activeElement.blur();
      }
      // Use setTimeout to allow blur to take effect before modal closes
      setTimeout(() => callback(...args), 0);
    } else {
      callback(...args);
    }
  };
}

/**
 * Save reference to currently focused element.
 * Use this when Modal opens to restore focus later.
 */
export function saveFocusedElement(): Element | null {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return document.activeElement;
  }
  return null;
}

/**
 * Restore focus to a previously saved element.
 * Use this after Modal closes to return focus to original element.
 */
export function restoreFocus(element: Element | null): void {
  if (Platform.OS === 'web' && element) {
    (element as HTMLElement)?.focus?.();
  }
}
