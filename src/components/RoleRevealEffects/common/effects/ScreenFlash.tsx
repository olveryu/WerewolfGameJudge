/**
 * ScreenFlash — Skia 电影级全屏闪光特效
 *
 * 翻牌揭示后从卡片中心迸裂：径向冲击波 + 十字光条 + 迸射粒子。
 * 使用 Skia Canvas + Blur + RadialGradient + blendMode="screen" 实现。
 * 不 import service，不含业务逻辑。
 */
import { Blur, Canvas, Circle, Group, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import React, { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { CONFIG } from '@/components/RoleRevealEffects/config';

const AE = CONFIG.alignmentEffects;
const SK = CONFIG.skia;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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

  // Radial shockwave
  const waveR = useDerivedValue(() => progress.value * SCREEN_W);
  const waveOpacity = useDerivedValue(() => {
    const p = progress.value;
    if (p < 0.15) return (p / 0.15) * peakOpacity;
    return Math.max(0, peakOpacity * (1 - (p - 0.15) / 0.85));
  });

  // Cross flash bars
  const crossScaleXTransform = useDerivedValue(() => [
    { scaleX: Math.min(1.5, (progress.value / 0.1) * 1.5) },
  ]);
  const crossScaleYTransform = useDerivedValue(() => [
    { scaleY: Math.min(1.5, (progress.value / 0.1) * 1.5) },
  ]);
  const crossOpacity = useDerivedValue(() => {
    const p = progress.value;
    if (p < 0.1) return peakOpacity * 0.9;
    return Math.max(0, peakOpacity * 0.9 * (1 - (p - 0.1) / 0.9));
  });

  const particleSeeds = useMemo(
    () => BURST_PARTICLES.map((bp) => ({ ...bp, baseX: centerX, baseY: centerY })),
    [centerX, centerY],
  );

  const barThickness = Math.max(3, SCREEN_W * SK.crossFlashThickness);
  const barLength = SCREEN_W * SK.crossFlashLength;

  return (
    <Canvas style={styles.canvas} pointerEvents="none">
      {/* Radial shockwave — expanding glow from center */}
      <Group opacity={waveOpacity}>
        <Circle cx={centerX} cy={centerY} r={waveR}>
          <RadialGradient
            c={vec(centerX, centerY)}
            r={SCREEN_W}
            colors={[color, `${color}80`, `${color}00`]}
          />
          <Blur blur={SK.flashBlur} />
        </Circle>
      </Group>

      {/* Cross flash — horizontal */}
      <Group
        opacity={crossOpacity}
        transform={crossScaleXTransform}
        origin={vec(centerX, centerY)}
        blendMode="screen"
      >
        <Rect
          x={centerX - barLength / 2}
          y={centerY - barThickness / 2}
          width={barLength}
          height={barThickness}
          color={color}
        >
          <Blur blur={8} />
        </Rect>
      </Group>

      {/* Cross flash — vertical */}
      <Group
        opacity={crossOpacity}
        transform={crossScaleYTransform}
        origin={vec(centerX, centerY)}
        blendMode="screen"
      >
        <Rect
          x={centerX - barThickness / 2}
          y={centerY - barLength / 2}
          width={barThickness}
          height={barLength}
          color={color}
        >
          <Blur blur={8} />
        </Rect>
      </Group>

      {/* Burst particles — radial scatter */}
      <Group blendMode="screen">
        {particleSeeds.map((p, i) => (
          <BurstParticle
            key={i}
            baseX={p.baseX}
            baseY={p.baseY}
            angle={p.angle}
            dist={p.dist}
            size={p.size}
            color={color}
            progress={progress}
          />
        ))}
      </Group>
    </Canvas>
  );
};

/** Single burst particle flying outward from center */
const BurstParticle = React.memo(function BurstParticle({
  baseX,
  baseY,
  angle,
  dist,
  size,
  color,
  progress,
}: {
  baseX: number;
  baseY: number;
  angle: number;
  dist: number;
  size: number;
  color: string;
  progress: SharedValue<number>;
}) {
  const cx = useDerivedValue(() => baseX + Math.cos(angle) * dist * progress.value);
  const cy = useDerivedValue(() => baseY + Math.sin(angle) * dist * progress.value);
  const opacity = useDerivedValue(() => {
    const p = progress.value;
    if (p < 0.05) return p / 0.05;
    return Math.max(0, 1 - (p - 0.05) / 0.6);
  });
  const r = useDerivedValue(() => size * Math.max(0.3, 1 - progress.value * 0.7));

  return (
    <Circle cx={cx} cy={cy} r={r} color={color} opacity={opacity}>
      <Blur blur={SK.particleBlur} />
    </Circle>
  );
});

const styles = StyleSheet.create({
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_W,
    height: SCREEN_H,
    zIndex: 9999,
  },
});
