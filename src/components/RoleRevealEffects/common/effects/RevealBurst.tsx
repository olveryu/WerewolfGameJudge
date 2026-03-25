/**
 * RevealBurst — Skia 揭示瞬间爆裂粒子特效
 *
 * 在卡牌翻转/揭示的瞬间从中心爆发金色粒子 + 震荡环。
 * 使用 Skia Circle + Blur + blendMode="screen" 实现。
 * `trigger` 从 false → true 时触发一次性爆发动画。
 * 不 import service，不含业务逻辑。
 */
import { Blur, Canvas, Circle, Group } from '@shopify/react-native-skia';
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const BURST_COUNT = 16;
const BURST_PARTICLES = Array.from({ length: BURST_COUNT }, (_, i) => {
  const angle = (i / BURST_COUNT) * Math.PI * 2 + ((i * 7) % 10) * 0.06;
  const dist = 40 + ((i * 31) % 80);
  return {
    angle,
    dist,
    size: 1.5 + ((i * 13) % 20) / 10,
  };
});

/** Single burst particle */
const BurstParticle = React.memo(function BurstParticle({
  angle,
  dist,
  size,
  progress,
  centerX,
  centerY,
  color,
}: {
  angle: number;
  dist: number;
  size: number;
  progress: SharedValue<number>;
  centerX: number;
  centerY: number;
  color: string;
}) {
  const cx = useDerivedValue(() => centerX + Math.cos(angle) * dist * progress.value);
  const cy = useDerivedValue(() => centerY + Math.sin(angle) * dist * progress.value);
  const opacity = useDerivedValue(() => {
    const p = progress.value;
    if (p < 0.2) return p / 0.2;
    return Math.max(0, 1 - (p - 0.2) / 0.8);
  });

  return (
    <Circle cx={cx} cy={cy} r={size} color={color} opacity={opacity}>
      <Blur blur={2} />
    </Circle>
  );
});

interface RevealBurstProps {
  /** Whether the burst has been triggered */
  trigger: boolean;
  /** Burst center X (screen coordinates) */
  centerX?: number;
  /** Burst center Y (screen coordinates) */
  centerY?: number;
  /** Particle color */
  color?: string;
}

export const RevealBurst: React.FC<RevealBurstProps> = ({
  trigger,
  centerX = SCREEN_W / 2,
  centerY = SCREEN_H * 0.45,
  color = '#FFD700',
}) => {
  const progress = useSharedValue(0);
  const ringRadius = useSharedValue(0);
  const ringOpacity = useSharedValue(0);

  useEffect(() => {
    if (!trigger) return;
    progress.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) });
    ringRadius.value = withTiming(SCREEN_W * 0.4, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
    ringOpacity.value = withSequence(
      withTiming(0.5, { duration: 100, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) }),
    );
  }, [trigger, progress, ringRadius, ringOpacity]);

  if (!trigger) return null;

  return (
    <Canvas style={styles.fullScreen} pointerEvents="none">
      {/* Shockwave ring */}
      <Circle
        cx={centerX}
        cy={centerY}
        r={ringRadius}
        color={color}
        style="stroke"
        strokeWidth={2}
        opacity={ringOpacity}
      >
        <Blur blur={4} />
      </Circle>

      {/* Burst particles */}
      <Group blendMode="screen">
        {BURST_PARTICLES.map((p, i) => (
          <BurstParticle
            key={i}
            angle={p.angle}
            dist={p.dist}
            size={p.size}
            progress={progress}
            centerX={centerX}
            centerY={centerY}
            color={color}
          />
        ))}
      </Group>
    </Canvas>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
  },
});
