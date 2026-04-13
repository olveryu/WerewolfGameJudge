/**
 * AtmosphericBackground — 环境粒子氛围层
 *
 * 在各揭示动画交互阶段提供低调的背景粒子/光晕运动感，
 * 增强沉浸感但不喧宾夺主。使用 Reanimated Animated.View 实现
 * （替代原 Skia Canvas + Picture API，减少同屏 Canvas 数量）。
 * 接受阵营主色，自动生成环境粒子。
 * 不 import service，不含业务逻辑。
 */
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const AMBIENT_COUNT = 12;
const AMBIENT_PARTICLES = Array.from({ length: AMBIENT_COUNT }, (_, i) => {
  const r1 = ((i * 73 + 17) % 100) / 100;
  const r2 = ((i * 41 + 31) % 100) / 100;
  const r3 = ((i * 59 + 7) % 100) / 100;
  return {
    xRatio: r1,
    yRatio: r2,
    size: 2 + r3 * 4,
    driftX: (r1 - 0.5) * 30,
    driftY: -15 - r2 * 25,
    phase: ((i * 83 + 11) % 628) / 100,
  };
});

/** Single ambient particle — Animated.View circle */
const AmbientParticle = React.memo(function AmbientParticle({
  xRatio,
  yRatio,
  size,
  driftX,
  driftY,
  phase,
  cycle,
  color,
}: {
  xRatio: number;
  yRatio: number;
  size: number;
  driftX: number;
  driftY: number;
  phase: number;
  cycle: SharedValue<number>;
  color: string;
}) {
  const baseX = xRatio * SCREEN_W;
  const baseY = yRatio * SCREEN_H;

  const style = useAnimatedStyle(() => {
    const c = cycle.value;
    const cx = baseX + driftX * Math.sin(c + phase);
    const cy = baseY + driftY * Math.sin(c * 0.7 + phase);
    const opacity = 0.15 + 0.15 * Math.sin(c * 1.3 + phase);
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

interface AtmosphericBackgroundProps {
  /** Primary color for particles */
  color: string;
  /** Whether to animate */
  animate: boolean;
}

export const AtmosphericBackground: React.FC<AtmosphericBackgroundProps> = ({ color, animate }) => {
  const cycle = useSharedValue(0);
  const glowPulse = useSharedValue(0);

  useEffect(() => {
    if (!animate) return;
    cycle.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 8000, easing: Easing.linear }),
      -1,
    );
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [animate, cycle, glowPulse]);

  const glowRadius = SCREEN_W * 0.6;

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.06 + glowPulse.value * 0.04,
  }));

  if (!animate) return null;

  return (
    <View style={styles.fullScreen} pointerEvents="none">
      {/* Subtle center radial glow — approximated with large blurred circle */}
      <Animated.View
        style={[
          styles.glow,
          {
            left: SCREEN_W / 2 - glowRadius,
            top: SCREEN_H * 0.45 - glowRadius,
            width: glowRadius * 2,
            height: glowRadius * 2,
            borderRadius: glowRadius,
            backgroundColor: color,
          },
          glowStyle,
        ]}
      />

      {/* Floating ambient particles */}
      {AMBIENT_PARTICLES.map((p, i) => (
        <AmbientParticle
          key={i}
          xRatio={p.xRatio}
          yRatio={p.yRatio}
          size={p.size}
          driftX={p.driftX}
          driftY={p.driftY}
          phase={p.phase}
          cycle={cycle}
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
  glow: {
    position: 'absolute',
  },
});
