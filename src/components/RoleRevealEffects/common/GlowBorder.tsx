/**
 * GlowBorder - 动画发光边框效果（Reanimated 4）
 *
 * 支持闪烁次数、持续时间配置。使用 `withRepeat` + `withSequence` 驱动闪烁，
 * 完成后通过 `runOnJS` 回调通知外部。
 *
 * ✅ 允许：渲染动画边框 UI
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React, { useEffect } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export interface GlowBorderProps {
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
  flashCount = 3,
  flashDuration = 200,
  onComplete,
  width,
  height,
  style,
}) => {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!animate) {
      opacity.value = 1;
      scale.value = 1;
      onComplete?.();
      return;
    }

    const half = flashDuration / 2;

    // Flash opacity: 1 → 0.3 → 1, repeated flashCount times
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: half }),
        withTiming(1, { duration: half }),
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

    // Flash scale: 1 → 1.05 → 1, same timing
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: half }),
        withTiming(1, { duration: half }),
      ),
      flashCount,
      false,
    );
  }, [animate, flashCount, flashDuration, onComplete, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width,
          height,
          borderRadius,
          borderWidth,
          borderColor: color,
          shadowColor: glowColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 10,
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
});
