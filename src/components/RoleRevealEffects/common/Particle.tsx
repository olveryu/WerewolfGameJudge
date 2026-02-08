/**
 * Particle - 轻量粒子动画组件
 *
 * 用于视觉特效的单个粒子，支持起止坐标、颜色、旋转。
 *
 * ✅ 允许：渲染粒子动画 UI
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React, { useEffect, useMemo } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { canUseNativeDriver } from '@/components/RoleRevealEffects/utils/platform';

export interface ParticleProps {
  /** Starting X position */
  startX: number;
  /** Starting Y position */
  startY: number;
  /** Ending X position */
  endX: number;
  /** Ending Y position */
  endY: number;
  /** Particle color */
  color: string;
  /** Particle size */
  size: number;
  /** Animation duration in ms */
  duration: number;
  /** Delay before starting animation */
  delay?: number;
  /** Initial rotation */
  initialRotation?: number;
  /** Final rotation */
  finalRotation?: number;
  /** Initial scale */
  initialScale?: number;
  /** Final scale */
  finalScale?: number;
  /** Fade out at end */
  fadeOut?: boolean;
  /** Callback when animation completes */
  onComplete?: () => void;
}

export const Particle: React.FC<ParticleProps> = ({
  startX,
  startY,
  endX,
  endY,
  color,
  size,
  duration,
  delay = 0,
  initialRotation = 0,
  finalRotation = 0,
  initialScale = 1,
  finalScale = 0,
  fadeOut = true,
  onComplete,
}) => {
  const progress = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: canUseNativeDriver,
    });

    animation.start(() => {
      onComplete?.();
    });

    return () => {
      animation.stop();
    };
  }, [progress, duration, delay, onComplete]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [startX, endX],
  });

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [startY, endY],
  });

  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [`${initialRotation}deg`, `${finalRotation}deg`],
  });

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [initialScale, finalScale],
  });

  const opacity = fadeOut
    ? progress.interpolate({
        inputRange: [0, 0.7, 1],
        outputRange: [1, 1, 0],
      })
    : 1;

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ translateX }, { translateY }, { rotate }, { scale }],
          opacity,
        },
      ]}
    />
  );
};

/**
 * Generate random particles for a burst effect
 */
export function generateBurstParticles(
  count: number,
  centerX: number,
  centerY: number,
  radius: number,
  color: string,
  sizeRange: [number, number] = [4, 8],
  durationRange: [number, number] = [600, 1000],
): ParticleProps[] {
  const particles: ParticleProps[] = [];

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const distance = radius * (0.6 + Math.random() * 0.4);
    const size = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
    const duration = durationRange[0] + Math.random() * (durationRange[1] - durationRange[0]);

    particles.push({
      startX: centerX,
      startY: centerY,
      endX: centerX + Math.cos(angle) * distance,
      endY: centerY + Math.sin(angle) * distance,
      color,
      size,
      duration,
      delay: Math.random() * 100,
      initialRotation: Math.random() * 360,
      finalRotation: Math.random() * 720 - 360,
      initialScale: 1,
      finalScale: 0,
      fadeOut: true,
    });
  }

  return particles;
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
  },
});
