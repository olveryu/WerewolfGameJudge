/**
 * GlowBorder - 动画发光边框效果（Reanimated 4）
 *
 * 支持闪烁次数、持续时间配置。使用 `withRepeat` + `withSequence` 驱动闪烁，
 * 完成后通过 `runOnJS` 回调通知外部。
 * 渲染动画边框 UI。不 import service，不含业务逻辑。
 */
import React, { useEffect } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface GlowBorderProps {
  /** Border color */
  color: string;
  /** Glow color (typically lighter than border) */
  glowColor: string;
  /** Border width */
  borderWidth?: number;
  /** Border radius */
  borderRadius?: number;
  /** Whether to animate (flash) */
  animate?: boolean;
  /** Number of flashes */
  flashCount?: number;
  /** Duration per flash cycle */
  flashDuration?: number;
  /** Callback when animation completes */
  onComplete?: () => void;
  /** Content dimensions */
  width: number;
  height: number;
  /** Additional style */
  style?: ViewStyle;
}

export const GlowBorder: React.FC<GlowBorderProps> = ({
  color,
  glowColor,
  borderWidth = 3,
  borderRadius = 12,
  animate = false,
  flashCount = 2,
  flashDuration = 150,
  onComplete,
  width,
  height,
  style,
}) => {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!animate) {
      opacity.value = 1;
      return;
    }

    const half = flashDuration / 2;
    const easeFn = Easing.inOut(Easing.sin);

    // Smooth breathing: 1 → 0.6 → 1, repeated flashCount times
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: half, easing: easeFn }),
        withTiming(1, { duration: half, easing: easeFn }),
      ),
      flashCount,
      false,
      (finished) => {
        'worklet';
        if (finished && onComplete) {
          runOnJS(onComplete)();
        }
      },
    );
  }, [animate, flashCount, flashDuration, onComplete, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        styles.glow,
        {
          width,
          height,
          borderRadius,
          borderWidth,
          borderColor: color,
          boxShadow: `0 0 10px ${glowColor}`,
        },
        animatedStyle,
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
  glow: {
    // boxShadow applied dynamically via inline style with glowColor prop
  },
});
