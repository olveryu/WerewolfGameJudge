/**
 * AtmosphericBackground — 环境粒子氛围层
 *
 * 在各揭示动画交互阶段提供低调的背景粒子/光晕运动感，
 * 增强沉浸感但不喧宾夺主。使用 CSS keyframe 动画实现
 * （替代原 Reanimated Animated.View，减少 JS 线程开销）。
 * 接受阵营主色，自动生成环境粒子。
 * 不 import service，不含业务逻辑。
 */
import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { registerKeyframes } from '@/components/seatAnimations/cssAnimations';

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

// Register per-particle float keyframes (approximates sin-based parametric motion)
AMBIENT_PARTICLES.forEach((p, i) => {
  const dx = p.driftX;
  const dy = p.driftY;
  registerKeyframes(
    `ambientFloat${i}`,
    `0%,100%{transform:translate(0px,0px);opacity:0.15}` +
      `25%{transform:translate(${(dx * 0.7).toFixed(1)}px,${(dy * 0.4).toFixed(1)}px);opacity:0.25}` +
      `50%{transform:translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px);opacity:0.3}` +
      `75%{transform:translate(${(dx * 0.3).toFixed(1)}px,${(dy * 0.8).toFixed(1)}px);opacity:0.2}`,
  );
});

// Glow pulse: opacity 0.06 → 0.10 → 0.06
registerKeyframes('ambientGlowPulse', '0%,100%{opacity:0.06}50%{opacity:0.10}');

/** Single ambient particle — plain View with CSS animation */
const AmbientParticle = React.memo(function AmbientParticle({
  index,
  xRatio,
  yRatio,
  size,
  phase,
  color,
  screenW,
  screenH,
}: {
  index: number;
  xRatio: number;
  yRatio: number;
  size: number;
  phase: number;
  color: string;
  screenW: number;
  screenH: number;
}) {
  const baseX = xRatio * screenW;
  const baseY = yRatio * screenH;

  const style = {
    position: 'absolute' as const,
    left: baseX - size,
    top: baseY - size,
    width: size * 2,
    height: size * 2,
    borderRadius: size,
    backgroundColor: color,
    opacity: 0.15,
    animationName: `ambientFloat${index}`,
    animationDuration: `${7000 + index * 600}ms`,
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
    animationDelay: `${(-phase * 1200).toFixed(0)}ms`,
  };

  return <View style={style} />;
});

interface AtmosphericBackgroundProps {
  /** Primary color for particles */
  color: string;
  /** Whether to animate */
  animate: boolean;
}

export const AtmosphericBackground: React.FC<AtmosphericBackgroundProps> = ({ color, animate }) => {
  const { width: screenW, height: screenH } = useWindowDimensions();

  if (!animate) return null;

  const glowRadius = screenW * 0.6;

  const glowStyle = {
    position: 'absolute' as const,
    left: screenW / 2 - glowRadius,
    top: screenH * 0.45 - glowRadius,
    width: glowRadius * 2,
    height: glowRadius * 2,
    borderRadius: glowRadius,
    backgroundColor: color,
    opacity: 0.06,
    animationName: 'ambientGlowPulse',
    animationDuration: '6000ms',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  };

  return (
    <View style={styles.fullScreen}>
      {/* Subtle center radial glow */}
      <View style={glowStyle} />

      {/* Floating ambient particles */}
      {AMBIENT_PARTICLES.map((p, i) => (
        <AmbientParticle
          key={i}
          index={i}
          xRatio={p.xRatio}
          yRatio={p.yRatio}
          size={p.size}
          phase={p.phase}
          color={color}
          screenW={screenW}
          screenH={screenH}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
});
