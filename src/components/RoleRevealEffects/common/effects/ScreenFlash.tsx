/**
 * ScreenFlash - 全屏闪光特效（Reanimated 4）
 *
 * 翻牌后在卡片中心产生全屏辐射闪光，匹配 HTML demo v2 `.screen-flash` 效果。
 * 使用超大尺寸 boxShadow 从 1×1 中心点辐射阵营色光晕，覆盖整个屏幕。
 * 不 import service，不含业务逻辑。
 */
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { CONFIG } from '@/components/RoleRevealEffects/config';

const AE = CONFIG.alignmentEffects;

// Use viewport width to scale the radial glow so it covers the whole screen proportionally
const VIEWPORT_WIDTH = Dimensions.get('window').width;

interface ScreenFlashProps {
  /** Flash color (faction primary) */
  color: string;
  /** Peak opacity (per-alignment, from config) */
  peakOpacity: number;
  /** Flash duration (ms) */
  duration: number;
  /** Whether to animate */
  animate: boolean;
  /** Position: center X of the card in page coordinates */
  centerX: number;
  /** Position: center Y of the card in page coordinates */
  centerY: number;
  /** Per-alignment delay before flash fires (ms). HTML: wolf 200, god/third 250. */
  delay?: number;
}

export const ScreenFlash: React.FC<ScreenFlashProps> = ({
  color,
  peakOpacity,
  duration,
  animate,
  centerX,
  centerY,
  delay = 200,
}) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!animate) return;

    // Matches HTML @keyframes screenFlash: 0%→0, 15%→1, 100%→0
    opacity.value = withDelay(
      AE.effectStartDelay + delay,
      withSequence(
        withTiming(peakOpacity, { duration: duration * 0.15, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: duration * 0.85, easing: Easing.out(Easing.quad) }),
      ),
    );
  }, [animate, opacity, peakOpacity, duration, delay]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.flashPoint,
        {
          top: centerY,
          left: centerX,
          // Use viewport-relative boxShadow to create radial glow from center
          boxShadow: `0 0 ${Math.round(VIEWPORT_WIDTH * 1.07)}px ${Math.round(VIEWPORT_WIDTH * 0.8)}px ${color}`,
        },
        animStyle,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  flashPoint: {
    position: 'absolute',
    width: 1,
    height: 1,
    borderRadius: 1,
    zIndex: 9999,
  },
});
