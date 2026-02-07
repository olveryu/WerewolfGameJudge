/**
 * GlowBorder - 动画发光边框效果
 *
 * 支持闪烁次数、持续时间配置。
 *
 * ✅ 允许：渲染动画边框 UI
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React, { useEffect, useMemo } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';
import { canUseNativeDriver } from '../utils/platform';

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
  const opacity = useMemo(() => new Animated.Value(1), []);
  const scale = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    if (!animate) {
      opacity.setValue(1);
      scale.setValue(1);
      // Still call onComplete even when not animating
      onComplete?.();
      return;
    }

    // Create flash sequence
    const flashSequence: Animated.CompositeAnimation[] = [];

    for (let i = 0; i < flashCount; i++) {
      flashSequence.push(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0.3,
              duration: flashDuration / 2,
              useNativeDriver: canUseNativeDriver,
            }),
            Animated.timing(opacity, {
              toValue: 1,
              duration: flashDuration / 2,
              useNativeDriver: canUseNativeDriver,
            }),
          ]),
          Animated.sequence([
            Animated.timing(scale, {
              toValue: 1.05,
              duration: flashDuration / 2,
              useNativeDriver: canUseNativeDriver,
            }),
            Animated.timing(scale, {
              toValue: 1,
              duration: flashDuration / 2,
              useNativeDriver: canUseNativeDriver,
            }),
          ]),
        ]),
      );
    }

    Animated.sequence(flashSequence).start(() => {
      onComplete?.();
    });
  }, [animate, flashCount, flashDuration, opacity, scale, onComplete]);

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
          opacity,
          transform: [{ scale }],
          // Simulate glow with shadow
          shadowColor: glowColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 10,
        },
        style,
      ]}
      pointerEvents="none"
    />
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
});
