/** Bounds task content above native or web keyboards without changing room state. */

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { computeContainerInset, useVisualViewport } from './useVisualViewport';

/** Keeps task actions within the visible viewport while the keyboard is open. */
export function RoomTaskViewport({ children }: { readonly children: ReactNode }) {
  const container = useRef<View>(null);
  const viewport = useVisualViewport();
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'web' || viewport === null) return;
    container.current?.measureInWindow((_left, top, _width, height) => {
      setKeyboardInset(computeContainerInset(top + height, viewport));
    });
  }, [viewport]);
  return (
    <View ref={container} style={styles.container}>
      <KeyboardAvoidingView
        enabled={Platform.OS !== 'web'}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { paddingBottom: keyboardInset }]}
      >
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, minHeight: 0 } });
