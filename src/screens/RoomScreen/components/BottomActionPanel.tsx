/**
 * BottomActionPanel - 底部浮动操作面板（Memoized）
 *
 * 卡片风格 + BlurView 背景，组合 action message + action buttons。
 * 纯展示组件，渲染 message 与按钮子组件，不 import service，不包含业务逻辑判断。
 */
import { BlurView } from 'expo-blur';
import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { TESTIDS } from '@/testids';

import { type BottomActionPanelStyles } from './styles';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface BottomActionPanelProps {
  /** Action message to display (e.g., "请选择要查验的玩家") */
  message?: string;
  /** Whether to show the message section */
  showMessage?: boolean;
  /** Button elements (ActionButton, HostControlButtons, etc.) */
  children: React.ReactNode;
  /** Pre-created styles from parent */
  styles: BottomActionPanelStyles;
  /** Dark theme — determines BlurView tint */
  isDark?: boolean;
  /** Safe area bottom inset — applied as paddingBottom when > styles.container.paddingBottom */
  bottomInset?: number;
}

const localStyles = StyleSheet.create({
  blur: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});

const BottomActionPanelComponent: React.FC<BottomActionPanelProps> = ({
  message,
  showMessage = false,
  children,
  styles,
  isDark = false,
  bottomInset = 0,
}) => {
  // C6: Fade-in + slide-up animation when message text changes (native only)
  // On web, RN Animated with useNativeDriver=false applies inline opacity:0 synchronously,
  // which makes the element invisible to Playwright's visibility checks during the 150ms window.
  const msgFadeAnim = useMemo(() => new Animated.Value(1), []);
  const msgSlideAnim = useMemo(() => new Animated.Value(0), []);
  const prevMessageRef = useRef(message);

  useEffect(() => {
    if (prevMessageRef.current !== message && message && USE_NATIVE_DRIVER) {
      msgFadeAnim.setValue(0);
      msgSlideAnim.setValue(4);
      Animated.parallel([
        Animated.timing(msgFadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(msgSlideAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    }
    prevMessageRef.current = message;
  }, [message, msgFadeAnim, msgSlideAnim]);
  // Don't render if there's nothing to show
  const hasButtons = React.Children.count(children) > 0;
  if (!hasButtons && !showMessage) return null;

  const containerStyle =
    bottomInset > 0 ? [styles.container, { paddingBottom: bottomInset }] : styles.container;

  return (
    <View style={containerStyle} testID={TESTIDS.bottomActionPanel}>
      <BlurView
        intensity={60}
        tint={isDark ? 'dark' : 'light'}
        style={[
          localStyles.blur,
          {
            borderTopLeftRadius: styles.container.borderTopLeftRadius,
            borderTopRightRadius: styles.container.borderTopRightRadius,
          },
        ]}
      />
      {/* Action Message — fades in + slides up on change */}
      {showMessage && message ? (
        <Animated.Text
          style={[
            styles.message,
            { opacity: msgFadeAnim, transform: [{ translateY: msgSlideAnim }] },
          ]}
          testID={TESTIDS.actionMessage}
        >
          {message}
        </Animated.Text>
      ) : null}

      {/* Button Row */}
      {hasButtons && <View style={styles.buttonRow}>{children}</View>}
    </View>
  );
};

export const BottomActionPanel = memo(BottomActionPanelComponent);

BottomActionPanel.displayName = 'BottomActionPanel';
