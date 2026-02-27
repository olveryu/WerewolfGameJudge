/**
 * BreathingBorder - 持续呼吸发光边框（Reanimated 4）
 *
 * 翻牌揭示后在卡片周围显示一圈发光边框，以无限呼吸脉动保持视觉存在感。
 * 初始 opacity=1（立即可见），然后进入 0.15↔0.4 的缓慢循环。
 * `onComplete` 在 mount 后经过 `effectDisplayDuration` 延迟触发（给阵营特效
 * 充分展示时间），不依赖动画回调。
 * 不 import service，不含业务逻辑。
 */
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { CONFIG } from '@/components/RoleRevealEffects/config';
import { borderRadius, spacing } from '@/theme';

const { common, alignmentEffects } = CONFIG;

interface BreathingBorderProps {
  /** Border color */
  color: string;
  /** Glow spread color (lighter variant) */
  glowColor: string;
  /** Card content width */
  cardWidth: number;
  /** Card content height */
  cardHeight: number;
  /** Whether to start animation */
  animate: boolean;
  /** Breathing cycle duration (ms). Per-alignment values from config. */
  breathingDuration?: number;
  /** Fired shortly after mount (game state progression) */
  onComplete?: () => void;
}

export const BreathingBorder: React.FC<BreathingBorderProps> = ({
  color,
  glowColor,
  cardWidth,
  cardHeight,
  animate,
  breathingDuration: breathingDurationProp,
  onComplete,
}) => {
  const glowPadding = common.glowPadding;
  // Start fully visible — never invisible at mount
  const opacity = useSharedValue(1);
  const duration = breathingDurationProp ?? 2500;

  // Fire onComplete after alignment effects have displayed sufficiently
  useEffect(() => {
    if (!animate || !onComplete) return;
    const timer = setTimeout(onComplete, alignmentEffects.effectDisplayDuration);
    return () => clearTimeout(timer);
  }, [animate, onComplete]);

  // Infinite breathing loop
  useEffect(() => {
    if (!animate) {
      opacity.value = 1;
      return;
    }

    const breathHalf = duration / 2;
    const breathEasing = Easing.inOut(Easing.sin);

    // 1 → 0.3 → 0.7 → 0.3 → 0.7 … (infinite, higher range for visibility on white cards)
    opacity.value = withSequence(
      withTiming(0.3, { duration: breathHalf, easing: breathEasing }),
      withRepeat(
        withSequence(
          withTiming(0.7, { duration: breathHalf, easing: breathEasing }),
          withTiming(0.3, { duration: breathHalf, easing: breathEasing }),
        ),
        -1,
      ),
    );
  }, [animate, duration, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.border,
        {
          width: cardWidth + glowPadding,
          height: cardHeight + glowPadding,
          top: -glowPadding / 2,
          left: -glowPadding / 2,
          borderRadius: borderRadius.medium + spacing.tight,
          borderWidth: common.glowBorderWidth,
          borderColor: color,
          boxShadow: `0 0 ${Math.round(cardWidth * 0.14)}px ${Math.round(cardWidth * 0.03)}px ${glowColor}`,
        },
        animatedStyle,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  border: {
    position: 'absolute',
  },
});
