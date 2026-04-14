/**
 * LoadingScreen - 统一加载界面组件
 *
 * 带有 logo 脉冲动画，与 PWA 启动画面保持一致。
 * 渲染加载状态 UI 与脉冲动画。不 import service，不含业务逻辑。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, LayoutChangeEvent, Platform, StyleSheet, Text, View } from 'react-native';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

import { borderRadius, colors, componentSizes, shadows, spacing, typography } from '@/theme';

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
/** Width of the sliding bar relative to track width */
const BAR_WIDTH_RATIO = 0.3;
/** Full cycle duration for the sliding animation */
const PROGRESS_DURATION_MS = 1_500;

export function LoadingScreen({ message = '加载中', fullScreen = true }: LoadingScreenProps) {
  const pulseAnimRef = useRef(new Animated.Value(1));
  // eslint-disable-next-line react-hooks/refs -- RN Animated standard pattern: read Animated.Value from ref during render to bind into styles.
  const pulseAnim = pulseAnimRef.current;

  // ── Indeterminate progress bar ──
  const progressRef = useRef(new Animated.Value(0));
  const progress = progressRef.current;
  const [trackWidth, setTrackWidth] = useState(0);

  const handleTrackLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  const barPixelWidth = trackWidth * BAR_WIDTH_RATIO;
  const translateX = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- RN Animated standard pattern: interpolate Animated.Value during render.
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [-barPixelWidth, trackWidth],
      }),
    [progress, barPixelWidth, trackWidth],
  );

  useEffect(() => {
    if (trackWidth === 0) return;
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: PROGRESS_DURATION_MS,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    );
    animation.start();
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/refs -- RN Animated standard pattern: Animated.Value in effect deps.
  }, [progress, trackWidth]);

  // ── Pulse animation ──
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: USE_NATIVE_DRIVER,
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
      {/* Indeterminate progress bar */}
      <View
        style={[styles.progressTrack, { backgroundColor: colors.border }]}
        onLayout={handleTrackLayout}
      >
        <Animated.View
          style={[
            styles.progressBar,
            { width: barPixelWidth, backgroundColor: colors.primary, transform: [{ translateX }] },
          ]}
        />
      </View>
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
    paddingVertical: spacing.xxlarge + spacing.medium,
  },
  iconContainer: {
    width: componentSizes.avatar.xl,
    height: componentSizes.avatar.xl,
    borderRadius: borderRadius.xlarge,
    overflow: 'hidden',
    marginBottom: spacing.large,
    // 阴影
    ...shadows.lg,
  },
  icon: {
    width: '100%',
    height: '100%',
  },
  message: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
  },
  progressTrack: {
    width: '60%',
    height: 3,
    borderRadius: borderRadius.small,
    overflow: 'hidden',
    marginTop: spacing.large,
  },
  progressBar: {
    height: '100%',
    borderRadius: borderRadius.small,
  },
});
