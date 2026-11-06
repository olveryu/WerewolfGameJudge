/**
 * useKeyboardHeight - cross-platform keyboard height listener
 *
 * Web: derives from the single shared visualViewport snapshot
 * (`useVisualViewport`); the formula measures the visual viewport
 * shrink only — the pan offset is not part of keyboard height.
 * iOS: keyboardWillShow / keyboardWillHide
 * Android: keyboardDidShow / keyboardDidHide
 *
 * Provides platform detection and keyboard event listening. Contains no business logic.
 */

import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

import { computeKeyboardHeight, useVisualViewport } from './useVisualViewport';

/**
 * Returns the current keyboard height (px); 0 when not displayed.
 */
export function useKeyboardHeight(): number {
  const viewport = useVisualViewport();
  // Layout viewport height captured before the keyboard opens; the web
  // keyboard height is the gap between it and the visual viewport.
  const [baselineHeight] = useState(() =>
    Platform.OS === 'web' && typeof window !== 'undefined' ? window.innerHeight : 0,
  );
  const webHeight =
    Platform.OS === 'web' && viewport !== null
      ? computeKeyboardHeight(baselineHeight, viewport)
      : 0;

  // ── Native: Keyboard events ──────────────────────────
  const [nativeHeight, setNativeHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setNativeHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setNativeHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return Platform.OS === 'web' ? webHeight : nativeHeight;
}
