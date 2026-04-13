/**
 * RevealBurst — 揭示瞬间爆裂粒子特效
 *
 * 在卡牌翻转/揭示的瞬间从中心爆发金色粒子 + 震荡环。
 * 使用 Reanimated Animated.View 实现（替代原 Skia Canvas，减少同屏 Canvas 数量）。
 * `trigger` 从 false → true 时触发一次性爆发动画。
 * 不 import service，不含业务逻辑。
 */
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Easing,
  useAnimatedStyle,
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

/** Single burst particle — Animated.View circle */
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
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const cx = centerX + Math.cos(angle) * dist * p;
    const cy = centerY + Math.sin(angle) * dist * p;
    const opacity = p < 0.2 ? p / 0.2 : Math.max(0, 1 - (p - 0.2) / 0.8);
    return {
      position: 'absolute',
      left: cx - size,
      top: cy - size,
      width: size * 2,
      height: size * 2,
      borderRadius: size,
      backgroundColor: color,
      opacity,
    };
  });

  return <Animated.View style={style} />;
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
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);

  useEffect(() => {
    if (!trigger) return;
    progress.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) });
    ringScale.value = withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
    ringOpacity.value = withSequence(
      withTiming(0.5, { duration: 100, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) }),
    );
  }, [trigger, progress, ringScale, ringOpacity]);

  const ringDiameter = SCREEN_W * 0.8;
  const ringStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: centerX - ringDiameter / 2,
    top: centerY - ringDiameter / 2,
    width: ringDiameter,
    height: ringDiameter,
    borderRadius: ringDiameter / 2,
    borderWidth: 2,
    borderColor: color,
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  if (!trigger) return null;

  return (
    <View style={styles.fullScreen} pointerEvents="none">
      {/* Shockwave ring */}
      <Animated.View style={ringStyle} />

      {/* Burst particles */}
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
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
  },
});
