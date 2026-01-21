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
    (document.activeElement as HTMLElement)?.blur?.();
  }
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

/**
 * Wrap a callback to blur focus before executing.
 * Useful for Modal close/confirm handlers.
 */
export function withBlurFocus<T extends (...args: unknown[]) => void>(callback: T): T {
  return ((...args: unknown[]) => {
    blurFocusedElement();
    callback(...args);
  }) as T;
}
