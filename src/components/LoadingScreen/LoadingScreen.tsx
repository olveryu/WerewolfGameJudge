/**
 * LoadingScreen - 统一加载界面组件
 *
 * 带有 logo 脉冲动画，与 PWA 启动画面保持一致。
 * 渲染加载状态 UI 与脉冲动画。不 import service，不含业务逻辑。
 */
import { useEffect, useState } from 'react';
import { Image, type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { borderRadius, colors, componentSizes, shadows, spacing, typography } from '@/theme';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const appIcon = require('../../../assets/pwa/icon-192.png');

interface LoadingScreenProps {
  /** 加载提示文本 */
  readonly message?: string;
  /** 是否全屏显示（默认 true） */
  readonly fullScreen?: boolean;
}

/** Width of the sliding bar relative to track width */
const BAR_WIDTH_RATIO = 0.3;
/** Full cycle duration for the sliding animation */
const PROGRESS_DURATION_MS = 1_500;

export function LoadingScreen({ message = '加载中', fullScreen = true }: LoadingScreenProps) {
  const pulseProgress = useSharedValue(1);
  const progressValue = useSharedValue(0);
  const [trackWidth, setTrackWidth] = useState(0);

  const handleTrackLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  const barPixelWidth = trackWidth * BAR_WIDTH_RATIO;

  // ── Pulse animation ──
  useEffect(() => {
    pulseProgress.value = withRepeat(
      withSequence(withTiming(1.05, { duration: 1000 }), withTiming(1, { duration: 1000 })),
      -1,
    );
  }, [pulseProgress]);

  // ── Indeterminate progress bar ──
  useEffect(() => {
    if (trackWidth === 0) return;
    progressValue.value = 0;
    progressValue.value = withRepeat(withTiming(1, { duration: PROGRESS_DURATION_MS }), -1);
  }, [progressValue, trackWidth]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseProgress.value }],
    opacity: interpolate(pulseProgress.value, [1, 1.05], [1, 0.8]),
  }));

  const progressBarStyle = useAnimatedStyle(() => ({
    width: barPixelWidth,
    backgroundColor: colors.primary,
    transform: [
      { translateX: interpolate(progressValue.value, [0, 1], [-barPixelWidth, trackWidth]) },
    ],
  }));

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background },
        !fullScreen && styles.inlineContainer,
      ]}
    >
      <Animated.View style={[styles.iconContainer, pulseStyle]}>
        <Image source={appIcon} style={styles.icon} resizeMode="contain" />
      </Animated.View>
      <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
      {/* Indeterminate progress bar */}
      <View
        style={[styles.progressTrack, { backgroundColor: colors.border }]}
        onLayout={handleTrackLayout}
      >
        <Animated.View style={[styles.progressBar, progressBarStyle]} />
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
