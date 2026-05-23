/**
 * RevealBurst — 揭示瞬间爆裂粒子特效
 *
 * 在卡牌翻转/揭示的瞬间从中心爆发金色粒子 + 震荡环。
 * 使用 CSS keyframe 动画实现（替代原 Reanimated，减少 JS 线程开销）。
 * `trigger` 从 false → true 时触发一次性爆发动画。
 * 不 import service，不含业务逻辑。
 */
import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { registerKeyframes } from '@/components/seatAnimations/cssAnimations';

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

// Register per-particle burst keyframes
BURST_PARTICLES.forEach((p, i) => {
  const dx = (Math.cos(p.angle) * p.dist).toFixed(1);
  const dy = (Math.sin(p.angle) * p.dist).toFixed(1);
  registerKeyframes(
    `burstParticle${i}`,
    `0%{transform:translate(0px,0px);opacity:0}` +
      `20%{opacity:1}` +
      `100%{transform:translate(${dx}px,${dy}px);opacity:0}`,
  );
});

// Shockwave ring animation
registerKeyframes(
  'burstRing',
  '0%{transform:scale(0);opacity:0}' + '20%{opacity:0.5}' + '100%{transform:scale(1);opacity:0}',
);

/** Single burst particle — plain View with CSS keyframe animation */
const BurstParticle = React.memo(function BurstParticle({
  index,
  size,
  centerX,
  centerY,
  color,
}: {
  index: number;
  size: number;
  centerX: number;
  centerY: number;
  color: string;
}) {
  const style = {
    position: 'absolute' as const,
    left: centerX - size,
    top: centerY - size,
    width: size * 2,
    height: size * 2,
    borderRadius: size,
    backgroundColor: color,
    opacity: 0,
    animationName: `burstParticle${index}`,
    animationDuration: '600ms',
    animationTimingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    animationFillMode: 'forwards',
  };

  return <View style={style} />;
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
  centerX: centerXProp,
  centerY: centerYProp,
  color = '#FFD700',
}) => {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const centerX = centerXProp ?? screenW / 2;
  const centerY = centerYProp ?? screenH * 0.45;

  if (!trigger) return null;

  const ringDiameter = screenW * 0.8;
  const ringStyle = {
    position: 'absolute' as const,
    left: centerX - ringDiameter / 2,
    top: centerY - ringDiameter / 2,
    width: ringDiameter,
    height: ringDiameter,
    borderRadius: ringDiameter / 2,
    borderWidth: 2,
    borderColor: color,
    opacity: 0,
    animationName: 'burstRing',
    animationDuration: '500ms',
    animationTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)',
    animationFillMode: 'forwards',
  };

  return (
    <View style={styles.fullScreen}>
      {/* Shockwave ring */}
      <View style={ringStyle} />

      {/* Burst particles */}
      {BURST_PARTICLES.map((p, i) => (
        <BurstParticle
          key={i}
          index={i}
          size={p.size}
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
    pointerEvents: 'none',
  },
});
