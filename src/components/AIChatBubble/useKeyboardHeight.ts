/**
 * useKeyboardHeight - 跨平台键盘高度监听
 *
 * Web: visualViewport resize/scroll
 * iOS: keyboardWillShow / keyboardWillHide
 * Android: keyboardDidShow / keyboardDidHide
 *
 * ✅ 允许：平台检测、事件监听
 * ❌ 禁止：业务逻辑
 */

import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * 返回当前键盘高度（px），未弹出时为 0
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
