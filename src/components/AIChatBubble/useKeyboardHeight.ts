/**
 * useKeyboardHeight - cross-platform keyboard height listener
 *
 * Web: visualViewport resize/scroll
 * iOS: keyboardWillShow / keyboardWillHide
 * Android: keyboardDidShow / keyboardDidHide
 *
 * Provides platform detection and keyboard event listening. Contains no business logic.
 */

import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Returns the current keyboard height (px); 0 when not displayed.
 */
export function useKeyboardHeight(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // ── Web: visualViewport ──────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web' || globalThis.window === undefined) return;

    const viewport = globalThis.window.visualViewport;
    if (!viewport) return;

    const initialHeight = globalThis.window.innerHeight;

    const handleChange = () => {
      const kbHeight = initialHeight - viewport.height - viewport.offsetTop;
      setKeyboardHeight(Math.max(0, kbHeight));
    };

    viewport.addEventListener('resize', handleChange);
    viewport.addEventListener('scroll', handleChange);
    return () => {
      viewport.removeEventListener('resize', handleChange);
      viewport.removeEventListener('scroll', handleChange);
    };
  }, []);

  // ── Native: Keyboard events ──────────────────────────
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return keyboardHeight;
}
