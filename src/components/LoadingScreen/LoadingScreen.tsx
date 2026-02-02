import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const appIcon = require('../../../assets/pwa/icon-192.png');

interface LoadingScreenProps {
  /** 加载提示文本 */
  readonly message?: string;
  /** 是否全屏显示（默认 true） */
  readonly fullScreen?: boolean;
}

/**
 * 统一的加载界面组件
 * 带有 logo 脉冲动画，与 PWA 启动画面保持一致
 */
export function LoadingScreen({ message = '加载中...', fullScreen = true }: LoadingScreenProps) {
  const { colors } = useTheme();
  const pulseAnimRef = useRef(new Animated.Value(1));
  // eslint-disable-next-line react-hooks/refs -- RN Animated standard pattern: read Animated.Value from ref during render to bind into styles.
  const pulseAnim = pulseAnimRef.current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Derived animation value - standard React Native pattern
  // eslint-disable-next-line react-hooks/refs -- RN Animated standard pattern: interpolate derived animated values during render.
  const opacityAnim = pulseAnim.interpolate({
    inputRange: [1, 1.05],
    outputRange: [1, 0.8],
  });

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background },
        !fullScreen && styles.inlineContainer,
      ]}
    >
      <Animated.View
        // eslint-disable-next-line react-hooks/refs -- RN Animated standard pattern: passing Animated.Value into style props during render.
        style={[
          styles.iconContainer,
          /* eslint-disable react-hooks/refs -- RN Animated standard pattern: Animated.Value is used in render-bound style objects. */
          {
            transform: [{ scale: pulseAnim }],
            opacity: opacityAnim,
          },
          /* eslint-enable react-hooks/refs */
        ]}
      >
        <Image source={appIcon} style={styles.icon} resizeMode="contain" />
      </Animated.View>
      <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineContainer: {
    flex: 0,
    paddingVertical: 60,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
    // 添加阴影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  icon: {
    width: '100%',
    height: '100%',
  },
  message: {
    fontSize: 14,
    opacity: 0.7,
  },
});
