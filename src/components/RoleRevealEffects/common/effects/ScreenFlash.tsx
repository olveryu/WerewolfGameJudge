/**
 * ScreenFlash — 电影级全屏闪光特效（SVG + Reanimated）
 *
 * 翻牌揭示后从卡片中心迸裂：径向冲击波 + 迸射粒子。
 * 使用 SVG RadialGradient + feGaussianBlur + Reanimated useAnimatedProps 实现。
 * 不 import service，不含业务逻辑。
 */
import React, { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  FeGaussianBlur,
  Filter,
  G,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import { CONFIG } from '@/components/RoleRevealEffects/config';
const AE = CONFIG.alignmentEffects;
const SK = CONFIG.skia;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

// Pre-compute burst particle data (radial scatter)
const BURST_PARTICLES = Array.from({ length: SK.burstParticleCount }, (_, i) => {
  const angle = (i / SK.burstParticleCount) * Math.PI * 2 + ((i * 7) % 10) * 0.06;
  const dist = 50 + ((i * 31) % 100) * 1.5;
  return { angle, dist, size: 1.5 + ((i * 13) % 20) / 10 };
});

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
  /** Per-alignment delay before flash fires (ms). */
  delay?: number;
}

/** Individual burst particle driven by shared progress */
const BurstParticle: React.FC<{
  angle: number;
  dist: number;
  size: number;
  cx: number;
  cy: number;
  color: string;
  progress: SharedValue<number>;
}> = React.memo(({ angle, dist, size, cx, cy, color, progress }) => {
  const animatedProps = useAnimatedProps(() => {
    const p = progress.value;
    const x = cx + Math.cos(angle) * dist * p;
    const y = cy + Math.sin(angle) * dist * p;
    const opacity = p < 0.05 ? p / 0.05 : Math.max(0, 1 - (p - 0.05) / 0.6);
    const r = size * Math.max(0.3, 1 - p * 0.7);
    return { cx: x, cy: y, r, opacity };
  });
  return <AnimatedCircle fill={color} animatedProps={animatedProps} />;
});
BurstParticle.displayName = 'BurstParticle';

export const ScreenFlash: React.FC<ScreenFlashProps> = ({
  color,
  peakOpacity,
  duration,
  animate,
  centerX,
  centerY,
  delay = 200,
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!animate) return;
    progress.value = withDelay(
      AE.effectStartDelay + delay,
      withSequence(
        withTiming(0.15, { duration: duration * 0.15, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: duration * 0.85, easing: Easing.out(Easing.quad) }),
      ),
    );
  }, [animate, progress, duration, delay]);

  // Radial shockwave — animated radius + opacity
  const waveAnimatedProps = useAnimatedProps(() => {
    const r = progress.value * SCREEN_W;
    return { r };
  });
  const waveGroupProps = useAnimatedProps(() => {
    const p = progress.value;
    const opacity =
      p < 0.15 ? (p / 0.15) * peakOpacity : Math.max(0, peakOpacity * (1 - (p - 0.15) / 0.85));
    return { opacity };
  });

  // Hex color → stop colors with alpha
  const stopColor80 = useMemo(() => `${color}80`, [color]);
  const stopColor00 = useMemo(() => `${color}00`, [color]);

  return (
    <Svg style={styles.canvas} width={SCREEN_W} height={SCREEN_H}>
      <Defs>
        <RadialGradient
          id="flash-grad"
          cx={centerX}
          cy={centerY}
          r={SCREEN_W}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={color} />
          <Stop offset="0.5" stopColor={stopColor80} />
          <Stop offset="1" stopColor={stopColor00} />
        </RadialGradient>
        <Filter id="flash-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={SK.flashBlur} />
        </Filter>
        <Filter id="particle-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={SK.particleBlur} />
        </Filter>
      </Defs>

      {/* Radial shockwave — expanding glow from center */}
      <AnimatedG animatedProps={waveGroupProps}>
        <AnimatedCircle
          cx={centerX}
          cy={centerY}
          fill="url(#flash-grad)"
          filter="url(#flash-blur)"
          animatedProps={waveAnimatedProps}
        />
      </AnimatedG>

      {/* Burst particles */}
      <G filter="url(#particle-blur)">
        {BURST_PARTICLES.map((bp, i) => (
          <BurstParticle
            key={i}
            angle={bp.angle}
            dist={bp.dist}
            size={bp.size}
            cx={centerX}
            cy={centerY}
            color={color}
            progress={progress}
          />
        ))}
      </G>
    </Svg>
  );
};

const styles = StyleSheet.create({
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_W,
    height: SCREEN_H,
    zIndex: 9999,
    pointerEvents: 'none',
  },
});
